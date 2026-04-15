import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { fullSync, countPendingDeliveries } from '../sync/syncEngine'
import { getUser } from '../stores/authStore'

interface SyncScreenProps {
  gicId: string
  onNewDelivery: () => void
  onLogout: () => void
}

export default function SyncScreen({ gicId, onNewDelivery, onLogout }: SyncScreenProps) {
  const [syncing, setSyncing] = useState(false)
  const [pending, setPending] = useState(0)
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const [userName, setUserName] = useState('')

  useEffect(() => {
    refresh()
    getUser().then((u) => { if (u) setUserName(u.fullName) })
  }, [])

  async function refresh() {
    const count = await countPendingDeliveries()
    setPending(count)
  }

  async function handleSync() {
    setSyncing(true)
    try {
      const result = await fullSync(gicId)
      setLastSync(new Date())
      await refresh()
      Alert.alert(
        'Synchronisation réussie',
        result.pushed > 0
          ? `${result.pushed} livraison(s) envoyée(s) au serveur.`
          : 'Tout est à jour.'
      )
    } catch (err: any) {
      if (err.message === 'SESSION_EXPIRED') {
        Alert.alert('Session expirée', 'Veuillez vous reconnecter.', [
          { text: 'OK', onPress: onLogout },
        ])
      } else {
        Alert.alert('Erreur réseau', 'Synchronisation impossible. Les livraisons sont sauvegardées en local.')
      }
    } finally {
      setSyncing(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* En-tête */}
        <View style={styles.header}>
          <Text style={styles.logo}>🌿 AgriCollect</Text>
          <TouchableOpacity onPress={onLogout}>
            <Text style={styles.logout}>Déconnexion</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.welcome}>Bonjour, {userName.split(' ')[0]} 👋</Text>

        {/* Statut sync */}
        <View style={styles.statusCard}>
          <View style={[styles.statusDot, pending > 0 ? styles.dotPending : styles.dotOk]} />
          <View>
            <Text style={styles.statusTitle}>
              {pending > 0 ? `${pending} livraison(s) en attente` : 'Tout est synchronisé'}
            </Text>
            {lastSync && (
              <Text style={styles.statusSub}>
                Dernière sync : {lastSync.toLocaleTimeString('fr-FR')}
              </Text>
            )}
          </View>
        </View>

        {/* Actions principales */}
        <TouchableOpacity style={styles.mainBtn} onPress={onNewDelivery} activeOpacity={0.85}>
          <Text style={styles.mainBtnIcon}>📦</Text>
          <Text style={styles.mainBtnText}>Enregistrer une livraison</Text>
          <Text style={styles.mainBtnSub}>3 étapes · Fonctionne hors ligne</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.syncBtn, syncing && styles.syncBtnDisabled]}
          onPress={handleSync}
          disabled={syncing}
          activeOpacity={0.8}
        >
          {syncing ? (
            <ActivityIndicator color="#2D6A27" />
          ) : (
            <Text style={styles.syncBtnText}>
              🔄  Synchroniser{pending > 0 ? ` (${pending})` : ''}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F0E8' },
  container: { flex: 1, padding: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  logo: { fontSize: 20, fontWeight: '800', color: '#1C3D1A' },
  logout: { color: '#8B3A3A', fontSize: 14 },
  welcome: { fontSize: 26, fontWeight: '700', color: '#1C3D1A', marginBottom: 20 },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 32,
    gap: 14,
  },
  statusDot: { width: 14, height: 14, borderRadius: 7 },
  dotPending: { backgroundColor: '#E8A020' },
  dotOk: { backgroundColor: '#2D6A27' },
  statusTitle: { fontSize: 15, fontWeight: '600', color: '#1C3D1A' },
  statusSub: { fontSize: 12, color: '#5A7A55', marginTop: 2 },
  mainBtn: {
    backgroundColor: '#1C3D1A',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    marginBottom: 16,
  },
  mainBtnIcon: { fontSize: 40, marginBottom: 8 },
  mainBtnText: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  mainBtnSub: { color: '#9CAF99', fontSize: 13, marginTop: 6 },
  syncBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#2D6A27',
  },
  syncBtnDisabled: { opacity: 0.6 },
  syncBtnText: { color: '#2D6A27', fontSize: 16, fontWeight: '600' },
})
