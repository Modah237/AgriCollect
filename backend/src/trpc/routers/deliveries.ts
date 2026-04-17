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
  qualityGrade: z.enum(['A', 'B', 'C']),
  photoUrl: z.string().optional(),
  notes: z.string().max(500).optional(),
  createdOfflineAt: z.coerce.date(),
});

export const deliveriesRouter = router({
  sync: protectedProcedure
    .input(z.object({
      deliveries: z.array(deliverySchema).min(1).max(100),
    }))
    .mutation(async ({ input, ctx }) => {
      const collectorId = ctx.user.userId;
      const gicId = ctx.user.gicId;
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

          // Vérifier la campagne
          const campaign = await ctx.prisma.campaign.findUnique({
            where: { id: delivery.campaignId },
          });

          if (!campaign || campaign.gicId !== gicId || campaign.status !== 'ACTIVE') {
            results.push({ offlineUuid: delivery.offlineUuid, status: 'error', error: 'Campagne invalide ou inactive' });
            continue;
          }

          // Vérifier le producteur
          const producer = await ctx.prisma.producer.findUnique({
            where: { id: delivery.producerId },
          });

          if (!producer || producer.gicId !== gicId || !producer.isActive) {
            results.push({ offlineUuid: delivery.offlineUuid, status: 'error', error: 'Producteur invalide' });
            continue;
          }

          // Récupérer la règle de prix applicable
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

          // Gestion des avances - déduction automatique
          const advances = await ctx.prisma.advance.findMany({
            where: {
              producerId: delivery.producerId,
              campaignId: delivery.campaignId,
              repaidAmount: { lt: ctx.prisma.advance.fields.amount }
            },
            orderBy: { createdAt: 'asc' }
          });

          const totalAvailableAdvance = advances.reduce(
            (sum, a) => sum + (a.amount - a.repaidAmount),
            0
          );

          const advanceDeducted = Math.min(totalAvailableAdvance, calculatedAmount);
          const netDue = calculatedAmount - advanceDeducted;

          // Transaction : Création + Déduction avances
          await ctx.prisma.$transaction(async (tx) => {
            await tx.delivery.create({
              data: {
                offlineUuid: delivery.offlineUuid,
                deviceId: delivery.deviceId,
                campaignId: delivery.campaignId,
                producerId: delivery.producerId,
                collectorId,
                culture: delivery.culture,
                quantityKg: delivery.quantityKg,
                qualityGrade: delivery.qualityGrade,
                photoUrl: delivery.photoUrl,
                notes: delivery.notes,
                pricePerKg: priceRule.pricePerKg,
                calculatedAmount,
                advanceDeducted,
                netDue,
                syncedAt: new Date(),
                createdOfflineAt: new Date(delivery.createdOfflineAt),
              },
            });

            if (advanceDeducted > 0) {
              let remaining = advanceDeducted;
              for (const adv of advances) {
                if (remaining <= 0) break;
                const unpaid = adv.amount - adv.repaidAmount;
                const deduction = Math.min(unpaid, remaining);
                await tx.advance.update({
                  where: { id: adv.id },
                  data: { repaidAmount: { increment: deduction } }
                });
                remaining -= deduction;
              }
            }
          });

          results.push({ offlineUuid: delivery.offlineUuid, status: 'created' });
        } catch (err: any) {
          logger.error({ err, uuid: delivery.offlineUuid }, 'Delivery sync error');
          results.push({ offlineUuid: delivery.offlineUuid, status: 'error', error: 'Internal Error' });
        }
      }

      // Sync Log
      await ctx.prisma.syncLog.create({
        data: {
          deviceId: input.deliveries[0]?.deviceId ?? 'unknown',
          collectorId,
          recordsCount: input.deliveries.length,
          conflictsCount: results.filter(r => r.status === 'duplicate').length
        }
      });

      return {
        total: input.deliveries.length,
        created: results.filter(r => r.status === 'created').length,
        duplicates: results.filter(r => r.status === 'duplicate').length,
        errors: results.filter(r => r.status === 'error').length,
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
