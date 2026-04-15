import { Platform } from 'react-native'
import { getAccessToken, getRefreshToken, saveTokens, clearAuth } from '../stores/authStore'

const BASE_URL = Platform.OS === 'web' 
  ? 'http://localhost:3001' 
  : (process.env.EXPO_PUBLIC_API_URL ?? 'http://192.168.1.115:3001')

// ─── Client HTTP de base ─────────────────────────────────────────────────────

async function request<T>(
  path: string,
  options: RequestInit = {},
  retry = true
): Promise<T> {
  const token = await getAccessToken()

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  // Token expiré → on tente un refresh automatique
  if (response.status === 401 && retry) {
    const refreshed = await tryRefreshToken()
    if (refreshed) {
      return request<T>(path, options, false) // on ne retry qu'une fois
    }
    await clearAuth()
    throw new Error('SESSION_EXPIRED')
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error ?? `HTTP ${response.status}`)
  }

  return response.json() as Promise<T>
}

async function tryRefreshToken(): Promise<boolean> {
  const refreshToken = await getRefreshToken()
  if (!refreshToken) return false

  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })

    if (!res.ok) return false

    const { accessToken, refreshToken: newRefresh } = await res.json()
    await saveTokens(accessToken, newRefresh ?? refreshToken)
    return true
  } catch {
    return false
  }
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export async function loginCollector(gicId: string, deviceId: string, pin: string) {
  return request<{
    accessToken: string
    refreshToken: string
    user: { id: string; fullName: string; role: string; gicId: string }
  }>('/auth/login/collector', {
    method: 'POST',
    body: JSON.stringify({ gicId, deviceId, pin }),
  })
}

// ─── Sync données (producteurs + prix) ───────────────────────────────────────

export async function fetchProducers(gicId: string) {
  return request<Array<{
    id: string
    fullName: string
    phoneMomo: string
    phoneSms: string | null
    momoOperator: string
  }>>(`/gic/${gicId}/producers`)
}

export async function fetchActiveCampaign(gicId: string) {
  return request<{
    id: string
    name: string
    status: string
    priceRules: Array<{
      id: string
      culture: string
      qualityGrade: string
      pricePerKg: number
      effectiveFrom: string
    }>
  }>(`/gic/${gicId}/campaign`)
}

// ─── Livraisons ──────────────────────────────────────────────────────────────

export interface DeliveryPayload {
  offlineUuid: string
  deviceId: string
  campaignId: string
  producerId: string
  culture: string
  quantityKg: number
  qualityGrade: string
  photoUrl?: string
  notes?: string
  createdOfflineAt: string
}

export async function syncDeliveries(deliveries: DeliveryPayload[]) {
  return request<{
    total: number
    created: number
    duplicates: number
    errors: number
    results: Array<{ offlineUuid: string; status: 'created' | 'duplicate' | 'error'; error?: string }>
  }>('/deliveries/sync', {
    method: 'POST',
    body: JSON.stringify({ deliveries }),
  })
}
