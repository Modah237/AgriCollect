'use client'

import { useEffect, useState, use } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { getUser, clearAuth } from '@/lib/auth'
import { getDictionary, Locale } from '@/lib/dictionaries'

export default function DashboardLayout({
  children,
  params
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = use(params) as { locale: Locale }
  const dict = getDictionary(locale)
  const router = useRouter()
  const pathname = usePathname()
  const [userName, setUserName] = useState('')

  const navItems = [
    { href: `/${locale}/dashboard`, label: dict.common.dashboard, icon: '📊' },
    { href: `/${locale}/dashboard/deliveries`, label: dict.dashboard.stats.deliveries, icon: '📦' },
    { href: `/${locale}/dashboard/producers`, label: dict.dashboard.stats.producers, icon: '👨‍🌾' },
    { href: `/${locale}/dashboard/payments`, label: dict.dashboard.stats.payments, icon: '💰' },
    { href: `/${locale}/dashboard/campaigns`, label: dict.dashboard.stats.campaigns, icon: '📅' },
  ]

  // Note: Localisation des labels spécifiques du dashboard si nécessaire
  // J'ai mis des fallback car mon dictionaries.ts est encore minimal.

  useEffect(() => {
    const user = getUser()
    if (!user) {
      router.push(`/${locale}/login`)
      return
    }
    setUserName(user.fullName)
  }, [router, locale])

  function handleLogout() {
    clearAuth()
    document.cookie = 'token=; path=/; max-age=0'
    router.push(`/${locale}/login`)
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-green-900 text-white flex flex-col">
        <div className="p-6 border-b border-green-700">
          <h1 className="text-xl font-bold">🌱 {dict.common.appName}</h1>
          <p className="text-green-300 text-xs mt-1">{dict.auth.subtitle}</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive
                  ? 'bg-green-700 text-white'
                  : 'text-green-200 hover:bg-green-800 hover:text-white'
                  }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-green-700 space-y-2">
          {/* Language Switcher */}
          <div className="flex gap-2">
            <Link
              href={pathname.replace(`/${locale}`, '/fr')}
              className={`flex-1 text-center py-1 rounded text-[10px] font-bold border transition-colors ${locale === 'fr' ? 'bg-green-100 text-green-900 border-green-100' : 'text-green-400 border-green-700 hover:text-white'
                } border-green-700`}
            >
              FR
            </Link>
            <Link
              href={pathname.replace(`/${locale}`, '/en')}
              className={`flex-1 text-center py-1 rounded text-[10px] font-bold border transition-colors ${locale === 'en' ? 'bg-green-100 text-green-900 border-green-100' : 'text-green-400 border-green-700 hover:text-white'
                } border-green-700`}
            >
              EN
            </Link>
          </div>

          <div className="text-green-300 text-xs mb-2 truncate px-3">{userName}</div>
          <button
            onClick={handleLogout}
            className="w-full text-left text-sm text-green-400 hover:text-white transition-colors px-3 py-2"
          >
            🚪 {dict.common.logout}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
