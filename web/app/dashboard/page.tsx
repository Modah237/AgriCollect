'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { getUser } from '@/lib/auth'
import { motion } from 'framer-motion'
import { 
  Users, 
  Package, 
  Weight, 
  Coins, 
  Calendar, 
  ChevronRight, 
  TrendingUp,
  LayoutDashboard
} from 'lucide-react'

function StatCard({ label, value, sub, icon: Icon, color, index }: { 
  label: string; 
  value: string | number; 
  sub?: string; 
  icon: any; 
  color: string;
  index: number;
}) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
    >
      <div className="flex justify-between items-start">
        <div>
          <p className="text-gray-500 text-sm font-medium tracking-wide uppercase">{label}</p>
          <p className="text-3xl font-extrabold text-gray-900 mt-2">{value}</p>
          {sub && <p className="text-gray-400 text-xs mt-2 flex items-center gap-1">
            <TrendingUp size={12} className="text-green-500" /> {sub}
          </p>}
        </div>
        <div className={`p-3 rounded-xl ${color}`}>
          <Icon size={24} className="text-white" />
        </div>
      </div>
    </motion.div>
  )
}

export default function DashboardPage() {
  const user = getUser()
  const gicId = user?.gicId

  // 1. Stats réelles agrégées par le serveur (Audit Step 5 fixed)
  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['gic-stats', gicId],
    queryFn: () => api.get(`/gic/${gicId}/stats`).then((r) => r.data),
    enabled: !!gicId,
  })

  // 2. Livraisons récentes (liste simple)
  const { data: deliveriesResp, isLoading: loadingDeliveries } = useQuery({
    queryKey: ['deliveries-recent', gicId],
    queryFn: () => api.get(`/deliveries?limit=5`).then((r) => r.data),
    enabled: !!gicId,
  })

  // 3. Infos GIC & Campagne
  const { data: campaign } = useQuery({
    queryKey: ['campaign-active', gicId],
    queryFn: () => api.get(`/gic/${gicId}/campaign`).then((r) => r.data),
    enabled: !!gicId,
  })

  if (loadingStats || loadingDeliveries) {
    return (
      <div className="p-8 flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 font-medium animate-pulse">Chargement du dashboard...</p>
        </div>
      </div>
    )
  }

  const recentDeliveries = deliveriesResp?.data ?? []

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Welcome Header */}
      <div className="mb-10 flex justify-between items-end">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <LayoutDashboard size={20} className="text-green-600" />
            <span className="text-green-600 font-bold text-sm tracking-widest uppercase">Overview</span>
          </div>
          <h2 className="text-3xl font-black text-gray-900 leading-tight">AgriCollect Dashboard</h2>
          <p className="text-gray-500 mt-1 font-medium">
            Gestion du GIC : <span className="text-gray-900">{stats?.campaignName || '—'}</span>
          </p>
        </div>
        <div className="bg-green-50 border border-green-100 px-4 py-2 rounded-lg flex items-center gap-3">
          <Calendar size={18} className="text-green-600" />
          <span className="text-green-800 text-sm font-semibold">{new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <StatCard
          index={0}
          label="Producteurs"
          value={stats?.producersCount ?? 0}
          sub="Membres inscrits"
          icon={Users}
          color="bg-indigo-500"
        />
        <StatCard
          index={1}
          label="Livraisons"
          value={stats?.deliveriesCount ?? 0}
          sub="Pesées effectuées"
          icon={Package}
          color="bg-blue-500"
        />
        <StatCard
          index={2}
          label="Volume Total"
          value={stats?.totalKg ? `${stats.totalKg.toLocaleString()} kg` : '0 kg'}
          sub="Campagne en cours"
          icon={Weight}
          color="bg-emerald-500"
        />
        <StatCard
          index={3}
          label="Valeur Totale"
          value={stats?.totalAmount ? `${stats.totalAmount.toLocaleString('fr-FR')} XAF` : '0 XAF'}
          sub="Montant à régler"
          icon={Coins}
          color="bg-amber-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Table Livraisons */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-50 flex justify-between items-center">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <Package size={18} className="text-gray-400" />
              Livraisons Récentes
            </h3>
            <button className="text-green-600 text-sm font-bold flex items-center gap-1 hover:underline">
              Voir tout <ChevronRight size={14} />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-400 font-bold uppercase text-[10px] tracking-widest">
                <tr>
                  <th className="px-6 py-4 text-left">Producteur</th>
                  <th className="px-6 py-4 text-left">Produit</th>
                  <th className="px-6 py-4 text-left">Quantité</th>
                  <th className="px-6 py-4 text-left">Montant</th>
                  <th className="px-6 py-4 text-left">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentDeliveries.map((d: any) => (
                  <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-bold text-gray-900">{d.producer?.fullName}</p>
                      <p className="text-gray-400 text-xs">{d.producer?.phoneMomo}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-[11px] font-black uppercase">
                        {d.culture}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-gray-700">{Number(d.quantityKg).toFixed(1)} kg</td>
                    <td className="px-6 py-4 font-black text-green-700">{Number(d.calculatedAmount).toLocaleString('fr-FR')} XAF</td>
                    <td className="px-6 py-4 text-gray-400 text-xs">
                      {new Date(d.createdAt).toLocaleDateString('fr-FR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Campagne Info Right Sidebar */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-green-600 to-green-800 rounded-2xl p-6 text-white shadow-lg">
            <h3 className="text-sm font-bold text-green-100 mb-4 uppercase tracking-widest">Campagne Active</h3>
            <p className="text-2xl font-black mb-1">{campaign?.name || 'Aucune'}</p>
            <p className="text-green-100 text-xs opacity-80 mb-6">
              Débutée le {campaign ? new Date(campaign.startDate).toLocaleDateString('fr-FR') : '—'}
            </p>
            
            <div className="space-y-4">
              {campaign?.priceRules?.slice(0, 3).map((r: any) => (
                <div key={r.id} className="bg-white/10 rounded-lg p-3 backdrop-blur-sm border border-white/10">
                  <div className="flex justify-between items-center text-[10px] font-bold uppercase opacity-80 mb-1">
                    <span>{r.culture} - Grade {r.qualityGrade}</span>
                  </div>
                  <p className="text-lg font-bold">{Number(r.pricePerKg).toLocaleString('fr-FR')} <span className="text-xs font-normal opacity-70">XAF/kg</span></p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
