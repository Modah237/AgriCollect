import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { authenticate, requireRole } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { getPaymentQueue } from '../queues/paymentQueue'
import { verifyWebhookSignature } from '../services/campay'
import { sendPaymentConfirmation, sendPaymentFailure } from '../services/sms'

export const paymentsRouter = Router()

// ─── Schémas de validation ────────────────────────────────────────────────────

const createBatchSchema = z.object({
  campaignId: z.string().cuid(),
  producerIds: z.array(z.string().cuid()).min(1).max(500),
})

// ─── POST /payments/batches — Initier un paiement en masse ───────────────────

paymentsRouter.post(
  '/batches',
  authenticate,
  requireRole('MANAGER', 'TREASURER'),
  validate(createBatchSchema),
  async (req: Request, res: Response) => {
    const { campaignId, producerIds } = req.body as z.infer<typeof createBatchSchema>
    const user = (req as any).user

    try {
      // Vérifier que la campagne appartient au GIC de l'utilisateur
      const campaign = await prisma.campaign.findFirst({
        where: { id: campaignId, gicId: user.gicId, status: 'ACTIVE' },
      })
      if (!campaign) {
        res.status(404).json({ error: 'Campaign not found or not active' })
        return
      }

      // Calculer les montants dus à chaque producteur (netDue des livraisons non payées)
      const deliveryTotals = await prisma.delivery.groupBy({
        by: ['producerId'],
        where: {
          campaignId,
          producerId: { in: producerIds },
        },
        _sum: { netDue: true },
      })

      if (deliveryTotals.length === 0) {
        res.status(400).json({ error: 'No deliveries found for these producers in this campaign' })
        return
      }

      // Vérifier que les producteurs ont bien un numéro MoMo
      const producers = await prisma.producer.findMany({
        where: { id: { in: producerIds }, gicId: user.gicId, isActive: true },
        select: { id: true, phoneMomo: true, fullName: true },
      })

      const producerMap = new Map(producers.map((p) => [p.id, p]))

      // Calculer le total du batch
      const totalAmount = deliveryTotals.reduce((sum, d) => sum + Number(d._sum.netDue ?? 0), 0)

      // Créer le batch + les lignes en transaction
      const batch = await prisma.$transaction(async (tx) => {
        const newBatch = await tx.paymentBatch.create({
          data: {
            campaignId,
            initiatedById: user.userId,
            totalAmount,
            status: 'PENDING',
          },
        })

        const lines = deliveryTotals
          .filter((d) => producerMap.has(d.producerId) && Number(d._sum.netDue) > 0)
          .map((d) => ({
            batchId: newBatch.id,
            producerId: d.producerId,
            amount: Number(d._sum.netDue),
            status: 'PENDING' as const,
          }))

        await tx.paymentLine.createMany({ data: lines })

        return newBatch
      })

      // Envoyer le job au worker BullMQ
      await getPaymentQueue().add('process-batch', { batchId: batch.id }, { jobId: batch.id })

      res.status(201).json({
        batchId: batch.id,
        totalAmount,
        linesCount: deliveryTotals.length,
        status: 'PENDING',
        message: 'Batch créé, paiements en cours de traitement',
      })
    } catch (err: any) {
      console.error('POST /payments/batches error:', err)
      res.status(500).json({ error: 'Internal server error' })
    }
  }
)

// ─── GET /payments/batches — Lister les batches d'un GIC ─────────────────────

paymentsRouter.get('/batches', authenticate, async (req: Request, res: Response) => {
  const user = (req as any).user
  const { campaignId } = req.query

  try {
    const batches = await prisma.paymentBatch.findMany({
      where: {
        campaign: { gicId: user.gicId },
        ...(campaignId ? { campaignId: campaignId as string } : {}),
      },
      include: {
        initiatedBy: { select: { fullName: true } },
        _count: { select: { lines: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    res.json(batches)
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ─── GET /payments/batches/:id — Statut détaillé d'un batch ──────────────────

paymentsRouter.get('/batches/:id', authenticate, async (req: Request, res: Response) => {
  const user = (req as any).user
  const batchId = String(req.params.id)

  type BatchWithLines = Prisma.PaymentBatchGetPayload<{
    include: {
      lines: { include: { producer: { select: { fullName: true; phoneMomo: true } } } }
      initiatedBy: { select: { fullName: true } }
    }
  }>

  try {
    const batch: BatchWithLines | null = await prisma.paymentBatch.findFirst({
      where: { id: batchId, campaign: { gicId: user.gicId } },
      include: {
        lines: {
          include: { producer: { select: { fullName: true, phoneMomo: true } } },
          orderBy: { createdAt: 'asc' },
        },
        initiatedBy: { select: { fullName: true } },
      },
    })

    if (!batch) {
      res.status(404).json({ error: 'Batch not found' })
      return
    }

    // Statistiques rapides
    const stats = {
      pending: batch.lines.filter((l: any) => l.status === 'PENDING').length,
      submitted: batch.lines.filter((l: any) => l.status === 'SUBMITTED').length,
      confirmed: batch.lines.filter((l: any) => l.status === 'CONFIRMED').length,
      failed: batch.lines.filter((l: any) => l.status === 'FAILED').length,
      total: batch.lines.length,
    }

    res.json({ ...batch, stats })
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ─── POST /payments/webhook/campay — Recevoir les confirmations Campay ───────
// Route PUBLIQUE — authentifiée par signature HMAC

paymentsRouter.post(
  '/webhook/campay',
  async (req: Request, res: Response) => {
    // Vérifier la signature HMAC
    const signature = req.headers['x-campay-signature'] as string || ''
    const rawBody = JSON.stringify(req.body)

    if (!verifyWebhookSignature(rawBody, signature)) {
      res.status(401).json({ error: 'Invalid signature' })
      return
    }

    const { reference, status, external_reference } = req.body

    // external_reference = paymentLine.id (posé lors du collectPayment)
    if (!external_reference || !status) {
      res.status(400).json({ error: 'Missing fields' })
      return
    }

    try {
      const line = await prisma.paymentLine.findUnique({
        where: { id: external_reference },
        include: { producer: true },
      })

      if (!line) {
        res.status(404).json({ error: 'PaymentLine not found' })
        return
      }

      if (status === 'SUCCESSFUL') {
        await prisma.paymentLine.update({
          where: { id: line.id },
          data: {
            status: 'CONFIRMED',
            campayTxRef: reference,
            confirmedAt: new Date(),
          },
        })
        await sendPaymentConfirmation(
          line.producer.phoneMomo,
          Number(line.amount),
          line.producer.fullName
        ).catch(console.error)
      } else if (status === 'FAILED') {
        await prisma.paymentLine.update({
          where: { id: line.id },
          data: {
            status: 'FAILED',
            campayTxRef: reference,
            failureReason: req.body.message || 'Payment failed',
          },
        })
        await sendPaymentFailure(
          line.producer.phoneMomo,
          Number(line.amount),
          line.producer.fullName
        ).catch(console.error)
      }

      res.json({ received: true })
    } catch (err) {
      console.error('Campay webhook error:', err)
      res.status(500).json({ error: 'Internal server error' })
    }
  }
)
