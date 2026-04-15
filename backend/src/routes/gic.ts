import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, requireRole, requireSameGic } from '../middleware/auth'
import { validate } from '../middleware/validate'

const router = Router()

// ─── Schémas ─────────────────────────────────────────────────────────────────

const createGicSchema = z.object({
  name: z.string().min(2).max(100),
  region: z.string().min(2).max(100),
  cultureTypes: z.array(z.string()).min(1),
  planTier: z.enum(['STARTER', 'BUSINESS', 'PRO']).default('STARTER'),
  phone: z.string().optional(),
  email: z.string().email().optional(),
})

const updateGicSchema = createGicSchema.partial()

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * GET /gic/:gicId
 * Profil du GIC — accessible au gestionnaire/trésorier de ce GIC
 */
router.get(
  '/:gicId',
  authenticate,
  requireSameGic,
  async (req: Request, res: Response) => {
    const gic = await prisma.gic.findUnique({
      where: { id: String(req.params.gicId) },
      select: {
        id: true,
        name: true,
        region: true,
        cultureTypes: true,
        planTier: true,
        phone: true,
        email: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: {
            producers: { where: { isActive: true } },
            campaigns: true,
          },
        },
      },
    })

    if (!gic) {
      res.status(404).json({ error: 'GIC introuvable' })
      return
    }

    res.json(gic)
  }
)

/**
 * POST /gic
 * Créer un nouveau GIC — réservé SUPER_ADMIN
 */
router.post(
  '/',
  authenticate,
  requireRole('SUPER_ADMIN'),
  validate(createGicSchema),
  async (req: Request, res: Response) => {
    const gic = await prisma.gic.create({ data: req.body })
    res.status(201).json(gic)
  }
)

/**
 * PATCH /gic/:gicId
 * Mettre à jour un GIC — MANAGER ou SUPER_ADMIN
 */
router.patch(
  '/:gicId',
  authenticate,
  requireRole('MANAGER', 'SUPER_ADMIN'),
  requireSameGic,
  validate(updateGicSchema),
  async (req: Request, res: Response) => {
    const gic = await prisma.gic.update({
      where: { id: String(req.params.gicId) },
      data: req.body,
    })
    res.json(gic)
  }
)

/**
 * GET /gic/:gicId/campaign
 * Campagne active du GIC
 */
router.get(
  '/:gicId/campaign',
  authenticate,
  requireSameGic,
  async (req: Request, res: Response) => {
    const campaign = await prisma.campaign.findFirst({
      where: {
        gicId: String(req.params.gicId),
        status: 'ACTIVE',
      },
      include: {
        priceRules: {
          orderBy: { effectiveFrom: 'desc' },
        },
      },
    })

    if (!campaign) {
      res.status(404).json({ error: 'Aucune campagne active' })
      return
    }

    res.json(campaign)
  }
)

/**
 * GET /gic/:gicId/producers
 * Liste des producteurs (utilisé pour sync mobile)
 */
router.get(
  '/:gicId/producers',
  authenticate,
  requireSameGic,
  async (req: Request, res: Response) => {
    const producers = await prisma.producer.findMany({
      where: {
        gicId: String(req.params.gicId),
        isActive: true,
      },
      select: {
        id: true,
        fullName: true,
        phoneMomo: true,
        phoneSms: true,
        momoOperator: true,
      },
      orderBy: { fullName: 'asc' },
    })

    res.json(producers)
  }
)

/**
 * GET /gic/:gicId/price-rules
 * Prix actuels du GIC (sync mobile)
 */
router.get(
  '/:gicId/price-rules',
  authenticate,
  requireSameGic,
  async (req: Request, res: Response) => {
    const activeCampaign = await prisma.campaign.findFirst({
      where: { gicId: String(req.params.gicId), status: 'ACTIVE' },
    })

    if (!activeCampaign) {
      res.json([])
      return
    }

    // Pour chaque culture+qualité, prendre la règle de prix la plus récente
    const priceRules = await prisma.priceRule.findMany({
      where: { campaignId: activeCampaign.id },
      orderBy: { effectiveFrom: 'desc' },
    })

    res.json(priceRules)
  }
)

export default router
