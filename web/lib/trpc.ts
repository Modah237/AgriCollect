import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '../../backend/src/trpc/routers/_app';

/**
 * Client tRPC pour le Web (Next.js)
 */
export const trpc = createTRPCReact<AppRouter>();
