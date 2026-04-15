import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, requireRole } from '../middleware/auth'
import { validate } from '../middleware/validate'

const router = Router()

const createProducerSchema = z.object({
  gicId: z.string().min(1),
  fullName: z.string().min(2).max(100),
  phoneMomo: z.string().min(9).max(15),
  phoneSms: z.string().min(9).max(15).optional(),
  momoOperator: z.enum(['MTN', 'ORANGE']).default('MTN'),
})

const updateProducerSchema = createProducerSchema.omit({ gicId: true }).partial()

/**
 * POST /producers
 * Créer un producteur — MANAGER uniquement
 */
router.post(
  '/',
  authenticate,
  requireRole('MANAGER', 'SUPER_ADMIN'),
  validate(createProducerSchema),
  async (req: Request, res: Response) => {
    // Vérification que le gestionnaire appartient bien à ce GIC
    if (req.user!.role !== 'SUPER_ADMIN' && req.body.gicId !== req.user!.gicId) {
      res.status(403).json({ error: 'Accès refusé à ce GIC' })
      return
    }

    const producer = await prisma.producer.create({ data: req.body })
    res.status(201).json(producer)
  }
)

/**
 * GET /producers/:id
 * Fiche producteur avec ses livraisons et paiements
 */
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  const producer = await prisma.producer.findUnique({
    where: { id: String(req.params.id) },
    include: {
      deliveries: {
        orderBy: { createdOfflineAt: 'desc' },
        take: 50,
      },
      advances: {
        orderBy: { createdAt: 'desc' },
      },
      _count: {
        select: { paymentLines: { where: { status: 'CONFIRMED' } } },
      },
    },
  })

  if (!producer) {
    res.status(404).json({ error: 'Producteur introuvable' })
    return
  }

  // Vérification d'accès au GIC du producteur
  if (req.user!.role !== 'SUPER_ADMIN' && producer.gicId !== req.user!.gicId) {
    res.status(403).json({ error: 'Accès refusé' })
    return
  }

  res.json(producer)
})

/**
 * PATCH /producers/:id
 * Mettre à jour un producteur
 */
router.patch(
  '/:id',
  authenticate,
  requireRole('MANAGER', 'SUPER_ADMIN'),
  validate(updateProducerSchema),
  async (req: Request, res: Response) => {
    const producer = await prisma.producer.findUnique({ where: { id: String(req.params.id) } })

    if (!producer) {
      res.status(404).json({ error: 'Producteur introuvable' })
      return
    }

    if (req.user!.role !== 'SUPER_ADMIN' && producer.gicId !== req.user!.gicId) {
      res.status(403).json({ error: 'Accès refusé' })
      return
    }

    const updated = await prisma.producer.update({
      where: { id: String(req.params.id) },
      data: req.body,
    })

    res.json(updated)
  }
)

/**
 * DELETE /producers/:id
 * Désactiver un producteur (soft delete)
 */
router.delete(
  '/:id',
  authenticate,
  requireRole('MANAGER', 'SUPER_ADMIN'),
  async (req: Request, res: Response) => {
    const producer = await prisma.producer.findUnique({ where: { id: String(req.params.id) } })

    if (!producer) {
      res.status(404).json({ error: 'Producteur introuvable' })
      return
    }

    if (req.user!.role !== 'SUPER_ADMIN' && producer.gicId !== req.user!.gicId) {
      res.status(403).json({ error: 'Accès refusé' })
      return
    }

    await prisma.producer.update({
      where: { id: String(req.params.id) },
      data: { isActive: false },
    })

    res.json({ message: 'Producteur désactivé' })
  }
)

export default router
