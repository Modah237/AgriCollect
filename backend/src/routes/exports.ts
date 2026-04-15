import { Router, Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { authenticate, requireRole } from '../middleware/auth'

const router = Router()

router.use(authenticate)

// ─── GET /exports/campaign/:id/csv — Export CSV livraisons ───────────────────

router.get(
  '/campaign/:id/csv',
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

    type DeliveryWithRelations = Prisma.DeliveryGetPayload<{
      include: {
        producer: { select: { fullName: true; phoneMomo: true; momoOperator: true } }
        collector: { select: { fullName: true } }
      }
    }>

    const deliveries: DeliveryWithRelations[] = await prisma.delivery.findMany({
      where: { campaignId },
      include: {
        producer: { select: { fullName: true, phoneMomo: true, momoOperator: true } },
        collector: { select: { fullName: true } },
      },
      orderBy: { createdOfflineAt: 'asc' },
    })

    // ── Construction CSV (UTF-8 BOM pour Excel) ───────────────────────────────

    const BOM = '\uFEFF'

    const headers = [
      'ID',
      'Date livraison',
      'Producteur',
      'Téléphone MoMo',
      'Opérateur',
      'Collecteur',
      'Culture',
      'Grade',
      'Poids (kg)',
      'Prix/kg (XAF)',
      'Montant brut (XAF)',
      'Avance déduite (XAF)',
      'Net dû (XAF)',
    ]

    const escape = (val: string | number | null | undefined): string => {
      if (val === null || val === undefined) return ''
      const str = String(val)
      if (str.includes(';') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    const rows = deliveries.map((d) => [
      escape(d.id),
      escape(new Intl.DateTimeFormat('fr-FR').format(d.createdOfflineAt)),
      escape(d.producer.fullName),
      escape(d.producer.phoneMomo),
      escape(d.producer.momoOperator),
      escape(d.collector?.fullName),
      escape(d.culture),
      escape(d.qualityGrade),
      escape(Number(d.quantityKg)),
      escape(d.pricePerKg),
      escape(d.calculatedAmount),
      escape(d.advanceDeducted),
      escape(d.netDue),
    ])

    // Séparateur « ; » — standard pour Excel francophone
    const csv =
      BOM +
      [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n')

    const filename = `AgriCollect_${campaign.name.replace(/\s+/g, '_')}_${
      new Date().toISOString().slice(0, 10)
    }.csv`

    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    })

    res.send(csv)
  }
)

export default router
