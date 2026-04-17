import { z } from 'zod';
import { router, protectedProcedure, publicProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';

export const gicRouter = router({
  getProfile: protectedProcedure
    .input(z.object({ gicId: z.string() }))
    .query(async ({ input, ctx }) => {
      // Security check: MANAGER/TREASURER can only see their own GIC
      if (ctx.user.role !== 'SUPER_ADMIN' && ctx.user.gicId !== input.gicId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Accès refusé à ce GIC' });
      }

      const gic = await ctx.prisma.gic.findUnique({
        where: { id: input.gicId },
        select: {
          id: true,
          name: true,
          region: true,
          cultureTypes: true,
          planTier: true,
          phone: true,
          email: true,
          isActive: true,
          _count: {
            select: {
              producers: { where: { isActive: true } },
              campaigns: true,
            },
          },
        },
      });

      if (!gic) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'GIC introuvable' });
      }

      return gic;
    }),

  getStats: protectedProcedure
    .input(z.object({ gicId: z.string() }))
    .query(async ({ input, ctx }) => {
      if (ctx.user.role !== 'SUPER_ADMIN' && ctx.user.gicId !== input.gicId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Accès refusé' });
      }

      const activeCampaign = await ctx.prisma.campaign.findFirst({
        where: { gicId: input.gicId, status: 'ACTIVE' },
      });

      const producersCount = await ctx.prisma.producer.count({
        where: { gicId: input.gicId, isActive: true },
      });

      if (!activeCampaign) {
        return {
          producersCount,
          totalKg: 0,
          totalAmount: 0,
          deliveriesCount: 0,
          campaignName: 'Aucune campagne active',
        };
      }

      const stats = await ctx.prisma.delivery.aggregate({
        where: { campaignId: activeCampaign.id },
        _sum: {
          quantityKg: true,
          calculatedAmount: true,
          netDue: true,
        },
        _count: { id: true },
      });

      return {
        producersCount,
        totalKg: Number(stats._sum.quantityKg || 0),
        totalAmount: stats._sum.calculatedAmount || 0,
        totalNetDue: stats._sum.netDue || 0,
        deliveriesCount: stats._count.id || 0,
        campaignName: activeCampaign.name,
      };
    }),

  getActiveCampaign: protectedProcedure
    .input(z.object({ gicId: z.string() }))
    .query(async ({ input, ctx }) => {
      if (ctx.user.role !== 'SUPER_ADMIN' && ctx.user.gicId !== input.gicId) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      return ctx.prisma.campaign.findFirst({
        where: { gicId: input.gicId, status: 'ACTIVE' },
        include: {
          priceRules: { orderBy: { effectiveFrom: 'desc' } },
        },
      });
    }),

  getProducers: protectedProcedure
    .input(z.object({ gicId: z.string() }))
    .query(async ({ input, ctx }) => {
      if (ctx.user.role !== 'SUPER_ADMIN' && ctx.user.gicId !== input.gicId) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      return ctx.prisma.producer.findMany({
        where: { gicId: input.gicId, isActive: true },
        select: {
          id: true,
          fullName: true,
          phoneMomo: true,
          phoneSms: true,
          momoOperator: true,
        },
        orderBy: { fullName: 'asc' },
      });
    }),

  /**
   * Récupère la campagne active d'un GIC
   */
  getActiveCampaign: protectedProcedure
    .input(z.object({ gicId: z.string() }))
    .query(async ({ input, ctx }) => {
      if (ctx.user.role !== 'SUPER_ADMIN' && ctx.user.gicId !== input.gicId) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      const campaign = await ctx.prisma.campaign.findFirst({
        where: { gicId: input.gicId, status: 'ACTIVE' },
        include: {
          priceRules: { orderBy: { culture: 'asc' } },
        },
      });

      return campaign;
    }),
});
