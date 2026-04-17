import { trpc } from '@/lib/trpc'
import { getUser } from '@/lib/auth'

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

export default function PaymentsPage() {
  const user = getUser()
  const utils = trpc.useUtils()
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null)
  const [launching, setLaunching] = useState(false)

  const { data: campaign } = trpc.gic.getActiveCampaign.useQuery({ 
    gicId: user?.gicId ?? '' 
  }, {
    enabled: !!user?.gicId,
  })

  const { data: producers } = trpc.gic.getProducers.useQuery({ 
    gicId: user?.gicId ?? '' 
  }, {
    enabled: !!user?.gicId,
  })

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
      setLaunching(false)
      alert('Paiement lancé avec succès !')
    },
    onError: (err) => {
      alert(err.message || 'Erreur lors du lancement')
      setLaunching(false)
    },
  })

  function handleLaunch() {
    if (!campaign?.id || !producers?.length) return
    if (!confirm(`Lancer le paiement pour ${producers.length} producteurs ?`)) return
    setLaunching(true)
    launchMutation.mutate()
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">💰 Paiements</h2>
        <button
          onClick={handleLaunch}
          disabled={!campaign?.id || !producers?.length || launching}
          className="bg-green-700 hover:bg-green-800 disabled:bg-gray-300 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors"
        >
          {launching ? '⏳ Lancement...' : '🚀 Payer tous les producteurs'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Liste des batches */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-gray-50">
            <h3 className="font-semibold text-gray-700">Historique des paiements</h3>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-gray-400">Chargement...</div>
          ) : !batches?.length ? (
            <div className="p-8 text-center text-gray-400">Aucun paiement initié</div>
          ) : (
            <div className="divide-y">
              {batches.map((b: any) => (
                <button
                  key={b.id}
                  onClick={() => setSelectedBatch(b.id)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${selectedBatch === b.id ? 'bg-green-50 border-l-4 border-green-600' : ''
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{Number(b.totalAmount).toLocaleString('fr-FR')} XAF</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {b._count?.lines ?? 0} producteurs · {new Date(b.createdAt).toLocaleDateString('fr-FR')}
                      </p>
                      <p className="text-xs text-gray-400">par {b.initiatedBy?.fullName}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[b.status]}`}>
                      {b.status}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Détail du batch sélectionné */}
        {selectedBatch && batchDetail && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
              <h3 className="font-semibold text-gray-700">Détail du batch</h3>
              <div className="flex gap-2 text-xs">
                <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{batchDetail.stats?.confirmed} confirmés</span>
                <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{batchDetail.stats?.failed} échoués</span>
                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{batchDetail.stats?.submitted} en attente</span>
              </div>
            </div>
            <div className="divide-y max-h-96 overflow-y-auto">
              {batchDetail.lines?.map((l: any) => (
                <div key={l.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{l.producer?.fullName}</p>
                    <p className="text-xs text-gray-400 font-mono">{l.producer?.phoneMomo}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{Number(l.amount).toLocaleString('fr-FR')} XAF</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${LINE_COLORS[l.status]}`}>
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
  )
}
