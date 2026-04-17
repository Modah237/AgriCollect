"use client"

import { useState, use } from 'react'
import { getUser } from '@/lib/auth'
import { getDictionary, Locale } from '@/lib/dictionaries'
import { trpc } from '@/lib/trpc'

export default function CampaignsPage({ params }: { params: Promise<{ locale: string }> }) {
  const user = getUser()
  const [exporting, setExporting] = useState<'pdf' | 'csv' | null>(null)
  const { locale } = use(params) as { locale: Locale }
  const dict = getDictionary(locale)

  const { data: campaign, isLoading } = trpc.gic.getActiveCampaign.useQuery(
    { gicId: user?.gicId ?? '' },
    { enabled: !!user?.gicId }
  )

  const exportPdfMutation = trpc.reports.exportCampaignPdf.useMutation()
  const exportCsvMutation = trpc.exports.exportCampaignCsv.useMutation()

  async function handleExport(type: 'pdf' | 'csv') {
    if (!campaign?.id) {
      alert('Aucune campagne active pour l\'exportation.')
      return
    }
    setExporting(type)
    try {
      if (type === 'pdf') {
        const result = await exportPdfMutation.mutateAsync({ campaignId: campaign.id })
        const bytes = Uint8Array.from(atob(result.data), (c) => c.charCodeAt(0))
        const pdfBlob = new Blob([bytes], { type: result.contentType })
        const url = URL.createObjectURL(pdfBlob)
        const a = document.createElement('a')
        a.href = url
        a.download = result.filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      } else {
        const result = await exportCsvMutation.mutateAsync({ campaignId: campaign.id })
        const csvBlob = new Blob([result.data], { type: result.contentType })
        const url = URL.createObjectURL(csvBlob)
        const a = document.createElement('a')
        a.href = url
        a.download = result.filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      console.error('Export error:', err)
      let errorMessage = 'Erreur lors du téléchargement.'
      if (err instanceof Error) {
        errorMessage += ` ${err.message}`
      }
      alert(errorMessage)
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">📅 {dict.dashboard.stats.campaigns}</h2>

      {isLoading ? (
        <div className="text-gray-400">{dict.common.loading}</div>
      ) : !campaign ? (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-400">
          {dict.dashboard.noActiveCampaign}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm p-6 max-w-2xl">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">{campaign.name}</h3>
              <p className="text-gray-400 text-sm mt-1">
                Du {new Date(campaign.startDate).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US')}
                {campaign.endDate
                  ? ` au ${new Date(campaign.endDate).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US')}`
                  : ` (${dict.common.inProgress})`}
              </p>
            </div>
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
              {campaign.status}
            </span>
          </div>

          <h4 className="font-medium text-gray-700 mb-3">{dict.campaigns.priceRules}</h4>
          <div className="space-y-2 mb-8">
            {campaign.priceRules?.length === 0 ? (
              <p className="text-gray-400 text-sm">{dict.campaigns.noPriceRules}</p>
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
                      {dict.campaigns.since} {new Date(r.effectiveFrom || '').toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US')}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* ── Export ────────────────────────────────────────────────────── */}
          <div className="border-t pt-6">
            <h4 className="font-medium text-gray-700 mb-3">{dict.common.exports}</h4>
            <div className="flex gap-3">
              <button
                onClick={() => handleExport('pdf')}
                disabled={!!exporting}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {exporting === 'pdf' ? (
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <span>📄</span>
                )}
                {exporting === 'pdf' ? dict.common.generating : dict.reports.pdfReport}
              </button>

              <button
                onClick={() => handleExport('csv')}
                disabled={!!exporting}
                className="flex items-center gap-2 px-4 py-2 bg-green-700 hover:bg-green-800 disabled:bg-green-300 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {exporting === 'csv' ? (
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <span>📊</span>
                )}
                {exporting === 'csv' ? dict.common.exporting : dict.exports.csvExport}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {dict.exports.includesAllDeliveries}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
