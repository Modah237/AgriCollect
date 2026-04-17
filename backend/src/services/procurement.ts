import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

/**
 * Service pour la gestion du cycle de vie des approvisionnements et paiements (P2P)
 */
export const ProcurementService = {
  /**
   * Confirme une ligne de paiement et déclenche le solde des livraisons associées
   */
  async confirmPaymentLine(lineId: string) {
    logger.info({ lineId }, '[ProcurementService] Confirmation de la ligne de paiement');

    return await prisma.$transaction(async (tx) => {
      // 1. Récupérer et vérifier la ligne
      const line = await tx.paymentLine.findUnique({
        where: { id: lineId },
        include: { deliveryLinks: true }
      });

      if (!line) throw new Error('Payment line not found');
      
      // Idempotence : si déjà confirmé, on ne fait rien
      if (line.status === 'CONFIRMED') {
        logger.warn({ lineId }, '[ProcurementService] Ligne déjà confirmée, saut');
        return line;
      }

      // 2. Mettre à jour le statut de la ligne
      const updatedLine = await tx.paymentLine.update({
        where: { id: lineId },
        data: {
          status: 'CONFIRMED',
          confirmedAt: new Date(),
          fapshiStatus: 'SUCCESSFUL'
        }
      });

      // 3. Mettre à jour chaque livraison liée
      for (const link of line.deliveryLinks) {
        const delivery = await tx.delivery.findUnique({
          where: { id: link.deliveryId }
        });

        if (!delivery) continue;

        const newPaidAmount = Math.min(delivery.netDue, delivery.paidAmount + link.amount);
        const isFullyPaid = newPaidAmount >= delivery.netDue;

        await tx.delivery.update({
          where: { id: delivery.id },
          data: {
            paidAmount: newPaidAmount,
            isFullyPaid: isFullyPaid
          }
        });

        logger.info({ 
          deliveryId: delivery.id, 
          allocated: link.amount, 
          fullyPaid: isFullyPaid 
        }, '[ProcurementService] Livraison mise à jour');
      }

      return updatedLine;
    });
  }
};
