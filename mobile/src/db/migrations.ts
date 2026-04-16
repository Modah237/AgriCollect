import { schemaMigrations, addColumns } from '@nozbe/watermelondb/Schema/Migrations'

export default schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        addColumns({
          table: 'deliveries',
          columns: [
            { name: 'advance_deducted', type: 'number' },
            { name: 'net_due', type: 'number' },
            { name: 'price_per_kg', type: 'number' }, // Parfois manquant selon le commit
          ],
        }),
      ],
    },
  ],
})
