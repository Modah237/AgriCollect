'use client'

import { useState, use } from 'react'
import { trpc } from '@/lib/trpc'
import { getUser } from '@/lib/auth'
import { getDictionary, Locale } from '@/lib/dictionaries'

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-700',
  PROCESSING: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
  PARTIAL: 'bg-yellow-100 text-yellow-700',
  CANCELLED: 'bg-red-100 text-red-700',
}

const LINE_COLORS: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-600',
  SUBMITTED: 'bg-blue-100 text-blue-700',
  CONFIRMED: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
}

interface PaymentBatch {
  id: string
  totalAmount: number
  status: string
  createdAt: string
  initiatedBy: { fullName: string }
  _count: { lines: number }
}

interface BatchLine {
  id: string
  amount: number
  status: string
  producer: { fullName: string; phoneMomo: string }
}

interface BatchDetail extends PaymentBatch {
  stats: { confirmed: number; failed: number; submitted: number }
  lines: BatchLine[]
}

interface BatchStats {
  pending: number
  submitted: number
  confirmed: number
  failed: number
  total: number
}

interface Producer {
  id: string
  fullName: string
}

export default function PaymentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params) as { locale: Locale }
  const dict = getDictionary(locale)
  const user = getUser()
  const utils = trpc.useUtils()
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null)
  const [selectedProducers, setSelectedProducers] = useState<Set<string>>(new Set())
  const [partialAmounts, setPartialAmounts] = useState<Record<string, number>>({})
  const [launching, setLaunching] = useState(false)

  const { data: campaign } = trpc.gic.getActiveCampaign.useQuery({
    gicId: user?.gicId ?? ''
  }, {
    enabled: !!user?.gicId,
  })

  // Récupérer les producteurs avec leur SOLDE RÉEL (grâce au nouveau rapport ou procédure dédiée)
  // On utilise ici getCampaignReport qui contient déjà byProducer avec totalNet et totalPaid
  const { data: report } = trpc.reports.getCampaignReport.useQuery({
    campaignId: campaign?.id ?? ''
  }, {
    enabled: !!campaign?.id,
  })

  const payableProducers = report?.byProducer.filter(p => p.totalNet > p.totalPaid) || []

  const { data: batches, isLoading } = trpc.payments.getBatches.useQuery({
    campaignId: campaign?.id
  }, {
    enabled: !!campaign?.id,
    refetchInterval: 10000,
  })

  const { data: batchDetail } = trpc.payments.getBatchDetails.useQuery({
    batchId: selectedBatch ?? ''
  }, {
    enabled: !!selectedBatch,
    refetchInterval: selectedBatch ? 5000 : false,
  })

  const launchMutation = trpc.payments.createBatch.useMutation({
    onSuccess: () => {
      utils.payments.getBatches.invalidate()
      utils.reports.getCampaignReport.invalidate()
      setLaunching(false)
      setSelectedProducers(new Set())
      setPartialAmounts({})
    },
    onError: (err) => {
      console.error(err.message)
      setLaunching(false)
    },
  })

  const cancelMutation = trpc.payments.cancelBatch.useMutation({
    onSuccess: () => {
      utils.payments.getBatches.invalidate()
      setSelectedBatch(null)
    }
  })

  function handleLaunch() {
    if (!campaign?.id || selectedProducers.size === 0) return
    const count = selectedProducers.size
    if (!confirm(dict.dashboard.payments.confirmLaunch.replace('{count}', String(count)))) return
    
    setLaunching(true)
    const producerAmounts = Array.from(selectedProducers).map(pid => ({
      producerId: pid,
      amount: partialAmounts[pid] || undefined // undefined = paie tout
    }))

    launchMutation.mutate({
      campaignId: campaign.id,
      producerAmounts
    })
  }

  const toggleProducer = (id: string) => {
    const next = new Set(selectedProducers)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedProducers(next)
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">💰 {dict.dashboard.payments.title}</h2>
          <p className="text-sm text-gray-500 mt-1">{campaign?.name}</p>
        </div>
        
        <div className="flex gap-3">
          {selectedProducers.size > 0 && (
            <button
              onClick={handleLaunch}
              disabled={launching}
              className="bg-green-700 hover:bg-green-800 disabled:bg-gray-300 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-green-100 transition-all flex items-center gap-2"
            >
              {launching ? '⏳ ...' : `🚀 ${dict.dashboard.payments.payAll} (${selectedProducers.size})`}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Section de sélection des producteurs (Paiement Partiel) */}
        <div className="lg:col-span-12 xl:col-span-8 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-gray-50/50 flex justify-between items-center">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <span className="w-2 h-6 bg-green-600 rounded-full"></span>
              {dict.dashboard.payments.history} / Sélection
            </h3>
            <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-500">
               {payableProducers.length} producteurs avec solde
            </span>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-gray-500 text-xs font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3 w-10">
                    <input 
                      type="checkbox" 
                      onChange={(e) => {
                        if (e.target.checked) setSelectedProducers(new Set(payableProducers.map(p => p.producerId)))
                        else setSelectedProducers(new Set())
                      }}
                      className="rounded border-gray-300 text-green-600"
                    />
                  </th>
                  <th className="px-6 py-3">{dict.dashboard.stats.producers}</th>
                  <th className="px-6 py-3">Solde Total</th>
                  <th className="px-6 py-3">Déjà Payé</th>
                  <th className="px-6 py-3 text-right">Reste à Payer</th>
                  <th className="px-6 py-3 text-right w-32">Montant à verser</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payableProducers.map(p => {
                  const balance = p.totalNet - p.totalPaid;
                  const isSelected = selectedProducers.has(p.producerId);
                  
                  return (
                    <tr key={p.producerId} className={`hover:bg-gray-50 transition-colors ${isSelected ? 'bg-green-50/30' : ''}`}>
                      <td className="px-6 py-4">
                        <input 
                          type="checkbox" 
                          checked={isSelected}
                          onChange={() => toggleProducer(p.producerId)}
                          className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-gray-900">{p.producerName}</p>
                        <p className="text-xs text-gray-500">{p.livraisons} livraisons</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{p.totalNet.toLocaleString()} XAF</td>
                      <td className="px-6 py-4 text-sm text-green-600 font-medium">{p.totalPaid.toLocaleString()} XAF</td>
                      <td className="px-6 py-4 text-right">
                        <p className="font-bold text-red-600">{balance.toLocaleString()} XAF</p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <input 
                          type="number"
                          placeholder={String(balance)}
                          value={partialAmounts[p.producerId] || ''}
                          onChange={(e) => {
                            setPartialAmounts({ ...partialAmounts, [p.producerId]: Number(e.target.value) })
                            if (!isSelected) toggleProducer(p.producerId)
                          }}
                          className="w-24 text-right text-sm border-gray-200 rounded-lg focus:border-green-500 focus:ring-green-500"
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Historique des Batches */}
        <div className="lg:col-span-12 xl:col-span-4 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-gray-50/50">
              <h3 className="font-bold text-gray-800">{dict.dashboard.payments.history}</h3>
            </div>
            
            <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
              {batches?.map(b => (
                <button
                  key={b.id}
                  onClick={() => setSelectedBatch(b.id)}
                  className={`w-full p-4 text-left hover:bg-gray-50 transition-all ${selectedBatch === b.id ? 'bg-green-50/50 ring-1 ring-inset ring-green-100' : ''}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-lg font-bold text-gray-900">{b.totalAmount.toLocaleString()} XAF</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-tight uppercase ${STATUS_COLORS[b.status]}`}>
                      {b.status === 'PENDING' ? 'En attente' : b.status}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{b._count.lines} producteurs</span>
                    <span>{new Date(b.createdAt).toLocaleDateString()}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {selectedBatch && batchDetail && (
            <div className="bg-white rounded-2xl border border-green-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-right-4">
              <div className="p-4 border-b bg-green-50 flex justify-between items-center">
                <h3 className="font-bold text-green-900">{dict.dashboard.payments.detail}</h3>
                {batchDetail.status === 'PENDING' && (
                  <button
                    onClick={() => confirm('Annuler ce lot ?') && cancelMutation.mutate({ batchId: batchDetail.id })}
                    className="text-xs text-red-600 font-bold hover:underline"
                  >
                    Annuler
                  </button>
                )}
              </div>
              <div className="p-4 bg-gray-50/50 border-b flex gap-2 text-[10px]">
                <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{(batchDetail.stats as BatchStats).confirmed} {dict.dashboard.payments.stats.confirmed}</span>
                <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{(batchDetail.stats as BatchStats).failed} {dict.dashboard.payments.stats.failed}</span>
                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{(batchDetail.stats as BatchStats).submitted} {dict.dashboard.payments.stats.pending}</span>
              </div>
            <div className="divide-y max-h-[300px] overflow-y-auto">
              {batchDetail.lines.map((l: BatchLine) => (
                <div key={l.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <div>
                      <p className="text-sm font-bold text-gray-800">{l.producer.fullName}</p>
                      <p className="text-[10px] text-gray-400 font-mono italic">{l.producer.phoneMomo}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-gray-900">{l.amount.toLocaleString()} <span className="text-[10px]">XAF</span></p>
                      <span className={`text-[10px] font-bold ${l.status === 'CONFIRMED' ? 'text-green-600' : 'text-orange-500'}`}>
                        {l.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
