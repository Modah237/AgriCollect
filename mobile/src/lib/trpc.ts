import { createTRPCReact } from '@trpc/react-query';
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../../../backend/src/trpc/routers/_app';
import { getAccessToken } from '../stores/authStore';
import { Platform } from 'react-native';

const BASE_URL = Platform.OS === 'web' 
  ? 'http://localhost:3001' 
  : (process.env.EXPO_PUBLIC_API_URL ?? 'http://192.168.1.115:3001');

/**
 * Client tRPC pour Mobile (Hooks React)
 */
export const trpc = createTRPCReact<AppRouter>();

/**
 * Client tRPC Vanilla pour Mobile (Utilisation hors React, e.g. sync engine)
 */
export const trpcClient = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${BASE_URL}/api/trpc`,
      async headers() {
        const token = await getAccessToken();
        return {
          authorization: token ? `Bearer ${token}` : undefined,
        };
      },
    }),
  ],
});
