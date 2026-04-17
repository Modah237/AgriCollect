import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { getPaymentQueue } from '../../queues/paymentQueue';

export const paymentsRouter = router({
  createBatch: protectedProcedure
    .input(z.object({
      campaignId: z.string().cuid(),
      producerIds: z.array(z.string().cuid()).min(1).max(500),
    }))
    .mutation(async ({ input, ctx }) => {
      // Security: Only MANAGER/TREASURER of the same GIC
      if (!['MANAGER', 'TREASURER', 'SUPER_ADMIN'].includes(ctx.user.role)) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      const campaign = await ctx.prisma.campaign.findFirst({
        where: { id: input.campaignId, gicId: ctx.user.gicId, status: 'ACTIVE' },
      });

      if (!campaign) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Campagne active introuvable' });
      }

      // Calculer les montants dus (netDue des livraisons non payées)
      const deliveryTotals = await ctx.prisma.delivery.groupBy({
        by: ['producerId'],
        where: {
          campaignId: input.campaignId,
          producerId: { in: input.producerIds },
        },
        _sum: { netDue: true },
      });

      if (deliveryTotals.length === 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Aucune livraison à payer pour ces producteurs' });
      }

      const producers = await ctx.prisma.producer.findMany({
        where: { id: { in: input.producerIds }, gicId: ctx.user.gicId, isActive: true },
        select: { id: true },
      });
      const validProducerIds = new Set(producers.map(p => p.id));

      const totalAmount = deliveryTotals.reduce((sum, d) => sum + Number(d._sum.netDue ?? 0), 0);

      const batch = await ctx.prisma.$transaction(async (tx) => {
        const newBatch = await tx.paymentBatch.create({
          data: {
            campaignId: input.campaignId,
            initiatedById: ctx.user.userId,
            totalAmount,
            status: 'PENDING',
          },
        });

        const lines = deliveryTotals
          .filter(d => validProducerIds.has(d.producerId) && Number(d._sum.netDue) > 0)
          .map(d => ({
            batchId: newBatch.id,
            producerId: d.producerId,
            amount: Number(d._sum.netDue),
            status: 'PENDING' as const,
          }));

        await tx.paymentLine.createMany({ data: lines });
        return newBatch;
      });

      // Ajouter à la file BullMQ
      await getPaymentQueue().add('process-batch', { batchId: batch.id }, { jobId: batch.id });

      return {
        batchId: batch.id,
        totalAmount,
        linesCount: deliveryTotals.length,
      };
    }),

  getBatches: protectedProcedure
    .input(z.object({ campaignId: z.string().optional() }))
    .query(async ({ input, ctx }) => {
      return ctx.prisma.paymentBatch.findMany({
        where: {
          campaign: { gicId: ctx.user.gicId },
          ...(input.campaignId ? { campaignId: input.campaignId } : {}),
        },
        include: {
          initiatedBy: { select: { fullName: true } },
          _count: { select: { lines: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    }),

  getBatchDetails: protectedProcedure
    .input(z.object({ batchId: z.string() }))
    .query(async ({ input, ctx }) => {
      const batch = await ctx.prisma.paymentBatch.findFirst({
        where: { id: input.batchId, campaign: { gicId: ctx.user.gicId } },
        include: {
          lines: {
            include: { producer: { select: { fullName: true, phoneMomo: true } } },
            orderBy: { createdAt: 'asc' },
          },
          initiatedBy: { select: { fullName: true } },
        },
      });

      if (!batch) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      return batch;
    }),
});
