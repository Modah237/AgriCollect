import * as Sentry from '@sentry/node'
import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import rateLimit from 'express-rate-limit'

import { logger } from './lib/logger'
import authRoutes from './routes/auth'
import gicRoutes from './routes/gic'
import producerRoutes from './routes/producers'
import campaignRoutes from './routes/campaigns'
import deliveryRoutes from './routes/deliveries'
import { paymentsRouter } from './routes/payments'
import reportsRouter from './routes/reports'
import exportsRouter from './routes/exports'

// ─── Sentry (monitoring erreurs) ───────────────────────────────────────────────

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: 0.1,
  })
  logger.info('[Sentry] Monitoring activé')
}

const app = express()
const PORT = process.env.PORT ?? 3001

// ─── Sécurité ──────────────────────────────────────────────────────────────────

app.use(helmet())

const allowedOrigins = (
  process.env.CORS_ORIGIN ?? 'http://localhost:3000,http://localhost:8081,http://localhost:8084'
).split(',')

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true)
      } else {
        callback(new Error('Non autorisé par CORS'))
      }
    },
    credentials: true,
  })
)

// Rate limiting global
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Trop de requêtes, réessayez dans 15 minutes' },
  })
)

// Rate limiting strict sur auth (PIN brute-force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Trop de tentatives de connexion, réessayez dans 15 minutes' },
})

// ─── Body parsing ──────────────────────────────────────────────────────────────

app.use(express.json({ limit: '10mb' }))

// ─── Health check ──────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() })
})

// ─── Routes ────────────────────────────────────────────────────────────────────

app.use('/auth', authLimiter, authRoutes)
app.use('/gic', gicRoutes)
app.use('/producers', producerRoutes)
app.use('/campaigns', campaignRoutes)
app.use('/deliveries', deliveryRoutes)
app.use('/payments', paymentsRouter)
app.use('/reports', reportsRouter)
app.use('/exports', exportsRouter)

// ─── Gestion d'erreurs globale ─────────────────────────────────────────────────

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, 'Erreur serveur non gérée')
  if (process.env.SENTRY_DSN) Sentry.captureException(err)
  res.status(500).json({ error: 'Erreur serveur interne' })
})

// ─── Démarrage ─────────────────────────────────────────────────────────────────

app.listen(Number(PORT), '0.0.0.0', () => {
  logger.info(`AgriCollect CM API — port ${PORT} — ${process.env.NODE_ENV ?? 'development'}`)

  // Worker BullMQ (si Redis disponible)
  process.nextTick(async () => {
    try {
      const { getRedisConnection } = await import('./queues/paymentQueue')
      const conn = getRedisConnection()
      await conn.connect()
      const { startPaymentWorker } = await import('./workers/paymentWorker')
      startPaymentWorker()
      logger.info('[PaymentWorker] Redis connecté — worker démarré')
    } catch (err: any) {
      logger.warn(`[PaymentWorker] Redis non disponible — tâches de fond désactivées: ${err.message}`)
    }
  })
})

export default app
