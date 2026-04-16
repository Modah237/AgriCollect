import { Router, Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { authenticate, requireRole } from '../middleware/auth'
import { generateCampaignPDF, ReportData } from '../services/pdfGenerator'

const router = Router()

router.use(authenticate)

// ─── GET /reports/campaign/:id — Données JSON du rapport ──────────────────────

router.get(
  '/campaign/:id',
  requireRole('MANAGER', 'TREASURER', 'SUPER_ADMIN'),
  async (req: Request, res: Response) => {
    const campaignId = String(req.params.id)

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { gic: { select: { id: true, name: true } } },
    })

    if (!campaign) {
      res.status(404).json({ error: 'Campagne introuvable' })
      return
    }

    if (req.user!.role !== 'SUPER_ADMIN' && campaign.gicId !== req.user!.gicId) {
      res.status(403).json({ error: 'Accès refusé à cette campagne' })
      return
    }

    // Utilisation de any temporairement pour contourner l'erreur de Namespace Prisma sur Vercel
    type DeliveryWithRelations = any

    const deliveries: DeliveryWithRelations[] = await prisma.delivery.findMany({
      where: { campaignId },
      include: {
        producer: { select: { fullName: true, phoneMomo: true } },
        collector: { select: { fullName: true } },
      },
      orderBy: { createdOfflineAt: 'asc' },
    })

    // Agrégats par producteur
    const byProducer = deliveries.reduce<Record<string, {
      producerName: string
      phoneMomo: string
      totalKg: number
      totalBrut: number
      totalAvances: number
      totalNet: number
      livraisons: number
    }>>((acc, d) => {
      const key = d.producerId
      if (!acc[key]) {
        acc[key] = {
          producerName: d.producer.fullName,
          phoneMomo: d.producer.phoneMomo,
          totalKg: 0,
          totalBrut: 0,
          totalAvances: 0,
          totalNet: 0,
          livraisons: 0,
        }
      }
      acc[key].totalKg += Number(d.quantityKg)
      acc[key].totalBrut += d.calculatedAmount
      acc[key].totalAvances += d.advanceDeducted
      acc[key].totalNet += d.netDue
      acc[key].livraisons += 1
      return acc
    }, {})

    res.json({
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        startDate: campaign.startDate,
        endDate: campaign.endDate,
      },
      gic: campaign.gic,
      summary: {
        totalDeliveries: deliveries.length,
        totalKg: deliveries.reduce((s, d) => s + Number(d.quantityKg), 0),
        totalBrut: deliveries.reduce((s, d) => s + d.calculatedAmount, 0),
        totalAvances: deliveries.reduce((s, d) => s + d.advanceDeducted, 0),
        totalNet: deliveries.reduce((s, d) => s + d.netDue, 0),
        activeProducers: Object.keys(byProducer).length,
      },
      byProducer: Object.values(byProducer),
      deliveries: deliveries.map((d) => ({
        id: d.id,
        producerName: d.producer.fullName,
        collectorName: d.collector?.fullName ?? null,
        culture: d.culture,
        qualityGrade: d.qualityGrade,
        quantityKg: Number(d.quantityKg),
        pricePerKg: d.pricePerKg,
        calculatedAmount: d.calculatedAmount,
        advanceDeducted: d.advanceDeducted,
        netDue: d.netDue,
        createdAt: d.createdOfflineAt,
      })),
    })
  }
)

// ─── POST /reports/campaign/:id/export — Générer et télécharger le PDF ────────

router.post(
  '/campaign/:id/export',
  requireRole('MANAGER', 'TREASURER', 'SUPER_ADMIN'),
  async (req: Request, res: Response) => {
    const campaignId = String(req.params.id)

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { gic: { select: { name: true } } },
    })

    if (!campaign) {
      res.status(404).json({ error: 'Campagne introuvable' })
      return
    }

    if (req.user!.role !== 'SUPER_ADMIN' && campaign.gicId !== req.user!.gicId) {
      res.status(403).json({ error: 'Accès refusé à cette campagne' })
      return
    }

    type DeliveryWithProducer = any

    const deliveries: DeliveryWithProducer[] = await prisma.delivery.findMany({
      where: { campaignId },
      include: { producer: { select: { fullName: true } } },
      orderBy: { createdOfflineAt: 'asc' },
    })

    const reportData: ReportData = {
      gicName: campaign.gic.name,
      campaignName: campaign.name,
      campaignStart: campaign.startDate,
      campaignEnd: campaign.endDate,
      exportedAt: new Date(),
      deliveries: deliveries.map((d) => ({
        producerName: d.producer.fullName,
        culture: d.culture,
        qualityGrade: d.qualityGrade,
        quantityKg: Number(d.quantityKg),
        pricePerKg: d.pricePerKg,
        calculatedAmount: d.calculatedAmount,
        advanceDeducted: d.advanceDeducted,
        netDue: d.netDue,
        createdAt: d.createdOfflineAt,
      })),
    }

    try {
      const pdfBuffer = await generateCampaignPDF(reportData)

      const filename = `AgriCollect_${campaign.name.replace(/\s+/g, '_')}_${
        new Date().toISOString().slice(0, 10)
      }.pdf`

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(pdfBuffer.length),
      })

      res.send(pdfBuffer)
    } catch (err) {
      console.error('[Reports] Erreur génération PDF:', err)
      res.status(500).json({ error: 'Erreur lors de la génération du PDF' })
    }
  }
)

export default router
