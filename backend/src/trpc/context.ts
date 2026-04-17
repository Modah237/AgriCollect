import { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import { prisma } from '../lib/prisma';
import { verifyAccessToken, JwtPayload } from '../lib/jwt';
import { logger } from '../lib/logger';

/**
 * Creates context for an incoming tRPC request
 * @link https://trpc.io/docs/context
 */
export async function createContext(opts: CreateExpressContextOptions) {
  const { req, res } = opts;

  async function getUserFromHeader() {
    if (req.headers.authorization) {
      const token = req.headers.authorization.split(' ')[1];
      try {
        const user = verifyAccessToken(token);
        return user;
      } catch (err) {
        logger.warn('Invalid token in tRPC context');
        return null;
      }
    }
    return null;
  }

  const user = await getUserFromHeader();

  return {
    req,
    res,
    prisma,
    user,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
