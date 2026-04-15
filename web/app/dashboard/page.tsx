'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { getUser } from '@/lib/auth'

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className={`bg-white rounded-xl p-6 border-l-4 shadow-sm ${color}`}>
      <p className="text-gray-500 text-sm">{label}</p>
      <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-gray-400 text-xs mt-1">{sub}</p>}
    </div>
  )
}

export default function DashboardPage() {
  const user = getUser()
  const gicId = user?.gicId

  const { data: gic, isLoading: loadingGic } = useQuery({
    queryKey: ['gic', gicId],
    queryFn: () => api.get(`/gic/${gicId}`).then((r) => r.data),
    enabled: !!gicId,
  })

  const { data: campaign, isLoading: loadingCampaign } = useQuery({
    queryKey: ['campaign', gicId],
    queryFn: () => api.get(`/gic/${gicId}/campaign`).then((r) => r.data),
    enabled: !!gicId,
  })

  // Backend retourne { data: [], pagination: {} }
  const { data: deliveriesResp } = useQuery({
    queryKey: ['deliveries-recent', campaign?.id],
    queryFn: () => api.get(`/deliveries?campaignId=${campaign.id}&limit=5`).then((r) => r.data),
    enabled: !!campaign?.id,
  })

  const isLoading = loadingGic || loadingCampaign

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="text-gray-400">Chargement...</div>
      </div>
    )
  }

  // Backend retourne { data, pagination } — pas { deliveries }
  const recentDeliveries = deliveriesResp?.data ?? []
  const totalKg = recentDeliveries.reduce((s: number, d: any) => s + Number(d.quantityKg), 0)
  const totalAmount = recentDeliveries.reduce((s: number, d: any) => s + Number(d.calculatedAmount), 0)
  // Backend retourne _count.producers (pas producerCount)
  const producerCount = gic?._count?.producers ?? '—'

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">{gic?.name ?? 'Mon GIC'}</h2>
        <p className="text-gray-500 mt-1">
          {campaign
            ? `Campagne active : ${campaign.name}`
            : 'Aucune campagne active'}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Producteurs"
          value={producerCount}
          sub="membres actifs"
          color="border-green-500"
        />
        <StatCard
          label="Livraisons"
          value={deliveriesResp?.pagination?.total ?? '—'}
          sub="cette campagne"
          color="border-blue-500"
        />
        <StatCard
          label="Volume collecté"
          value={totalKg > 0 ? `${totalKg.toFixed(1)} kg` : '—'}
          sub="dernières 5 livraisons"
          color="border-yellow-500"
        />
        <StatCard
          label="Montant dû"
          value={totalAmount > 0 ? `${totalAmount.toLocaleString('fr-FR')} XAF` : '—'}
          sub="dernières 5 livraisons"
          color="border-orange-500"
        />
      </div>

      {/* Campagne active */}
      {campaign && (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h3 className="font-semibold text-gray-800 mb-4">📅 Campagne en cours</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Nom</span>
              <p className="font-medium">{campaign.name}</p>
            </div>
            <div>
              <span className="text-gray-400">Statut</span>
              <p>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  {campaign.status}
                </span>
              </p>
            </div>
            <div>
              <span className="text-gray-400">Début</span>
              <p className="font-medium">{new Date(campaign.startDate).toLocaleDateString('fr-FR')}</p>
            </div>
            <div>
              <span className="text-gray-400">Prix actifs</span>
              <p className="font-medium">{campaign.priceRules?.length ?? 0} règles</p>
            </div>
          </div>

          {campaign.priceRules?.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-sm text-gray-500 mb-2">Prix actuels :</p>
              <div className="flex flex-wrap gap-2">
                {campaign.priceRules.map((r: any) => (
                  <span key={r.id} className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs">
                    {r.culture} grade {r.qualityGrade} — {Number(r.pricePerKg).toLocaleString('fr-FR')} XAF/kg
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Livraisons récentes */}
      {recentDeliveries.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="font-semibold text-gray-800 mb-4">📦 Dernières livraisons</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b">
                <th className="pb-2">Producteur</th>
                <th className="pb-2">Culture</th>
                <th className="pb-2">Quantité</th>
                <th className="pb-2">Montant</th>
                <th className="pb-2">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recentDeliveries.map((d: any) => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="py-2 font-medium">{d.producer?.fullName}</td>
                  <td className="py-2 text-gray-600">{d.culture} ({d.qualityGrade})</td>
                  <td className="py-2">{Number(d.quantityKg).toFixed(1)} kg</td>
                  <td className="py-2 font-medium text-green-700">
                    {Number(d.calculatedAmount).toLocaleString('fr-FR')} XAF
                  </td>
                  <td className="py-2 text-gray-400">
                    {new Date(d.createdAt).toLocaleDateString('fr-FR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
