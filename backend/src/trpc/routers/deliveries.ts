import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { logger } from '../../lib/logger';

const deliverySchema = z.object({
  offlineUuid: z.string().uuid(),
  deviceId: z.string().min(1),
  campaignId: z.string().min(1),
  producerId: z.string().min(1),
  culture: z.string().min(1),
  quantityKg: z.number().positive(),
  qualityGrade: z.enum(['A', 'B', 'C']).default('A'),
  photoUrl: z.string().url().optional(),
  notes: z.string().max(500).optional(),
  createdOfflineAt: z.coerce.date(),
});

export const deliveriesRouter = router({
  sync: protectedProcedure
    .input(z.object({
      deliveries: z.array(deliverySchema).min(1).max(100),
    }))
    .mutation(async ({ input, ctx }) => {
      const results: Array<{ 
        offlineUuid: string; 
        status: 'created' | 'duplicate' | 'error'; 
        error?: string;
      }> = [];

      for (const delivery of input.deliveries) {
        try {
          // Idempotency check
          const existing = await ctx.prisma.delivery.findUnique({
            where: { offlineUuid: delivery.offlineUuid },
          });

          if (existing) {
            results.push({ offlineUuid: delivery.offlineUuid, status: 'duplicate' });
            continue;
          }

          // Fetch campaign and price
          const campaign = await ctx.prisma.campaign.findUnique({
            where: { id: delivery.campaignId },
          });

          if (!campaign || campaign.status !== 'ACTIVE') {
            results.push({ offlineUuid: delivery.offlineUuid, status: 'error', error: 'Campagne inactive' });
            continue;
          }

          const priceRule = await ctx.prisma.priceRule.findFirst({
            where: {
              campaignId: delivery.campaignId,
              culture: delivery.culture,
              qualityGrade: delivery.qualityGrade,
              effectiveFrom: { lte: delivery.createdOfflineAt },
            },
            orderBy: { effectiveFrom: 'desc' },
          });

          if (!priceRule) {
            results.push({ offlineUuid: delivery.offlineUuid, status: 'error', error: 'Prix non défini' });
            continue;
          }

          const calculatedAmount = Math.round(delivery.quantityKg * priceRule.pricePerKg);

          // Atomic transaction
          await ctx.prisma.$transaction(async (tx) => {
            await tx.delivery.create({
              data: {
                ...delivery,
                collectorId: ctx.user.userId,
                pricePerKg: priceRule.pricePerKg,
                calculatedAmount,
                netDue: calculatedAmount,
                syncedAt: new Date(),
              },
            });
          });

          results.push({ offlineUuid: delivery.offlineUuid, status: 'created' });
        } catch (err: any) {
          logger.error({ err, offlineUuid: delivery.offlineUuid }, 'Sync delivery error');
          results.push({ offlineUuid: delivery.offlineUuid, status: 'error', error: 'Server error' });
        }
      }

      return {
        total: input.deliveries.length,
        created: results.filter(r => r.status === 'created').length,
        duplicates: results.filter(r => r.status === 'duplicate').length,
        results,
      };
    }),

  list: protectedProcedure
    .input(z.object({
      campaignId: z.string().optional(),
      producerId: z.string().optional(),
      page: z.number().default(1),
      limit: z.number().default(50),
    }))
    .query(async ({ input, ctx }) => {
      const skip = (input.page - 1) * input.limit;
      const where: any = {
        campaign: { gicId: ctx.user.gicId },
      };

      if (input.campaignId) where.campaignId = input.campaignId;
      if (input.producerId) where.producerId = input.producerId;

      const [data, total] = await Promise.all([
        ctx.prisma.delivery.findMany({
          where,
          include: {
            producer: { select: { fullName: true } },
            collector: { select: { fullName: true } },
          },
          orderBy: { createdOfflineAt: 'desc' },
          skip,
          take: input.limit,
        }),
        ctx.prisma.delivery.count({ where }),
      ]);

      return {
        data,
        pagination: {
          total,
          pages: Math.ceil(total / input.limit),
        },
      };
    }),
});
