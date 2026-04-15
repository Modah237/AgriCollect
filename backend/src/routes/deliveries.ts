import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth'
import { validate } from '../middleware/validate'

const router = Router()

// ─── Schéma d'une livraison offline ─────────────────────────────────────────

const deliverySchema = z.object({
  offlineUuid: z.string().uuid(),          // UUID v4 généré hors ligne
  deviceId: z.string().min(1),
  campaignId: z.string().min(1),
  producerId: z.string().min(1),
  culture: z.string().min(1),
  quantityKg: z.number().positive(),
  qualityGrade: z.enum(['A', 'B', 'C']).default('A'),
  photoUrl: z.string().url().optional(),
  notes: z.string().max(500).optional(),
  createdOfflineAt: z.coerce.date(),
})

const syncSchema = z.object({
  deliveries: z.array(deliverySchema).min(1).max(100), // Max 100 par batch de sync
})

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * POST /deliveries/sync
 * Synchronisation des livraisons depuis l'app mobile (offline → serveur)
 * Idempotent : une livraison avec le même offlineUuid est ignorée si déjà reçue
 */
router.post('/sync', authenticate, validate(syncSchema), async (req: Request, res: Response) => {
  const { deliveries } = req.body
  const collectorId = req.user!.userId
  const gicId = req.user!.gicId

  const results: Array<{ offlineUuid: string; status: 'created' | 'duplicate' | 'error'; error?: string }> = []

  for (const delivery of deliveries) {
    try {
      // Récupérer la campagne et vérifier l'appartenance au GIC
      const campaign = await prisma.campaign.findUnique({
        where: { id: delivery.campaignId },
      })

      if (!campaign || campaign.gicId !== gicId || campaign.status !== 'ACTIVE') {
        results.push({ offlineUuid: delivery.offlineUuid, status: 'error', error: 'Campagne invalide ou inactive' })
        continue
      }

      // Vérifier que le producteur appartient au GIC
      const producer = await prisma.producer.findUnique({
        where: { id: delivery.producerId },
      })

      if (!producer || producer.gicId !== gicId || !producer.isActive) {
        results.push({ offlineUuid: delivery.offlineUuid, status: 'error', error: 'Producteur invalide' })
        continue
      }

      // Trouver le prix applicable (le plus récent avant createdOfflineAt)
      const priceRule = await prisma.priceRule.findFirst({
        where: {
          campaignId: delivery.campaignId,
          culture: delivery.culture,
          qualityGrade: delivery.qualityGrade,
          effectiveFrom: { lte: new Date(delivery.createdOfflineAt) },
        },
        orderBy: { effectiveFrom: 'desc' },
      })

      if (!priceRule) {
        results.push({ offlineUuid: delivery.offlineUuid, status: 'error', error: 'Aucun prix défini pour cette culture/qualité' })
        continue
      }

      // Calculer les avances déductibles
      const advances = await prisma.advance.findMany({
        where: { producerId: delivery.producerId, campaignId: delivery.campaignId },
      })
      const totalAdvance = advances.reduce(
        (sum: number, a: { amount: number; repaidAmount: number }) => sum + (a.amount - a.repaidAmount),
        0
      )

      const calculatedAmount = Math.round(Number(delivery.quantityKg) * priceRule.pricePerKg)
      const advanceDeducted = Math.min(totalAdvance, calculatedAmount)
      const netDue = calculatedAmount - advanceDeducted

      // Upsert idempotent — si offlineUuid déjà présent, retourne "duplicate"
      const existing = await prisma.delivery.findUnique({
        where: { offlineUuid: delivery.offlineUuid },
      })

      if (existing) {
        results.push({ offlineUuid: delivery.offlineUuid, status: 'duplicate' })
        continue
      }

      await prisma.delivery.create({
        data: {
          offlineUuid: delivery.offlineUuid,
          deviceId: delivery.deviceId,
          campaignId: delivery.campaignId,
          producerId: delivery.producerId,
          collectorId,
          culture: delivery.culture,
          quantityKg: delivery.quantityKg,
          qualityGrade: delivery.qualityGrade,
          photoUrl: delivery.photoUrl,
          notes: delivery.notes,
          pricePerKg: priceRule.pricePerKg,
          calculatedAmount,
          advanceDeducted,
          netDue,
          createdOfflineAt: new Date(delivery.createdOfflineAt),
          syncedAt: new Date(),
        },
      })

      results.push({ offlineUuid: delivery.offlineUuid, status: 'created' })
    } catch (err) {
      results.push({ offlineUuid: delivery.offlineUuid, status: 'error', error: 'Erreur serveur' })
    }
  }

  // Logger la synchronisation
  await prisma.syncLog.create({
    data: {
      deviceId: deliveries[0]?.deviceId ?? 'unknown',
      collectorId,
      recordsCount: deliveries.length,
      conflictsCount: results.filter((r) => r.status === 'duplicate').length,
    },
  })

  res.json({
    total: deliveries.length,
    created: results.filter((r) => r.status === 'created').length,
    duplicates: results.filter((r) => r.status === 'duplicate').length,
    errors: results.filter((r) => r.status === 'error').length,
    results,
  })
})

/**
 * GET /deliveries
 * Liste des livraisons filtrables par campagne et/ou producteur
 */
router.get('/', authenticate, async (req: Request, res: Response) => {
  const { campaignId, producerId, page = '1', limit = '50' } = req.query

  const pageNum = Math.max(1, parseInt(page as string))
  const limitNum = Math.min(100, Math.max(1, parseInt(limit as string)))
  const skip = (pageNum - 1) * limitNum

  const where: Record<string, unknown> = {}

  if (campaignId) {
    // Vérifier l'accès à cette campagne
    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId as string } })
    if (!campaign || (req.user!.role !== 'SUPER_ADMIN' && campaign.gicId !== req.user!.gicId)) {
      res.status(403).json({ error: 'Accès refusé à cette campagne' })
      return
    }
    where.campaignId = campaignId
  } else {
    // Filtrer par GIC de l'utilisateur
    where.campaign = { gicId: req.user!.gicId }
  }

  if (producerId) where.producerId = producerId

  const [deliveries, total] = await Promise.all([
    prisma.delivery.findMany({
      where,
      include: {
        producer: { select: { fullName: true, phoneMomo: true } },
        collector: { select: { fullName: true } },
      },
      orderBy: { createdOfflineAt: 'desc' },
      skip,
      take: limitNum,
    }),
    prisma.delivery.count({ where }),
  ])

  res.json({
    data: deliveries,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum),
    },
  })
})

export default router
