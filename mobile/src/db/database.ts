import { Database } from '@nozbe/watermelondb'
import { Platform } from 'react-native'
import { schema } from './schema'
import { Producer } from './models/Producer'
import { PriceRule } from './models/PriceRule'
import { Delivery } from './models/Delivery'

let adapter: any

if (Platform.OS === 'web') {
  // LokiJS — seul adaptateur fonctionnel dans le navigateur (IndexedDB)
  const LokiJSAdapter = require('@nozbe/watermelondb/adapters/lokijs').default
  adapter = new LokiJSAdapter({
    schema,
    useWebWorker: false,           // obligatoire dans Expo web (pas de Worker API)
    useIncrementalIndexedDB: true, // persistance entre les rechargements
  })
} else {
  // SQLite — adaptateur natif Android / iOS
  const SQLiteAdapter = require('@nozbe/watermelondb/adapters/sqlite').default
  adapter = new SQLiteAdapter({
    schema,
    dbName: 'agricollect',
    onSetUpError: (error: any) => {
      console.error('WatermelonDB (SQLite) setup error:', error)
    },
  })
}

export const database = new Database({
  adapter,
  modelClasses: [Producer, PriceRule, Delivery],
})

export { Producer, PriceRule, Delivery }
