'use client'

import { useState } from 'react'
import { trpc } from '@/lib/trpc'
import { getUser } from '@/lib/auth'

export default function DeliveriesPage() {
  const user = getUser()
  const gicId = user?.gicId ?? ''
  const [page, setPage] = useState(1)
  const [campaignId, setCampaignId] = useState('')

  const { data: campaign } = trpc.gic.getActiveCampaign.useQuery(
    { gicId },
    { enabled: !!gicId }
  )

  const { data, isLoading } = trpc.deliveries.list.useQuery(
    { 
      page, 
      limit: 20, 
      campaignId: campaignId || campaign?.id 
    },
    { enabled: !!campaign?.id || !!campaignId }
  )

  // Backend retourne { data: [], pagination: { total, pages } }
  const deliveries = data?.data ?? []
  const totalPages = data?.pagination?.pages ?? 1

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">📦 Livraisons</h2>
        <span className="text-gray-500 text-sm">{data?.pagination?.total ?? 0} livraisons au total</span>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-400">Chargement...</div>
        ) : deliveries.length === 0 ? (
          <div className="p-12 text-center text-gray-400">Aucune livraison pour cette campagne</div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr className="text-left text-gray-500">
                  <th className="px-6 py-3">Producteur</th>
                  <th className="px-6 py-3">Collecteur</th>
                  <th className="px-6 py-3">Culture</th>
                  <th className="px-6 py-3">Grade</th>
                  <th className="px-6 py-3">Quantité</th>
                  <th className="px-6 py-3">Prix/kg</th>
                  <th className="px-6 py-3">Montant</th>
                  <th className="px-6 py-3">Net dû</th>
                  <th className="px-6 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {deliveries.map((d: any) => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium">{d.producer?.fullName}</td>
                    <td className="px-6 py-3 text-gray-500">{d.collector?.fullName}</td>
                    <td className="px-6 py-3">{d.culture}</td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        d.qualityGrade === 'A' ? 'bg-green-100 text-green-700' :
                        d.qualityGrade === 'B' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>{d.qualityGrade}</span>
                    </td>
                    <td className="px-6 py-3">{Number(d.quantityKg).toFixed(1)} kg</td>
                    <td className="px-6 py-3 text-gray-600">{Number(d.pricePerKg).toLocaleString('fr-FR')}</td>
                    <td className="px-6 py-3 font-medium">{Number(d.calculatedAmount).toLocaleString('fr-FR')} XAF</td>
                    <td className="px-6 py-3 font-semibold text-green-700">{Number(d.netDue).toLocaleString('fr-FR')} XAF</td>
                    <td className="px-6 py-3 text-gray-400">{new Date(d.createdAt).toLocaleDateString('fr-FR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-4 py-2 text-sm bg-white border rounded-lg disabled:opacity-40 hover:bg-gray-50">
                  ← Précédent
                </button>
                <span className="text-sm text-gray-600">Page {page} / {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="px-4 py-2 text-sm bg-white border rounded-lg disabled:opacity-40 hover:bg-gray-50">
                  Suivant →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
