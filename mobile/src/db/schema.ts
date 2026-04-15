import { appSchema, tableSchema } from '@nozbe/watermelondb'

// Schéma WatermelonDB — données offline du collecteur
export const schema = appSchema({
  version: 1,
  tables: [
    // Producteurs du GIC (synchronisés depuis le serveur)
    tableSchema({
      name: 'producers',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true },
        { name: 'full_name', type: 'string' },
        { name: 'phone_momo', type: 'string' },
        { name: 'phone_sms', type: 'string', isOptional: true },
        { name: 'momo_operator', type: 'string' }, // "MTN" | "ORANGE"
        { name: 'is_active', type: 'boolean' },
        { name: 'synced_at', type: 'number' }, // timestamp
      ],
    }),

    // Règles de prix de la campagne active (synchronisées depuis le serveur)
    tableSchema({
      name: 'price_rules',
      columns: [
        { name: 'server_id', type: 'string', isIndexed: true },
        { name: 'campaign_id', type: 'string', isIndexed: true },
        { name: 'campaign_name', type: 'string' },
        { name: 'culture', type: 'string' },
        { name: 'quality_grade', type: 'string' }, // "A" | "B" | "C"
        { name: 'price_per_kg', type: 'number' },  // En XAF
        { name: 'effective_from', type: 'number' }, // timestamp
      ],
    }),

    // Livraisons saisies en local (à synchroniser)
    tableSchema({
      name: 'deliveries',
      columns: [
        { name: 'offline_uuid', type: 'string', isIndexed: true }, // UUID v4 unique
        { name: 'campaign_id', type: 'string', isIndexed: true },
        { name: 'producer_id', type: 'string', isIndexed: true },  // server_id du producteur
        { name: 'culture', type: 'string' },
        { name: 'quantity_kg', type: 'number' },
        { name: 'quality_grade', type: 'string' },
        { name: 'photo_url', type: 'string', isOptional: true },
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'price_per_kg', type: 'number' },       // Snapshot du prix au moment de la saisie
        { name: 'calculated_amount', type: 'number' },  // quantityKg × pricePerKg
        { name: 'created_offline_at', type: 'number' }, // timestamp de saisie
        { name: 'is_synced', type: 'boolean' },         // false = en attente de sync
        { name: 'sync_error', type: 'string', isOptional: true },
      ],
    }),
  ],
})
