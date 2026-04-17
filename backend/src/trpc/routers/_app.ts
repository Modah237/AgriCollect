import { router } from '../trpc';
import { gicRouter } from './gic';
import { authRouter } from './auth';
import { paymentsRouter } from './payments';
import { campaignsRouter } from './campaigns';
import { deliveriesRouter } from './deliveries';
import { reportsRouter } from './reports';
import { exportsRouter } from './exports';

export const appRouter = router({
  gic: gicRouter,
  auth: authRouter,
  payments: paymentsRouter,
  campaigns: campaignsRouter,
  deliveries: deliveriesRouter,
  reports: reportsRouter,
  exports: exportsRouter,
});

// Export type definition of API
export type AppRouter = typeof appRouter;
