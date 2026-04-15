import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, requireRole } from '../middleware/auth'
import { validate } from '../middleware/validate'

const router = Router()

const createCampaignSchema = z.object({
  gicId: z.string().min(1),
  name: z.string().min(2).max(200),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
})

const addPriceRuleSchema = z.object({
  culture: z.string().min(1),
  qualityGrade: z.enum(['A', 'B', 'C']).default('A'),
  pricePerKg: z.number().int().positive(), // En XAF, entier
  effectiveFrom: z.coerce.date().optional(),
})

/**
 * POST /campaigns
 * Créer une nouvelle campagne — MANAGER uniquement
 */
router.post(
  '/',
  authenticate,
  requireRole('MANAGER', 'SUPER_ADMIN'),
  validate(createCampaignSchema),
  async (req: Request, res: Response) => {
    if (req.user!.role !== 'SUPER_ADMIN' && req.body.gicId !== req.user!.gicId) {
      res.status(403).json({ error: 'Accès refusé à ce GIC' })
      return
    }

    // Une seule campagne ACTIVE par GIC à la fois
    const existingActive = await prisma.campaign.findFirst({
      where: { gicId: req.body.gicId, status: 'ACTIVE' },
    })

    if (existingActive) {
      res.status(409).json({
        error: 'Une campagne est déjà active pour ce GIC',
        activeCampaignId: existingActive.id,
      })
      return
    }

    const campaign = await prisma.campaign.create({
      data: { ...req.body, status: 'DRAFT' },
    })

    res.status(201).json(campaign)
  }
)

/**
 * PATCH /campaigns/:id/activate
 * Activer une campagne (passe de DRAFT → ACTIVE)
 */
router.patch(
  '/:id/activate',
  authenticate,
  requireRole('MANAGER', 'SUPER_ADMIN'),
  async (req: Request, res: Response) => {
    const campaign = await prisma.campaign.findUnique({ where: { id: String(req.params.id) } })

    if (!campaign) {
      res.status(404).json({ error: 'Campagne introuvable' })
      return
    }

    if (req.user!.role !== 'SUPER_ADMIN' && campaign.gicId !== req.user!.gicId) {
      res.status(403).json({ error: 'Accès refusé' })
      return
    }

    if (campaign.status !== 'DRAFT') {
      res.status(409).json({ error: `Impossible d'activer une campagne en statut ${campaign.status}` })
      return
    }

    // Vérifier qu'au moins une règle de prix est définie
    const priceRuleCount = await prisma.priceRule.count({ where: { campaignId: campaign.id } })
    if (priceRuleCount === 0) {
      res.status(400).json({ error: 'Définir au moins un prix avant d\'activer la campagne' })
      return
    }

    const updated = await prisma.campaign.update({
      where: { id: String(req.params.id) },
      data: { status: 'ACTIVE' },
    })

    res.json(updated)
  }
)

/**
 * PATCH /campaigns/:id/close
 * Clôturer une campagne (ACTIVE → CLOSED)
 */
router.patch(
  '/:id/close',
  authenticate,
  requireRole('MANAGER', 'SUPER_ADMIN'),
  async (req: Request, res: Response) => {
    const campaign = await prisma.campaign.findUnique({ where: { id: String(req.params.id) } })

    if (!campaign) {
      res.status(404).json({ error: 'Campagne introuvable' })
      return
    }

    if (req.user!.role !== 'SUPER_ADMIN' && campaign.gicId !== req.user!.gicId) {
      res.status(403).json({ error: 'Accès refusé' })
      return
    }

    // Vérifier qu'il n'y a pas de paiements en cours
    const pendingBatch = await prisma.paymentBatch.findFirst({
      where: { campaignId: campaign.id, status: { in: ['PENDING', 'PROCESSING'] } },
    })

    if (pendingBatch) {
      res.status(409).json({ error: 'Des paiements sont en cours, clôture impossible' })
      return
    }

    const updated = await prisma.campaign.update({
      where: { id: String(req.params.id) },
      data: { status: 'CLOSED', endDate: new Date() },
    })

    res.json(updated)
  }
)

/**
 * POST /campaigns/:id/price-rules
 * Ajouter ou modifier un prix (effectif immédiatement ou à une date future)
 */
router.post(
  '/:id/price-rules',
  authenticate,
  requireRole('MANAGER', 'SUPER_ADMIN'),
  validate(addPriceRuleSchema),
  async (req: Request, res: Response) => {
    const campaign = await prisma.campaign.findUnique({ where: { id: String(req.params.id) } })

    if (!campaign) {
      res.status(404).json({ error: 'Campagne introuvable' })
      return
    }

    if (req.user!.role !== 'SUPER_ADMIN' && campaign.gicId !== req.user!.gicId) {
      res.status(403).json({ error: 'Accès refusé' })
      return
    }

    const priceRule = await prisma.priceRule.create({
      data: {
        campaignId: campaign.id,
        ...req.body,
        effectiveFrom: req.body.effectiveFrom ?? new Date(),
      },
    })

    res.status(201).json(priceRule)
  }
)

/**
 * GET /campaigns/:id
 * Détails d'une campagne avec ses prix et stats
 */
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  const campaign = await prisma.campaign.findUnique({
    where: { id: String(req.params.id) },
    include: {
      priceRules: { orderBy: [{ culture: 'asc' }, { effectiveFrom: 'desc' }] },
      _count: {
        select: { deliveries: true, paymentBatches: true },
      },
    },
  })

  if (!campaign) {
    res.status(404).json({ error: 'Campagne introuvable' })
    return
  }

  if (req.user!.role !== 'SUPER_ADMIN' && campaign.gicId !== req.user!.gicId) {
    res.status(403).json({ error: 'Accès refusé' })
    return
  }

  res.json(campaign)
})

export default router
