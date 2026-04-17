import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';

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
});
