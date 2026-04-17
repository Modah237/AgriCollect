import { db, SQLiteProducer, SQLitePriceRule, SQLiteDelivery } from '../db/database'
import { trpcClient } from '../lib/trpc';
import { getOrCreateDeviceId, saveCampaignId } from '../stores/authStore'

// ─── Pull : Synchroniser les données depuis le serveur vers SQLite ───────────

export async function pullFromServer(gicId: string): Promise<void> {
  const [producers, campaign] = await Promise.all([
    trpcClient.gic.getProducers.query({ gicId }),
    trpcClient.gic.getActiveCampaign.query({ gicId })
  ]);

  // Utilisation d'une transaction pour garantir l'intégrité
  await db.withTransactionAsync(async () => {
    // 1. Mettre à jour les producteurs
    for (const p of producers) {
      await db.runAsync(
        `INSERT INTO producers (id, full_name, phone_momo, phone_sms, momo_operator, is_active, synced_at)
         VALUES (?, ?, ?, ?, ?, 1, ?)
         ON CONFLICT(id) DO UPDATE SET
         full_name = excluded.full_name,
         phone_momo = excluded.phone_momo,
         phone_sms = excluded.phone_sms,
         momo_operator = excluded.momo_operator,
         synced_at = excluded.synced_at`,
        [p.id, p.fullName, p.phoneMomo, p.phoneSms ?? '', p.momoOperator, new Date().toISOString()]
      );
    }

    // 2. Persister le campaignId
    if (campaign) {
      await saveCampaignId(campaign.id);

      // 3. Mettre à jour les prix de la campagne
      await db.runAsync('DELETE FROM price_rules');

      for (const rule of campaign.priceRules) {
        await db.runAsync(
          `INSERT INTO price_rules (id, campaign_id, campaign_name, culture, quality_grade, price_per_kg, effective_from)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [rule.id, campaign.id, campaign.name, rule.culture, rule.qualityGrade, rule.pricePerKg, rule.effectiveFrom.toString()]
        );
      }
    }
  });
}

// ─── Push : Envoyer les livraisons non synchronisées au serveur ──────────────

export async function pushToServer(): Promise<{ pushed: number; errors: number }> {
  const deviceId = await getOrCreateDeviceId();

  // Récupérer toutes les livraisons non synchronisées
  const pending: SQLiteDelivery[] = await db.getAllAsync(
    'SELECT * FROM deliveries WHERE is_synced = 0'
  );

  if (pending.length === 0) return { pushed: 0, errors: 0 };

  const payload = pending.map((d) => ({
    offlineUuid: d.offline_uuid,
    deviceId,
    campaignId: d.campaign_id,
    producerId: d.producer_id,
    culture: d.culture,
    quantityKg: d.quantity_kg,
    qualityGrade: d.quality_grade as any,
    photoUrl: d.photo_url || undefined,
    notes: d.notes || undefined,
    createdOfflineAt: d.created_offline_at,
  }));

  try {
    const result = await trpcClient.deliveries.sync.mutate({ deliveries: payload });

    // Mettre à jour le statut de chaque livraison
    await db.withTransactionAsync(async () => {
      for (const res of result.results) {
        if (res.status === 'created' || res.status === 'duplicate') {
          await db.runAsync(
            'UPDATE deliveries SET is_synced = 1, sync_error = NULL WHERE offline_uuid = ?',
            [res.offlineUuid]
          );
        } else {
          await db.runAsync(
            'UPDATE deliveries SET sync_error = ? WHERE offline_uuid = ?',
            [res.error || 'Erreur inconnue', res.offlineUuid]
          );
        }
      }
    });

    return {
      pushed: result.created + result.duplicates,
      errors: result.errors,
    };
  } catch (error) {
    console.error('[Sync] Erreur fatale lors du push tRPC:', error);
    return { pushed: 0, errors: pending.length };
  }
}

// ─── Sync complète (pull + push) ─────────────────────────────────────────────

export async function fullSync(gicId: string): Promise<{ pushed: number; errors: number }> {
  await pullFromServer(gicId);
  return pushToServer();
}

// ─── Compter les livraisons en attente ───────────────────────────────────────

export async function countPendingDeliveries(): Promise<number> {
  const result: any = await db.getFirstAsync(
    'SELECT COUNT(*) as count FROM deliveries WHERE is_synced = 0'
  );
  return result?.count || 0;
}
