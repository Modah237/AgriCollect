import axios from 'axios'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Injecter le token JWT dans chaque requête
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('agricollect_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Rediriger vers /login si 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('agricollect_token')
      localStorage.removeItem('agricollect_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)
