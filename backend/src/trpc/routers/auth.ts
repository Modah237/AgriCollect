import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { router, publicProcedure, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../lib/jwt';

export const authRouter = router({
  loginCollector: publicProcedure
    .input(z.object({
      deviceId: z.string().min(1),
      pin: z.string().length(4).regex(/^\d{4}$/),
      gicId: z.string().min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const collector = await ctx.prisma.user.findFirst({
        where: {
          gicId: input.gicId,
          role: 'COLLECTOR',
          isActive: true,
        },
      });

      if (!collector || !collector.pinHash) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Collecteur introuvable ou inactif' });
      }

      const pinValid = await bcrypt.compare(input.pin, collector.pinHash);
      if (!pinValid) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'PIN incorrect' });
      }

      if (collector.deviceId !== input.deviceId) {
        await ctx.prisma.user.update({
          where: { id: collector.id },
          data: { deviceId: input.deviceId },
        });
      }

      const payload = { userId: collector.id, gicId: collector.gicId, role: collector.role };
      const accessToken = signAccessToken(payload);
      const refreshToken = signRefreshToken(payload);

      await ctx.prisma.refreshToken.create({
        data: {
          userId: collector.id,
          token: refreshToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      return {
        accessToken,
        refreshToken,
        user: {
          id: collector.id,
          fullName: collector.fullName,
          role: collector.role,
          gicId: collector.gicId,
        },
      };
    }),

  loginManager: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(8),
    }))
    .mutation(async ({ input, ctx }) => {
      const manager = await ctx.prisma.user.findFirst({
        where: {
          email: input.email,
          role: { in: ['MANAGER', 'TREASURER', 'SUPER_ADMIN'] },
          isActive: true,
        },
      });

      if (!manager || !manager.passwordHash) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Identifiants incorrects' });
      }

      const passwordValid = await bcrypt.compare(input.password, manager.passwordHash);
      if (!passwordValid) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Identifiants incorrects' });
      }

      const payload = { userId: manager.id, gicId: manager.gicId, role: manager.role };
      const accessToken = signAccessToken(payload);
      const refreshToken = signRefreshToken(payload);

      await ctx.prisma.refreshToken.create({
        data: {
          userId: manager.id,
          token: refreshToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      return {
        accessToken,
        refreshToken,
        user: {
          id: manager.id,
          fullName: manager.fullName,
          role: manager.role,
          gicId: manager.gicId,
        },
      };
    }),

  refresh: publicProcedure
    .input(z.object({ refreshToken: z.string() }))
    .mutation(async ({ input, ctx }) => {
      try {
        const payload = verifyRefreshToken(input.refreshToken);
        const stored = await ctx.prisma.refreshToken.findUnique({
          where: { token: input.refreshToken },
        });

        if (!stored || stored.expiresAt < new Date()) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Token expiré' });
        }

        const accessToken = signAccessToken({
          userId: payload.userId,
          gicId: payload.gicId,
          role: payload.role,
        });

        return { accessToken };
      } catch {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }
    }),

  logout: protectedProcedure
    .input(z.object({ refreshToken: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.prisma.refreshToken.deleteMany({
        where: { token: input.refreshToken, userId: ctx.user.userId },
      });
      return { success: true };
    }),
});
