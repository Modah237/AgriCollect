import { Queue } from 'bullmq'
import IORedis from 'ioredis'

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

let connection: IORedis | null = null
let queue: Queue | null = null

export function getRedisConnection() {
  if (!connection) {
    connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
      enableOfflineQueue: false,
      reconnectOnError: () => false,
      connectTimeout: 5000,
    })
    connection.on('error', () => {})
  }
  return connection
}

export function getPaymentQueue() {
  if (!queue) {
    queue = new Queue('payments', {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: false,
        removeOnFail: false,
      },
    })
  }
  return queue
}
