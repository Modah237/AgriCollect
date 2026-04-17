import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';

export const producersRouter = router({
  list: protectedProcedure
    .input(z.object({
      gicId: z.string(),
      activeOnly: z.boolean().default(true),
    }))
    .query(async ({ input, ctx }) => {
      // Security check
      if (ctx.user.role !== 'SUPER_ADMIN' && ctx.user.gicId !== input.gicId) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      return ctx.prisma.producer.findMany({
        where: { 
          gicId: input.gicId,
          ...(input.activeOnly ? { isActive: true } : {}),
        },
        orderBy: { fullName: 'asc' },
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const producer = await ctx.prisma.producer.findUnique({
        where: { id: input.id },
      });

      if (!producer) throw new TRPCError({ code: 'NOT_FOUND' });

      if (ctx.user.role !== 'SUPER_ADMIN' && producer.gicId !== ctx.user.gicId) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      return producer;
    }),

  toggleStatus: protectedProcedure
    .input(z.object({ id: z.string(), isActive: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const producer = await ctx.prisma.producer.findUnique({
        where: { id: input.id },
      });

      if (!producer) throw new TRPCError({ code: 'NOT_FOUND' });
      if (ctx.user.role !== 'SUPER_ADMIN' && producer.gicId !== ctx.user.gicId) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      return ctx.prisma.producer.update({
        where: { id: input.id },
        data: { isActive: input.isActive },
      });
    }),
});
