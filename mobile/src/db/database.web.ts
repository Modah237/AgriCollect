import { Database } from '@nozbe/watermelondb'
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs'
import { schema } from './schema'
import { Producer } from './models/Producer'
import { PriceRule } from './models/PriceRule'
import { Delivery } from './models/Delivery'

const adapter = new LokiJSAdapter({
  schema,
  useWebWorker: false,
  useIncrementalIndexedDB: true,
  onSetUpError: (error: any) => {
    console.error('WatermelonDB (LokiJS) setup error:', error)
  },
})

export const database = new Database({
  adapter,
  modelClasses: [Producer, PriceRule, Delivery],
})

export { Producer, PriceRule, Delivery }
