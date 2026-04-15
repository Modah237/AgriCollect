'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { getUser, clearAuth } from '@/lib/auth'

const navItems = [
  { href: '/dashboard', label: 'Tableau de bord', icon: '📊' },
  { href: '/dashboard/deliveries', label: 'Livraisons', icon: '📦' },
  { href: '/dashboard/producers', label: 'Producteurs', icon: '👨‍🌾' },
  { href: '/dashboard/payments', label: 'Paiements', icon: '💰' },
  { href: '/dashboard/campaigns', label: 'Campagnes', icon: '📅' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [userName, setUserName] = useState('')

  useEffect(() => {
    const user = getUser()
    if (!user) {
      router.push('/login')
      return
    }
    setUserName(user.fullName)
  }, [router])

  function handleLogout() {
    clearAuth()
    document.cookie = 'agricollect_token=; path=/; max-age=0'
    router.push('/login')
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-green-900 text-white flex flex-col">
        <div className="p-6 border-b border-green-700">
          <h1 className="text-xl font-bold">🌱 AgriCollect</h1>
          <p className="text-green-300 text-xs mt-1">Dashboard Gestionnaire</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
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

        <div className="p-4 border-t border-green-700">
          <div className="text-green-300 text-xs mb-2 truncate">{userName}</div>
          <button
            onClick={handleLogout}
            className="w-full text-left text-sm text-green-400 hover:text-white transition-colors px-3 py-2"
          >
            🚪 Déconnexion
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
