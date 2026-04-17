'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { getUser } from '@/lib/auth'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// ─── Utilitaire téléchargement avec token JWT ────────────────────────────────

async function downloadFile(url: string, filename: string, mimeType: string) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('agricollect_token') : null
  const res = await fetch(url, {
    method: url.includes('/export') ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })

  if (!res.ok) throw new Error(`HTTP ${res.status}`)

  const blob = await res.blob()
  const blobUrl = URL.createObjectURL(new Blob([blob], { type: mimeType }))
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = filename
  a.click()
  URL.revokeObjectURL(blobUrl)
}

export default function CampaignsPage() {
  const user = getUser()
  const [exporting, setExporting] = useState<'pdf' | 'csv' | null>(null)

  const { data: campaign, isLoading } = useQuery({
    queryKey: ['campaign', user?.gicId],
    queryFn: () => api.get(`/gic/${user?.gicId}/campaign`).then((r) => r.data),
    enabled: !!user?.gicId,
  })

  async function handleExport(type: 'pdf' | 'csv') {
    if (!campaign?.id) return
    setExporting(type)
    try {
      if (type === 'pdf') {
        await downloadFile(
          `${BASE_URL}/reports/campaign/${campaign.id}/export`,
          `AgriCollect_${campaign.name.replace(/\s+/g, '_')}.pdf`,
          'application/pdf',
        )
      } else {
        await downloadFile(
          `${BASE_URL}/exports/campaign/${campaign.id}/csv`,
          `AgriCollect_${campaign.name.replace(/\s+/g, '_')}.csv`,
          'text/csv',
        )
      }
    } catch (err) {
      alert('Erreur lors du téléchargement. Vérifiez que des livraisons existent.')
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">📅 Campagnes</h2>

      {isLoading ? (
        <div className="text-gray-400">Chargement...</div>
      ) : !campaign ? (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-400">
          Aucune campagne active. Créez-en une depuis le backend.
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm p-6 max-w-2xl">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">{campaign.name}</h3>
              <p className="text-gray-400 text-sm mt-1">
                Du {new Date(campaign.startDate).toLocaleDateString('fr-FR')}
                {campaign.endDate ? ` au ${new Date(campaign.endDate).toLocaleDateString('fr-FR')}` : ' (en cours)'}
              </p>
            </div>
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
              {campaign.status}
            </span>
          </div>

          <h4 className="font-medium text-gray-700 mb-3">Règles de prix</h4>
          <div className="space-y-2 mb-8">
            {campaign.priceRules?.length === 0 ? (
              <p className="text-gray-400 text-sm">Aucune règle de prix définie</p>
            ) : (
              campaign.priceRules?.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                  <div>
                    <span className="font-medium text-gray-800">{r.culture}</span>
                    <span className="ml-2 px-2 py-0.5 bg-white border rounded text-xs text-gray-600">
                      Grade {r.qualityGrade}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-green-700">{Number(r.pricePerKg).toLocaleString('fr-FR')} XAF/kg</p>
                    <p className="text-xs text-gray-400">
                      depuis {new Date(r.effectiveFrom).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* ── Export ────────────────────────────────────────────────────── */}
          <div className="border-t pt-6">
            <h4 className="font-medium text-gray-700 mb-3">Exports</h4>
            <div className="flex gap-3">
              <button
                onClick={() => handleExport('pdf')}
                disabled={!!exporting}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {exporting === 'pdf' ? (
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                ) : (
                  <span>📄</span>
                )}
                {exporting === 'pdf' ? 'Génération...' : 'Rapport PDF'}
              </button>

              <button
                onClick={() => handleExport('csv')}
                disabled={!!exporting}
                className="flex items-center gap-2 px-4 py-2 bg-green-700 hover:bg-green-800 disabled:bg-green-300 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {exporting === 'csv' ? (
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                ) : (
                  <span>📊</span>
                )}
                {exporting === 'csv' ? 'Export...' : 'Export CSV (Excel)'}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Les exports incluent toutes les livraisons de la campagne active.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
