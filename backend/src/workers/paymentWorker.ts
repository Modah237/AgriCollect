import { Worker, Job } from 'bullmq'
import { getRedisConnection } from '../queues/paymentQueue'
const redisConnection = getRedisConnection()
import { prisma } from '../lib/prisma'
import { collectPayment, getPaymentStatus } from '../services/campay'
import { sendPaymentConfirmation, sendPaymentFailure } from '../services/sms'

export interface PaymentJobData {
  batchId: string
}

const PAYMENT_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

async function processPaymentBatch(job: Job<PaymentJobData>) {
  const { batchId } = job.data

  // Marquer le batch en cours
  await prisma.paymentBatch.update({
    where: { id: batchId },
    data: { status: 'PROCESSING' },
  })

  const lines = await prisma.paymentLine.findMany({
    where: { batchId, status: 'PENDING' },
    include: { producer: true },
  })

  for (const line of lines) {
    try {
      // 1. Appeler Campay
      const result = await collectPayment(
        line.producer.phoneMomo,
        Number(line.amount),
        line.id
      )

      // 2. Mettre à jour la ligne en SUBMITTED avec la référence Campay
      await prisma.paymentLine.update({
        where: { id: line.id },
        data: {
          status: 'SUBMITTED',
          campayTxRef: result.reference,
        },
      })

      // 3. Attendre confirmation via polling (le webhook sera prioritaire s'il arrive)
      let confirmed = false
      const deadline = Date.now() + PAYMENT_TIMEOUT_MS

      while (Date.now() < deadline && !confirmed) {
        await new Promise((r) => setTimeout(r, 10000)) // poll toutes les 10s

        // Vérifier si le webhook a déjà confirmé
        const current = await prisma.paymentLine.findUnique({ where: { id: line.id } })
        if (current?.status === 'CONFIRMED' || current?.status === 'FAILED') {
          confirmed = true
          break
        }

        // Sinon, interroger Campay directement
        const status = await getPaymentStatus(result.reference)

        if (status.status === 'SUCCESSFUL') {
          await prisma.paymentLine.update({
            where: { id: line.id },
            data: { status: 'CONFIRMED', confirmedAt: new Date() },
          })
          await sendPaymentConfirmation(
            line.producer.phoneMomo,
            Number(line.amount),
            line.producer.fullName
          ).catch(console.error) // Ne pas bloquer si SMS échoue
          confirmed = true
        } else if (status.status === 'FAILED') {
          await prisma.paymentLine.update({
            where: { id: line.id },
            data: { status: 'FAILED', failureReason: 'Campay: payment failed' },
          })
          await sendPaymentFailure(
            line.producer.phoneMomo,
            Number(line.amount),
            line.producer.fullName
          ).catch(console.error)
          confirmed = true
        }
      }

      // 4. Timeout atteint sans confirmation
      if (!confirmed) {
        await prisma.paymentLine.update({
          where: { id: line.id },
          data: {
            status: 'FAILED',
            failureReason: 'Timeout: no confirmation received after 5 minutes',
          },
        })
        await sendPaymentFailure(
          line.producer.phoneMomo,
          Number(line.amount),
          line.producer.fullName
        ).catch(console.error)
      }
    } catch (err: any) {
      console.error(`PaymentLine ${line.id} error:`, err.message)
      await prisma.paymentLine.update({
        where: { id: line.id },
        data: {
          status: 'FAILED',
          failureReason: err.message?.slice(0, 500) || 'Unknown error',
        },
      })
    }
  }

  // 5. Calculer le statut final du batch
  const allLines = await prisma.paymentLine.findMany({ where: { batchId } })
  const confirmed = allLines.filter((l) => l.status === 'CONFIRMED').length
  const failed = allLines.filter((l) => l.status === 'FAILED').length

  let batchStatus: 'COMPLETED' | 'PARTIAL' | 'CANCELLED'
  if (confirmed === allLines.length) batchStatus = 'COMPLETED'
  else if (confirmed === 0) batchStatus = 'CANCELLED'
  else batchStatus = 'PARTIAL'

  await prisma.paymentBatch.update({
    where: { id: batchId },
    data: { status: batchStatus, completedAt: new Date() },
  })

  return { batchId, confirmed, failed, total: allLines.length, status: batchStatus }
}

export function startPaymentWorker() {
  const worker = new Worker<PaymentJobData>('payments', processPaymentBatch, {
    connection: redisConnection,
    concurrency: 2, // Max 2 batches en parallèle
  })

  worker.on('completed', (job, result) => {
    console.log(`[PaymentWorker] Batch ${result.batchId} terminé — ${result.status} (${result.confirmed}/${result.total})`)
  })

  worker.on('failed', (job, err) => {
    console.error(`[PaymentWorker] Job ${job?.id} échoué:`, err.message)
  })

  console.log('[PaymentWorker] Démarré')
  return worker
}
