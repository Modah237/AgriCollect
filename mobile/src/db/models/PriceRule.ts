import { Model } from '@nozbe/watermelondb'
import { field, date } from '@nozbe/watermelondb/decorators'

export class PriceRule extends Model {
  static table = 'price_rules'

  @field('server_id') serverId!: string
  @field('campaign_id') campaignId!: string
  @field('campaign_name') campaignName!: string
  @field('culture') culture!: string
  @field('quality_grade') qualityGrade!: string
  @field('price_per_kg') pricePerKg!: number
  @date('effective_from') effectiveFrom!: Date
}
