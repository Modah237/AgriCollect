import { database } from '../db/database'
import { Delivery, Producer, PriceRule } from '../db/database'
import { fetchProducers, fetchActiveCampaign, syncDeliveries } from '../services/api'
import { getOrCreateDeviceId, saveCampaignId } from '../stores/authStore'

// ─── Pull : Synchroniser les données depuis le serveur vers SQLite ───────────

export async function pullFromServer(gicId: string): Promise<void> {
  const [producers, campaign] = await Promise.all([
    fetchProducers(gicId),
    fetchActiveCampaign(gicId).catch(() => null), // Pas de campagne active = OK
  ])

  await database.write(async () => {
    // Mettre à jour les producteurs
    const producerCollection = database.get<Producer>('producers')
    const existingProducers = await producerCollection.query().fetch()
    const existingMap = new Map(existingProducers.map((p) => [p.serverId, p]))

    for (const p of producers) {
      const existing = existingMap.get(p.id)
      if (existing) {
        await existing.update((record) => {
          record.fullName = p.fullName
          record.phoneMomo = p.phoneMomo
          record.phoneSms = p.phoneSms ?? ''
          record.momoOperator = p.momoOperator
          record.isActive = true
          record.syncedAt = new Date()
        })
      } else {
        await producerCollection.create((record) => {
          record.serverId = p.id
          record.fullName = p.fullName
          record.phoneMomo = p.phoneMomo
          record.phoneSms = p.phoneSms ?? ''
          record.momoOperator = p.momoOperator
          record.isActive = true
          record.syncedAt = new Date()
        })
      }
    }

    // Persister le campaignId pour les redémarrages de l'app
    if (campaign) {
      await saveCampaignId(campaign.id)
    }

    // Mettre à jour les prix de la campagne active
    if (campaign) {
      const priceCollection = database.get<PriceRule>('price_rules')
      // Supprimer les anciens prix de cette campagne et réinsérer
      const oldRules = await priceCollection.query().fetch()
      for (const rule of oldRules) {
        await rule.destroyPermanently()
      }

      for (const rule of campaign.priceRules) {
        await priceCollection.create((record) => {
          record.serverId = rule.id
          record.campaignId = campaign.id
          record.campaignName = campaign.name
          record.culture = rule.culture
          record.qualityGrade = rule.qualityGrade
          record.pricePerKg = rule.pricePerKg
          record.effectiveFrom = new Date(rule.effectiveFrom)
        })
      }
    }
  })
}

// ─── Push : Envoyer les livraisons non synchronisées au serveur ──────────────

export async function pushToServer(): Promise<{
  pushed: number
  errors: number
}> {
  const deviceId = await getOrCreateDeviceId()
  const deliveryCollection = database.get<Delivery>('deliveries')

  // Récupérer toutes les livraisons non synchronisées
  const pending = await deliveryCollection
    .query()
    .fetch()
    .then((all) => all.filter((d) => !d.isSynced))

  if (pending.length === 0) return { pushed: 0, errors: 0 }

  const payload = pending.map((d) => ({
    offlineUuid: d.offlineUuid,
    deviceId,
    campaignId: d.campaignId,
    producerId: d.producerId,
    culture: d.culture,
    quantityKg: d.quantityKg,
    qualityGrade: d.qualityGrade,
    photoUrl: d.photoUrl ?? undefined,
    notes: d.notes ?? undefined,
    createdOfflineAt: d.createdOfflineAt.toISOString(),
  }))

  const result = await syncDeliveries(payload)

  // Mettre à jour le statut de chaque livraison selon la réponse serveur
  await database.write(async () => {
    for (const res of result.results) {
      const delivery = pending.find((d) => d.offlineUuid === res.offlineUuid)
      if (!delivery) continue

      await delivery.update((record) => {
        if (res.status === 'created' || res.status === 'duplicate') {
          record.isSynced = true
          record.syncError = null
        } else {
          record.syncError = res.error ?? 'Erreur inconnue'
        }
      })
    }
  })

  return {
    pushed: result.created,
    errors: result.errors,
  }
}

// ─── Sync complète (pull + push) ─────────────────────────────────────────────

export async function fullSync(gicId: string): Promise<{ pushed: number; errors: number }> {
  await pullFromServer(gicId)
  return pushToServer()
}

// ─── Compter les livraisons en attente ───────────────────────────────────────

export async function countPendingDeliveries(): Promise<number> {
  const all = await database.get<Delivery>('deliveries').query().fetch()
  return all.filter((d) => !d.isSynced).length
}
