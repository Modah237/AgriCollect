import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { getPaymentQueue } from '../../queues/paymentQueue';
import { PaymentLine, Prisma } from '@prisma/client';

export const paymentsRouter = router({
  createBatch: protectedProcedure
    .input(z.object({
      campaignId: z.string().cuid(),
      producerAmounts: z.array(z.object({
        producerId: z.string().cuid(),
        amount: z.number().positive().optional(), // Si null, paie tout le solde
      })).min(1).max(500),
    }))
    .mutation(async ({ input, ctx }) => {
      // Sécurité : MANAGER/TREASURER du même GIC
      if (!['MANAGER', 'TREASURER', 'SUPER_ADMIN'].includes(ctx.user.role)) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      const campaign = await ctx.prisma.campaign.findFirst({
        where: { id: input.campaignId, gicId: ctx.user.gicId, status: 'ACTIVE' },
      });

      if (!campaign) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Campagne active introuvable' });
      }

      const producerIds = input.producerAmounts.map(p => p.producerId);
      const amountMap = new Map(input.producerAmounts.map(p => [p.producerId, p.amount]));

      // 1. Récupérer toutes les livraisons non soldées pour ces producteurs
      const deliveries = await ctx.prisma.delivery.findMany({
        where: {
          campaignId: input.campaignId,
          producerId: { in: producerIds },
          isFullyPaid: false,
        },
        include: {
          paymentLinks: {
            where: { paymentLine: { status: { in: ['PENDING', 'SUBMITTED'] } } }
          }
        },
        orderBy: { createdOfflineAt: 'asc' }, // FIFO: on paie les plus anciennes d'abord
      });

      if (deliveries.length === 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Aucune livraison impayée trouvée' });
      }

      const batch = await ctx.prisma.$transaction(async (tx) => {
        // Créer le batch
        const newBatch = await tx.paymentBatch.create({
          data: {
            campaignId: input.campaignId,
            initiatedById: ctx.user.userId,
            totalAmount: 0, 
            status: 'PENDING',
          },
        });

        let batchTotal = 0;
        const paymentLines: PaymentLine[] = [];
        const lineDeliveryLinks: Prisma.PaymentLineDeliveryCreateManyInput[] = [];

        // Grouper les livraisons par producteur pour l'allocation
        for (const pid of producerIds) {
          const pDeliveries = deliveries.filter(d => d.producerId === pid);
          if (pDeliveries.length === 0) continue;

          let amountToPay = amountMap.get(pid);
          
          // Calculer le total RÉELLEMENT dû (Net - Déjà Payé - En cours)
          const producerTotalDue = pDeliveries.reduce((s, d) => {
            const alreadyPending = d.paymentLinks.reduce((sum, link) => sum + link.amount, 0);
            return s + Math.max(0, d.netDue - d.paidAmount - alreadyPending);
          }, 0);

          // Si pas de montant spécifié, on paie tout ce qui est possible
          if (amountToPay === undefined || amountToPay === null) {
            amountToPay = producerTotalDue;
          }

          // On ne peut pas payer plus que ce qui est dû
          amountToPay = Math.min(amountToPay, producerTotalDue);

          if (amountToPay <= 0) continue;

          // Création de la ligne de paiement (PaymentLine)
          const line = await tx.paymentLine.create({
            data: {
              batchId: newBatch.id,
              producerId: pid,
              amount: amountToPay,
              status: 'PENDING',
            },
          });

          let remaining = amountToPay;
          for (const d of pDeliveries) {
            if (remaining <= 0) break;
            const alreadyPending = d.paymentLinks.reduce((sum, link) => sum + link.amount, 0);
            const deliveryAvailable = Math.max(0, d.netDue - d.paidAmount - alreadyPending);
            
            const allocation = Math.min(deliveryAvailable, remaining);

            if (allocation > 0) {
              lineDeliveryLinks.push({
                paymentLineId: line.id,
                deliveryId: d.id,
                amount: allocation,
              });
              remaining -= allocation;
            }
          }

          batchTotal += amountToPay;
          paymentLines.push(line);
        }

        // Créer les liens en masse
        await tx.paymentLineDelivery.createMany({ data: lineDeliveryLinks });

        // Mettre à jour le montant total du batch
        await tx.paymentBatch.update({
          where: { id: newBatch.id },
          data: { totalAmount: batchTotal },
        });

        return { id: newBatch.id, totalAmount: batchTotal, count: paymentLines.length };
      });

      // Ajouter à la file BullMQ
      await getPaymentQueue().add('process-batch', { batchId: batch.id }, { jobId: batch.id });

      return batch;
    }),

  cancelBatch: protectedProcedure
    .input(z.object({ batchId: z.string().cuid() }))
    .mutation(async ({ input, ctx }) => {
      const batch = await ctx.prisma.paymentBatch.findUnique({
        where: { id: input.batchId },
        include: { lines: { select: { status: true } } }
      });

      if (!batch) throw new TRPCError({ code: 'NOT_FOUND' });
      if (batch.status !== 'PENDING') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Seul un lot en attente peut être annulé' });
      }

      await ctx.prisma.paymentBatch.update({
        where: { id: input.batchId },
        data: { status: 'CANCELLED' }
      });

      return { success: true };
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
            include: {
              producer: { select: { fullName: true, phoneMomo: true } },
              deliveryLinks: { include: { delivery: { select: { culture: true, quantityKg: true } } } }
            },
            orderBy: { createdAt: 'asc' },
          },
          initiatedBy: { select: { fullName: true } },
        },
      });

      if (!batch) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      // Calculer des stats rapides
      const stats = {
        pending: batch.lines.filter(l => l.status === 'PENDING').length,
        submitted: batch.lines.filter(l => l.status === 'SUBMITTED').length,
        confirmed: batch.lines.filter(l => l.status === 'CONFIRMED').length,
        failed: batch.lines.filter(l => l.status === 'FAILED').length,
      };

      return { ...batch, stats };
    }),
});
