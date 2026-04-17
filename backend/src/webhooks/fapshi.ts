import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { fapshiService } from '../services/fapshi';

const router = Router();

/**
 * Webhook Fapshi : Appelé par Fapshi lors du changement de statut d'un paiement
 */
router.post('/', async (req, res) => {
  const signature = req.headers['x-fapshi-signature'] as string;
  const body = JSON.stringify(req.body);

  if (!fapshiService.verifyWebhookSignature(body, signature)) {
    logger.warn({ signature }, '[Fapshi] Signature Webhook invalide');
    return res.status(401).json({ error: 'Signature invalide' });
  }

  const { transId, status, externalId } = req.body;
  logger.info({ transId, status, externalId }, '[Fapshi] Webhook reçu');

  try {
    // Si c'est un payout (paiement groupé)
    if (externalId && externalId.startsWith('payout_')) {
      const lineId = externalId.replace('payout_', '');
      
      await prisma.paymentLine.update({
        where: { id: lineId },
        data: {
          status: status === 'SUCCESSFUL' ? 'CONFIRMED' : 'FAILED',
          confirmedAt: status === 'SUCCESSFUL' ? new Date() : null,
          fapshiStatus: status,
        },
      });

      // Mettre à jour le batch si toutes les lignes sont traitées
      const line = await prisma.paymentLine.findUnique({
        where: { id: lineId },
        select: { batchId: true },
      });

      if (line?.batchId) {
        const remaining = await prisma.paymentLine.count({
          where: { batchId: line.batchId, status: 'SUBMITTED' },
        });

        if (remaining === 0) {
          const failedCount = await prisma.paymentLine.count({
            where: { batchId: line.batchId, status: 'FAILED' },
          });

          await prisma.paymentBatch.update({
            where: { id: line.batchId },
            data: {
              status: failedCount > 0 ? 'PARTIAL' : 'COMPLETED',
              completedAt: new Date(),
            },
          });
        }
      }
    }

    res.json({ received: true });
  } catch (err) {
    logger.error({ err, transId }, '[Fapshi] Erreur traitement webhook');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export const fapshiWebhook = router;
