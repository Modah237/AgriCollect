import { Model } from '@nozbe/watermelondb'
import { field, date, readonly } from '@nozbe/watermelondb/decorators'

export class Delivery extends Model {
  static table = 'deliveries'

  @field('offline_uuid') offlineUuid!: string
  @field('campaign_id') campaignId!: string
  @field('producer_id') producerId!: string
  @field('culture') culture!: string
  @field('quantity_kg') quantityKg!: number
  @field('quality_grade') qualityGrade!: string
  @field('photo_url') photoUrl!: string | null
  @field('notes') notes!: string | null
  @field('price_per_kg') pricePerKg!: number
  @field('calculated_amount') calculatedAmount!: number
  @date('created_offline_at') createdOfflineAt!: Date
  @field('is_synced') isSynced!: boolean
  @field('sync_error') syncError!: string | null
}
