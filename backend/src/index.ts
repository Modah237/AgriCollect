import * as Sentry from '@sentry/node'
import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import rateLimit from 'express-rate-limit'

import { logger } from './lib/logger'
// REST routes removed in favor of tRPC

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
  process.env.CORS_ORIGIN ?? 'http://localhost:3000,http://localhost:8081,http://localhost:8084,https://agricollectbackend-production.up.railway.app'
).split(',')

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
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

app.get('/', (_req, res) => {
  res.json({ message: 'AgriCollect CM API is running!', status: 'ok' })
})

import * as trpcExpress from '@trpc/server/adapters/express'
import { appRouter } from './trpc/routers/_app'
import { createContext } from './trpc/context'

// ─── tRPC Endpoint ─────────────────────────────────────────────────────────────
app.use(
  '/api/trpc',
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext,
  })
)

// Webhook Fapshi (URL directe) — doit rester en REST car Fapshi envoie un POST brut
import { paymentsRouter as legacyPaymentsRouter } from './routes/payments'
app.use('/api/v1/payments/webhook/fapshi', legacyPaymentsRouter)

// ─── Gestion d'erreurs globale ─────────────────────────────────────────────────

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, 'Erreur serveur non gérée')
  if (process.env.SENTRY_DSN) Sentry.captureException(err)
  res.status(500).json({ error: 'Erreur serveur interne' })
})

// ─── Démarrage ─────────────────────────────────────────────────────────────────

const port = Number(PORT) || 3001

if (!process.env.VERCEL) {
  app.listen(port, '0.0.0.0', () => {
    logger.info(`AgriCollect CM API — port ${port} — ${process.env.NODE_ENV ?? 'development'} (0.0.0.0)`)
  
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
}

export default app
