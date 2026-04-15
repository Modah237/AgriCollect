import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../lib/jwt'
import { validate } from '../middleware/validate'
import { authenticate } from '../middleware/auth'

const router = Router()

// ─── Schémas de validation ───────────────────────────────────────────────────

const loginCollectorSchema = z.object({
  deviceId: z.string().min(1),
  pin: z.string().length(4).regex(/^\d{4}$/, 'Le PIN doit être 4 chiffres'),
  gicId: z.string().min(1),
})

const loginManagerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
})

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * POST /auth/login/collector
 * Authentification collecteur terrain par PIN + deviceId + gicId
 */
router.post(
  '/login/collector',
  validate(loginCollectorSchema),
  async (req: Request, res: Response) => {
    const { deviceId, pin, gicId } = req.body

    const collector = await prisma.user.findFirst({
      where: {
        gicId,
        role: 'COLLECTOR',
        isActive: true,
      },
    })

    if (!collector || !collector.pinHash) {
      res.status(401).json({ error: 'Collecteur introuvable ou inactif' })
      return
    }

    const pinValid = await bcrypt.compare(pin, collector.pinHash)
    if (!pinValid) {
      res.status(401).json({ error: 'PIN incorrect' })
      return
    }

    // Auto-enregistrement du deviceId s'il a changé (utile pour le test Web/Multi-device)
    if (collector.deviceId !== deviceId) {
      await prisma.user.update({
        where: { id: collector.id },
        data: { deviceId },
      })
    }

    const payload = { userId: collector.id, gicId: collector.gicId, role: collector.role }
    const accessToken = signAccessToken(payload)
    const refreshToken = signRefreshToken(payload)

    // Stocker le refresh token en base (permet révocation)
    await prisma.refreshToken.create({
      data: {
        userId: collector.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: collector.id,
        fullName: collector.fullName,
        role: collector.role,
        gicId: collector.gicId,
      },
    })
  }
)

/**
 * POST /auth/login/manager
 * Authentification gestionnaire/trésorier par email + mot de passe
 */
router.post(
  '/login/manager',
  validate(loginManagerSchema),
  async (req: Request, res: Response) => {
    const { email, password } = req.body

    const manager = await prisma.user.findFirst({
      where: {
        email,
        role: { in: ['MANAGER', 'TREASURER', 'SUPER_ADMIN'] },
        isActive: true,
      },
    })

    if (!manager || !manager.passwordHash) {
      res.status(401).json({ error: 'Identifiants incorrects' })
      return
    }

    const passwordValid = await bcrypt.compare(password, manager.passwordHash)
    if (!passwordValid) {
      res.status(401).json({ error: 'Identifiants incorrects' })
      return
    }

    const payload = { userId: manager.id, gicId: manager.gicId, role: manager.role }
    const accessToken = signAccessToken(payload)
    const refreshToken = signRefreshToken(payload)

    await prisma.refreshToken.create({
      data: {
        userId: manager.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: manager.id,
        fullName: manager.fullName,
        role: manager.role,
        gicId: manager.gicId,
      },
    })
  }
)

/**
 * POST /auth/refresh
 * Renouveler le JWT access token via refresh token
 */
router.post('/refresh', validate(refreshSchema), async (req: Request, res: Response) => {
  const { refreshToken } = req.body

  try {
    const payload = verifyRefreshToken(refreshToken)

    // Vérifier que le token existe en base (pas révoqué)
    const stored = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    })

    if (!stored || stored.expiresAt < new Date()) {
      res.status(401).json({ error: 'Refresh token invalide ou expiré' })
      return
    }

    const newAccessToken = signAccessToken({
      userId: payload.userId,
      gicId: payload.gicId,
      role: payload.role,
    })

    res.json({ accessToken: newAccessToken })
  } catch {
    res.status(401).json({ error: 'Refresh token invalide' })
  }
})

/**
 * POST /auth/logout
 * Révoquer le refresh token
 */
router.post('/logout', authenticate, validate(refreshSchema), async (req: Request, res: Response) => {
  const { refreshToken } = req.body

  await prisma.refreshToken.deleteMany({
    where: { token: refreshToken, userId: req.user!.userId },
  })

  res.json({ message: 'Déconnexion réussie' })
})

export default router
