import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'

const KEYS = {
  ACCESS_TOKEN: 'agricollect_access_token',
  REFRESH_TOKEN: 'agricollect_refresh_token',
  USER: 'agricollect_user',
  GIC_ID: 'agricollect_gic_id',
  DEVICE_ID: 'agricollect_device_id',
  CAMPAIGN_ID: 'agricollect_campaign_id',
}

export interface AuthUser {
  id: string
  fullName: string
  role: string
  gicId: string
}

// ─── Wrapper stockage (SecureStore sur natif, localStorage sur web) ───────────

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value)
  } else {
    await SecureStore.setItemAsync(key, value)
  }
}

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(key)
  }
  return SecureStore.getItemAsync(key)
}

async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem(key)
  } else {
    await SecureStore.deleteItemAsync(key)
  }
}

// ─── Stockage sécurisé ───────────────────────────────────────────────────────

export async function saveTokens(accessToken: string, refreshToken: string): Promise<void> {
  await Promise.all([
    setItem(KEYS.ACCESS_TOKEN, accessToken),
    setItem(KEYS.REFRESH_TOKEN, refreshToken),
  ])
}

export async function saveUser(user: AuthUser): Promise<void> {
  await setItem(KEYS.USER, JSON.stringify(user))
}

export async function getAccessToken(): Promise<string | null> {
  return getItem(KEYS.ACCESS_TOKEN)
}

export async function getRefreshToken(): Promise<string | null> {
  return getItem(KEYS.REFRESH_TOKEN)
}

export async function getUser(): Promise<AuthUser | null> {
  const raw = await getItem(KEYS.USER)
  return raw ? JSON.parse(raw) : null
}

export async function getGicId(): Promise<string | null> {
  return getItem(KEYS.GIC_ID)
}

export async function saveGicId(gicId: string): Promise<void> {
  await setItem(KEYS.GIC_ID, gicId)
}

export async function getCampaignId(): Promise<string | null> {
  return getItem(KEYS.CAMPAIGN_ID)
}

export async function saveCampaignId(campaignId: string): Promise<void> {
  await setItem(KEYS.CAMPAIGN_ID, campaignId)
}

// ─── Device ID persistant ────────────────────────────────────────────────────

export async function getOrCreateDeviceId(): Promise<string> {
  let deviceId = await getItem(KEYS.DEVICE_ID)
  if (!deviceId) {
    deviceId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
    await setItem(KEYS.DEVICE_ID, deviceId)
  }
  return deviceId
}

// ─── Déconnexion ─────────────────────────────────────────────────────────────

export async function clearAuth(): Promise<void> {
  await Promise.all([
    deleteItem(KEYS.ACCESS_TOKEN),
    deleteItem(KEYS.REFRESH_TOKEN),
    deleteItem(KEYS.USER),
    // On conserve DEVICE_ID et GIC_ID entre les sessions
  ])
}
