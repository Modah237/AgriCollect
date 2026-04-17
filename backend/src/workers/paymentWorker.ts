import { Worker, Job } from 'bullmq';
import { getRedisConnection } from '../queues/paymentQueue';
const redisConnection = getRedisConnection();
import { prisma } from '../lib/prisma';
import { sendPayout, getPayoutStatus } from '../services/fapshi';
import { logger } from '../lib/logger';

export interface PaymentJobData {
  batchId: string;
}

const PAYMENT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

async function processPaymentBatch(job: Job<PaymentJobData>) {
  const { batchId } = job.data;

  logger.info({ batchId }, '[PaymentWorker] Traitement du batch démarré');

  await prisma.paymentBatch.update({
    where: { id: batchId },
    data: { status: 'PROCESSING' },
  });

  const lines = await prisma.paymentLine.findMany({
    where: { batchId, status: 'PENDING' },
    include: { producer: true },
  });

  for (const line of lines) {
    try {
      const result = await sendPayout(
        line.producer.phoneMomo,
        Number(line.amount),
        line.id
      );

      await prisma.paymentLine.update({
        where: { id: line.id },
        data: {
          status: 'SUBMITTED',
          fapshiTxRef: result.transId,
          fapshiStatus: result.status,
        },
      });

      let confirmed = false;
      const deadline = Date.now() + PAYMENT_TIMEOUT_MS;

      while (Date.now() < deadline && !confirmed) {
        await new Promise((r) => setTimeout(r, 10000));

        const current = await prisma.paymentLine.findUnique({ where: { id: line.id } });
        if (current?.status === 'CONFIRMED' || current?.status === 'FAILED') {
          confirmed = true;
          break;
        }

        if (result.transId) {
          const status = await getPayoutStatus(result.transId);
          await prisma.paymentLine.update({
            where: { id: line.id },
            data: { fapshiStatus: status }
          });

          if (status === 'SUCCESSFUL') {
            await prisma.paymentLine.update({
              where: { id: line.id },
              data: { status: 'CONFIRMED', confirmedAt: new Date() },
            });
            logger.info({ lineId: line.id }, 'Paiement confirmé par polling');
            confirmed = true;
          } else if (status === 'FAILED') {
            await prisma.paymentLine.update({
              where: { id: line.id },
              data: { status: 'FAILED', failureReason: 'Fapshi: payout failed' },
            });
            confirmed = true;
          }
        }
      }

      if (!confirmed) {
        await prisma.paymentLine.update({
          where: { id: line.id },
          data: {
            status: 'FAILED',
            failureReason: 'Timeout: no confirmation received',
          },
        });
      }
    } catch (err: any) {
      logger.error({ err, lineId: line.id }, 'Erreur lors du traitement de la ligne de paiement');
      await prisma.paymentLine.update({
        where: { id: line.id },
        data: {
          status: 'FAILED',
          failureReason: err.message?.slice(0, 500) || 'Unknown error',
        },
      });
    }
  }

  const allLines = await prisma.paymentLine.findMany({ where: { batchId } });
  const confirmedCount = allLines.filter((l: any) => l.status === 'CONFIRMED').length;
  const failedCount = allLines.filter((l: any) => l.status === 'FAILED').length;

  let batchStatus: 'COMPLETED' | 'PARTIAL' | 'CANCELLED';
  if (confirmedCount === allLines.length) batchStatus = 'COMPLETED';
  else if (confirmedCount === 0) batchStatus = 'CANCELLED';
  else batchStatus = 'PARTIAL';

  await prisma.paymentBatch.update({
    where: { id: batchId },
    data: { status: batchStatus, completedAt: new Date() },
  });

  return { batchId, confirmed: confirmedCount, failed: failedCount, total: allLines.length, status: batchStatus };
}

export function startPaymentWorker() {
  const worker = new Worker<PaymentJobData>('payments', processPaymentBatch, {
    connection: redisConnection,
    concurrency: 2,
  });

  worker.on('completed', (job, result) => {
    logger.info({ result }, '[PaymentWorker] Job terminé');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, '[PaymentWorker] Job échoué');
  });

  logger.info('[PaymentWorker] Démarré');
  return worker;
}
