import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';

/**
 * Router pour la synchronisation des données (PULL & PUSH)
 */
export const syncRouter = router({
  // ─── PULL : Récupérer les données maître (Producteurs + Campagne Active) ────
  pull: publicProcedure
    .input(z.object({ gicId: z.string() }))
    .query(async ({ input, ctx }) => {
      const { gicId } = input;

      const [producers, campaign] = await Promise.all([
        // 1. Producteurs actifs du GIC
        ctx.prisma.producer.findMany({
          where: { gicId, isActive: true },
          select: {
            id: true,
            fullName: true,
            phoneMomo: true,
            phoneSms: true,
            momoOperator: true,
          },
        }),
        // 2. Campagne active avec ses règles de prix
        ctx.prisma.campaign.findFirst({
          where: { gicId, status: 'ACTIVE' },
          include: {
            priceRules: true,
          },
        }),
      ]);

      return {
        producers,
        campaign,
      };
    }),

  // ─── PUSH : Envoyer les livraisons saisies offline au serveur ───────────────
  push: protectedProcedure
    .input(
      z.array(
        z.object({
          offlineUuid: z.string().uuid(),
          deviceId: z.string(),
          campaignId: z.string(),
          producerId: z.string(),
          culture: z.string(),
          quantityKg: z.number(),
          qualityGrade: z.enum(['A', 'B', 'C']),
          photoUrl: z.string().optional(),
          notes: z.string().optional(),
          pricePerKg: z.number(),
          calculatedAmount: z.number(),
          createdOfflineAt: z.string(), // ISO String
        })
      )
    )
    .mutation(async ({ input, ctx }) => {
      const collectorId = ctx.user.userId;
      const results: { offlineUuid: string; status: 'created' | 'duplicate' | 'error'; error?: string }[] = [];
      let createdCount = 0;
      let duplicateCount = 0;
      let errorCount = 0;

      for (const delivery of input) {
        try {
          // Vérification d'idempotence (doublon par offlineUuid)
          const existing = await ctx.prisma.delivery.findUnique({
            where: { offlineUuid: delivery.offlineUuid },
          });

          if (existing) {
            results.push({ offlineUuid: delivery.offlineUuid, status: 'duplicate' });
            duplicateCount++;
            continue;
          }

          // Création de la livraison
          await ctx.prisma.delivery.create({
            data: {
              offlineUuid: delivery.offlineUuid,
              deviceId: delivery.deviceId,
              campaignId: delivery.campaignId,
              producerId: delivery.producerId,
              collectorId: collectorId,
              culture: delivery.culture,
              quantityKg: delivery.quantityKg,
              qualityGrade: delivery.qualityGrade,
              photoUrl: delivery.photoUrl,
              notes: delivery.notes,
              pricePerKg: delivery.pricePerKg,
              calculatedAmount: delivery.calculatedAmount,
              advanceDeducted: 0, // Gestion des avances à implémenter plus tard
              netDue: delivery.calculatedAmount,
              createdOfflineAt: new Date(delivery.createdOfflineAt),
              syncedAt: new Date(),
            },
          });

          results.push({ offlineUuid: delivery.offlineUuid, status: 'created' });
          createdCount++;
        } catch (err: any) {
          results.push({ offlineUuid: delivery.offlineUuid, status: 'error', error: err.message });
          errorCount++;
        }
      }

      return {
        created: createdCount,
        duplicates: duplicateCount,
        errors: errorCount,
        results,
      };
    }),
});
