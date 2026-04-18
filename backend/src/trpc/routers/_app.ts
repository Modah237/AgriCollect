import { router } from '../trpc';
import { gicRouter } from './gic';
import { authRouter } from './auth';
import { campaignsRouter } from './campaigns';
import { deliveriesRouter } from './deliveries';
import { exportsRouter } from './exports';
import { paymentsRouter } from './payments';
import { reportsRouter } from './reports';
import { producersRouter } from './producers';
import { syncRouter } from './sync';

export const appRouter = router({
  gic: gicRouter,
  auth: authRouter,
  payments: paymentsRouter,
  campaigns: campaignsRouter,
  deliveries: deliveriesRouter,
  reports: reportsRouter,
  exports: exportsRouter,
  producers: producersRouter,
  sync: syncRouter,
});

// Export type definition of API
export type AppRouter = typeof appRouter;
