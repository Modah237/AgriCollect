import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';

export const campaignsRouter = router({
  create: protectedProcedure
    .input(z.object({
      gicId: z.string().min(1),
      name: z.string().min(2).max(200),
      startDate: z.coerce.date(),
      endDate: z.coerce.date().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // MANAGER/SUPER_ADMIN check
      if (ctx.user.role !== 'SUPER_ADMIN' && input.gicId !== ctx.user.gicId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Accès refusé à ce GIC' });
      }

      // Une seule campagne ACTIVE par GIC à la fois
      const existingActive = await ctx.prisma.campaign.findFirst({
        where: { gicId: input.gicId, status: 'ACTIVE' },
      });

      if (existingActive) {
        throw new TRPCError({ 
          code: 'CONFLICT', 
          message: 'Une campagne est déjà active pour ce GIC' 
        });
      }

      return ctx.prisma.campaign.create({
        data: { ...input, status: 'DRAFT' },
      });
    }),

  activate: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const campaign = await ctx.prisma.campaign.findUnique({ where: { id: input.id } });
      if (!campaign) throw new TRPCError({ code: 'NOT_FOUND' });

      if (ctx.user.role !== 'SUPER_ADMIN' && campaign.gicId !== ctx.user.gicId) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      const priceRuleCount = await ctx.prisma.priceRule.count({ where: { campaignId: campaign.id } });
      if (priceRuleCount === 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Définir au moins un prix' });
      }

      return ctx.prisma.campaign.update({
        where: { id: input.id },
        data: { status: 'ACTIVE' },
      });
    }),

  addPriceRule: protectedProcedure
    .input(z.object({
      campaignId: z.string(),
      culture: z.string().min(1),
      qualityGrade: z.enum(['A', 'B', 'C']).default('A'),
      pricePerKg: z.number().int().positive(),
      effectiveFrom: z.coerce.date().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const campaign = await ctx.prisma.campaign.findUnique({ where: { id: input.campaignId } });
      if (!campaign) throw new TRPCError({ code: 'NOT_FOUND' });

      if (ctx.user.role !== 'SUPER_ADMIN' && campaign.gicId !== ctx.user.gicId) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      return ctx.prisma.priceRule.create({
        data: {
          ...input,
          effectiveFrom: input.effectiveFrom ?? new Date(),
        },
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const campaign = await ctx.prisma.campaign.findUnique({
        where: { id: input.id },
        include: {
          priceRules: { orderBy: [{ culture: 'asc' }, { effectiveFrom: 'desc' }] },
          _count: { select: { deliveries: true, paymentBatches: true } },
        },
      });

      if (!campaign) throw new TRPCError({ code: 'NOT_FOUND' });

      if (ctx.user.role !== 'SUPER_ADMIN' && campaign.gicId !== ctx.user.gicId) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      return campaign;
    }),
});
