export interface AuthUser {
  id: string
  fullName: string
  role: string
  gicId: string
  email?: string // Présent pour managers, absent pour collecteurs
}

export function getUser(): AuthUser | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem('agricollect_user')
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('agricollect_token')
}

export function saveAuth(token: string, refreshToken: string, user: AuthUser) {
  localStorage.setItem('agricollect_token', token)
  localStorage.setItem('agricollect_refresh_token', refreshToken)
  localStorage.setItem('agricollect_user', JSON.stringify(user))
}

export function clearAuth() {
  localStorage.removeItem('agricollect_token')
  localStorage.removeItem('agricollect_refresh_token')
  localStorage.removeItem('agricollect_user')
}

export function isAuthenticated(): boolean {
  return !!getToken()
}
