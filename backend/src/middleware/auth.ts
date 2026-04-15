import { Request, Response, NextFunction } from 'express'
import { verifyAccessToken, JwtPayload } from '../lib/jwt'

// Étend l'interface Request pour inclure l'utilisateur authentifié
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token manquant' })
    return
  }

  const token = authHeader.slice(7)

  try {
    req.user = verifyAccessToken(token)
    next()
  } catch {
    res.status(401).json({ error: 'Token invalide ou expiré' })
  }
}

// Middleware pour restreindre l'accès selon le rôle
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Accès refusé' })
      return
    }
    next()
  }
}

// Middleware pour s'assurer que l'utilisateur accède uniquement à son propre GIC
export function requireSameGic(req: Request, res: Response, next: NextFunction): void {
  const gicId = req.params.gicId || req.params.id

  if (req.user?.role === 'SUPER_ADMIN') {
    next()
    return
  }

  if (!req.user || req.user.gicId !== gicId) {
    res.status(403).json({ error: 'Accès refusé à ce GIC' })
    return
  }

  next()
}
