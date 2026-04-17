import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';

export const reportsRouter = router({
  getCampaignReport: protectedProcedure
    .input(z.object({ campaignId: z.string() }))
    .query(async ({ input, ctx }) => {
      const campaign = await ctx.prisma.campaign.findUnique({
        where: { id: input.campaignId },
        include: { gic: { select: { id: true, name: true } } },
      });

      if (!campaign) throw new TRPCError({ code: 'NOT_FOUND', message: 'Campagne introuvable' });

      // MANAGER/SUPER_ADMIN check
      if (ctx.user.role !== 'SUPER_ADMIN' && campaign.gicId !== ctx.user.gicId) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      const deliveries = await ctx.prisma.delivery.findMany({
        where: { campaignId: input.campaignId },
        include: {
          producer: { select: { id: true, fullName: true, phoneMomo: true } },
          collector: { select: { id: true, fullName: true } },
        },
        orderBy: { createdOfflineAt: 'asc' },
      });

      // Agrégations par producteur
      const byProducer = deliveries.reduce<Record<string, any>>((acc, d) => {
        const key = d.producerId;
        if (!acc[key]) {
          acc[key] = {
            producerName: d.producer.fullName,
            phoneMomo: d.producer.phoneMomo,
            totalKg: 0,
            totalBrut: 0,
            totalNet: 0,
            livraisons: 0,
          };
        }
        acc[key].totalKg += Number(d.quantityKg);
        acc[key].totalBrut += d.calculatedAmount;
        acc[key].totalNet += d.netDue;
        acc[key].livraisons += 1;
        return acc;
      }, {});

      return {
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
          totalNet: deliveries.reduce((s, d) => s + d.netDue, 0),
          activeProducers: Object.keys(byProducer).length,
        },
        byProducer: Object.values(byProducer),
      };
    }),
});
