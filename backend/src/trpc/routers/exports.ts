import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { Prisma } from '@prisma/client';
import { logger } from '../../lib/logger';

export const exportsRouter = router({
  getCampaignExportData: protectedProcedure
    .input(z.object({ campaignId: z.string() }))
    .query(async ({ input, ctx }) => {
      const campaign = await ctx.prisma.campaign.findUnique({
        where: { id: input.campaignId },
        include: { gic: { select: { name: true } } },
      });

      if (!campaign) throw new TRPCError({ code: 'NOT_FOUND' });

      if (ctx.user.role !== 'SUPER_ADMIN' && campaign.gicId !== ctx.user.gicId) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      const deliveries = await ctx.prisma.delivery.findMany({
        where: { campaignId: input.campaignId },
        include: {
          producer: { select: { fullName: true, phoneMomo: true, momoOperator: true } },
          collector: { select: { fullName: true } },
        },
        orderBy: { createdOfflineAt: 'asc' },
      });

      return {
        campaignName: campaign.name,
        gicName: campaign.gic.name,
        deliveries: deliveries.map((d) => ({
          id: d.id,
          date: d.createdOfflineAt,
          producer: d.producer.fullName,
          phoneMomo: d.producer.phoneMomo,
          operator: d.producer.momoOperator,
          collector: d.collector?.fullName,
          culture: d.culture,
          grade: d.qualityGrade,
          quantityKg: Number(d.quantityKg),
          pricePerKg: d.pricePerKg,
          brut: d.calculatedAmount,
          net: d.netDue,
        })),
      };
    }),

  exportCampaignCsv: protectedProcedure
    .input(z.object({ campaignId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const campaignId = input.campaignId;

      const campaign = await ctx.prisma.campaign.findUnique({
        where: { id: campaignId },
        include: { gic: { select: { name: true } } },
      });

      if (!campaign) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Campagne introuvable' });
      }

      if (ctx.user.role !== 'SUPER_ADMIN' && campaign.gicId !== ctx.user.gicId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Accès refusé à cette campagne' });
      }

      type DeliveryWithRelations = Prisma.DeliveryGetPayload<{
        include: {
          producer: { select: { fullName: true; phoneMomo: true; momoOperator: true } };
          collector: { select: { fullName: true } };
        };
      }>;

      const deliveries: DeliveryWithRelations[] = await ctx.prisma.delivery.findMany({
        where: { campaignId },
        include: {
          producer: { select: { fullName: true, phoneMomo: true, momoOperator: true } },
          collector: { select: { fullName: true } },
        },
        orderBy: { createdOfflineAt: 'asc' },
      });

      const BOM = '\uFEFF';
      const headers = [
        'ID', 'Date livraison', 'Producteur', 'Téléphone MoMo', 'Opérateur', 'Collecteur',
        'Culture', 'Grade', 'Poids (kg)', 'Prix/kg (XAF)', 'Montant brut (XAF)',
        'Avance déduite (XAF)', 'Net dû (XAF)',
      ];

      const escape = (val: string | number | null | undefined): string => {
        if (val === null || val === undefined) return '';
        const str = String(val);
        if (str.includes(';') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const rows = deliveries.map((d) => [
        escape(d.id), escape(new Intl.DateTimeFormat('fr-FR').format(d.createdOfflineAt)),
        escape(d.producer.fullName), escape(d.producer.phoneMomo), escape(d.producer.momoOperator),
        escape(d.collector?.fullName), escape(d.culture), escape(d.qualityGrade),
        escape(Number(d.quantityKg)), escape(d.pricePerKg), escape(d.calculatedAmount),
        escape(d.advanceDeducted), escape(d.netDue),
      ]);

      const csv = BOM + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');

      return {
        filename: `AgriCollect_${campaign.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`,
        data: csv,
        contentType: 'text/csv; charset=utf-8',
      };
    }),
});
