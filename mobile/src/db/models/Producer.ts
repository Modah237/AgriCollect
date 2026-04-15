import { Model } from '@nozbe/watermelondb'
import { field, date, readonly } from '@nozbe/watermelondb/decorators'

export class Producer extends Model {
  static table = 'producers'

  @field('server_id') serverId!: string
  @field('full_name') fullName!: string
  @field('phone_momo') phoneMomo!: string
  @field('phone_sms') phoneSms!: string | null
  @field('momo_operator') momoOperator!: string
  @field('is_active') isActive!: boolean
  @date('synced_at') syncedAt!: Date
}
