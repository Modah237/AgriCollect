import { router } from '../trpc';
import { gicRouter } from './gic';
import { authRouter } from './auth';
import { campaignsRouter } from './campaigns';
import { deliveriesRouter } from './deliveries';
import { exportsRouter } from './exports';
import { paymentsRouter } from './payments';
import { reportsRouter } from './reports';
import { producersRouter } from './producers'; // Assuming a producers tRPC router will be created

export const appRouter = router({
  gic: gicRouter,
  auth: authRouter,
  payments: paymentsRouter,
  campaigns: campaignsRouter,
  deliveries: deliveriesRouter,
  reports: reportsRouter,
  exports: exportsRouter,
  producers: producersRouter, // Add producers router
});

// Export type definition of API
export type AppRouter = typeof appRouter;
