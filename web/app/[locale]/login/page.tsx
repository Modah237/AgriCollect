'use client'

import { useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { trpc } from '@/lib/trpc'
import { saveAuth } from '@/lib/auth'
import { getDictionary, Locale } from '@/lib/dictionaries'
import Cookies from 'js-cookie'

export default function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params) as { locale: Locale }
  const dict = getDictionary(locale)
  const router = useRouter()
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const loginMutation = trpc.auth.loginManager.useMutation({
    onSuccess: (data) => {
      const { accessToken, refreshToken, user } = data
      saveAuth(accessToken, refreshToken, user as any)
      
      Cookies.set('token', accessToken, { expires: 7, sameSite: 'Strict' })
      
      router.push(`/${locale}/dashboard`)
    },
    onError: (err) => {
      setError(err.message || dict.common.error)
    }
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    loginMutation.mutate({ email, password })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-900 to-green-700">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <span className="text-3xl">🌱</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{dict.common.appName}</h1>
          <p className="text-gray-500 mt-1">{dict.auth.subtitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {dict.auth.email}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="admin@agricollect.cm"
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {dict.auth.password}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loginMutation.isPending}
            className="w-full bg-green-700 hover:bg-green-800 disabled:bg-green-400 text-white font-semibold py-2.5 rounded-lg transition-colors"
          >
            {loginMutation.isPending ? dict.common.loading : dict.auth.signIn}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          {dict.common.appName} · {dict.auth.subtitle}
        </p>
      </div>
    </div>
  )
}
