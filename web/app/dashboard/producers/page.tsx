'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { getUser } from '@/lib/auth'

export default function ProducersPage() {
  const user = getUser()

  const { data: producers, isLoading } = useQuery({
    queryKey: ['producers', user?.gicId],
    queryFn: () => api.get(`/gic/${user?.gicId}/producers`).then((r) => r.data),
    enabled: !!user?.gicId,
  })

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">👨‍🌾 Producteurs</h2>
        <span className="text-gray-500 text-sm">{producers?.length ?? 0} producteurs actifs</span>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-400">Chargement...</div>
        ) : !producers?.length ? (
          <div className="p-12 text-center text-gray-400">Aucun producteur enregistré</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr className="text-left text-gray-500">
                <th className="px-6 py-3">Nom complet</th>
                <th className="px-6 py-3">Téléphone MoMo</th>
                <th className="px-6 py-3">Opérateur</th>
                <th className="px-6 py-3">SMS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {producers.map((p: any) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 font-medium">{p.fullName}</td>
                  <td className="px-6 py-3 font-mono text-gray-600">{p.phoneMomo}</td>
                  <td className="px-6 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      p.momoOperator === 'MTN' ? 'bg-yellow-100 text-yellow-800' : 'bg-orange-100 text-orange-800'
                    }`}>
                      {p.momoOperator}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-gray-500">{p.phoneSms || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
