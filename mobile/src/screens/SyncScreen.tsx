import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { fullSync, countPendingDeliveries } from '../sync/syncEngine'
import { getUser } from '../stores/authStore'
import { db, SQLiteDelivery } from '../db/database'

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
  const [recentDeliveries, setRecentDeliveries] = useState<SQLiteDelivery[]>([])

  useEffect(() => {
    refresh()
    getUser().then((u) => { if (u) setUserName(u.fullName) })
  }, [])

  async function refresh() {
    const count = await countPendingDeliveries()
    setPending(count)
    
    // Charger les 3 dernières livraisons pour l'affichage 'Activité'
    const recent: SQLiteDelivery[] = await db.getAllAsync(
      'SELECT * FROM deliveries ORDER BY created_offline_at DESC LIMIT 3'
    );
    
    setRecentDeliveries(recent)
  }

  async function handleSync() {
    setSyncing(true)
    try {
      const result = await fullSync(gicId)
      setLastSync(new Date())
      await refresh()
      Alert.alert(
        'Synchronisation',
        result.pushed > 0 ? `${result.pushed} livraisons envoyées.` : 'Tout est à jour !'
      )
    } catch (err: any) {
      if (err.message === 'SESSION_EXPIRED') {
        Alert.alert('Session expirée', 'Reconnectez-vous.', [{ text: 'OK', onPress: onLogout }])
      } else {
        Alert.alert('Erreur', 'Impossible de joindre le serveur.')
      }
    } finally {
      setSyncing(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>🌿 AgriCollect</Text>
          <TouchableOpacity onPress={onLogout} style={styles.logoutBtn}>
            <Ionicons name="log-out-outline" size={20} color="#8B3A3A" />
          </TouchableOpacity>
        </View>

        <Text style={styles.welcome}>Bonjour, {userName.split(' ')[0]} 👋</Text>

        {/* Dashboard Status */}
        <LinearGradient
          colors={pending > 0 ? ['#F2994A', '#F2C94C'] : ['#2D6A27', '#1C3D1A']}
          style={styles.statusCard}
        >
          <View style={styles.statusIcon}>
            <Ionicons 
              name={pending > 0 ? "cloud-upload-outline" : "cloud-done-outline"} 
              size={32} 
              color="#FFFFFF" 
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.statusTitle}>
              {pending > 0 ? `${pending} pesées à envoyer` : 'Tout est sécurisé'}
            </Text>
            <Text style={styles.statusSub}>
              {lastSync 
                ? `Dernière sync : ${lastSync.toLocaleTimeString('fr-FR')} ` 
                : 'En attente de synchronisation'}
            </Text>
          </View>
        </LinearGradient>

        {/* Action Button */}
        <TouchableOpacity style={styles.mainBtn} onPress={onNewDelivery} activeOpacity={0.9}>
          <View style={styles.mainBtnIcon}>
            <Ionicons name="add-circle" size={40} color="#FFFFFF" />
          </View>
          <View>
            <Text style={styles.mainBtnText}>Nouvelle Pesée</Text>
            <Text style={styles.mainBtnSub}>Enregistrer une livraison</Text>
          </View>
        </TouchableOpacity>

        {/* Sync Button */}
        <TouchableOpacity 
          style={[styles.syncBtn, syncing && styles.syncBtnDisabled]} 
          onPress={handleSync}
          disabled={syncing}
        >
          {syncing ? (
            <ActivityIndicator color="#2D6A27" />
          ) : (
            <View style={styles.syncContent}>
              <Ionicons name="refresh-outline" size={20} color="#2D6A27" />
              <Text style={styles.syncBtnText}>Synchroniser tout</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Activité récente */}
        <View style={styles.activitySection}>
          <Text style={styles.sectionTitle}>ACTIVITÉ RÉCENTE</Text>
          {recentDeliveries.length === 0 ? (
            <Text style={styles.emptyText}>Aucune livraison pour le moment.</Text>
          ) : (
            recentDeliveries.map((d) => (
              <View key={d.offline_uuid} style={styles.activityCard}>
                <View style={styles.activityIcon}>
                  <Ionicons name="cube-outline" size={18} color="#2D6A27" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.activityText}>{d.quantity_kg} kg de {d.culture}</Text>
                  <Text style={styles.activityDate}>
                    {new Date(d.created_offline_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                {d.is_synced ? (
                  <Ionicons name="checkmark-circle" size={20} color="#2D6A27" />
                ) : (
                  <Ionicons name="time-outline" size={20} color="#F2994A" />
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F6F2' },
  container: { flex: 1, padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  logo: { fontSize: 18, fontWeight: '900', color: '#1C3D1A', letterSpacing: 0.5 },
  logoutBtn: { padding: 8, backgroundColor: '#FFFFFF', borderRadius: 10, elevation: 1 },
  welcome: { fontSize: 28, fontWeight: '800', color: '#1C3D1A', marginBottom: 24 },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    elevation: 4,
    shadowColor: '#2D6A27',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  statusIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  statusTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  statusSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 4 },
  mainBtn: {
    backgroundColor: '#1C3D1A',
    borderRadius: 24,
    padding: 24,
    flexDirection: 'row', 
    alignItems: 'center',
    marginBottom: 16,
    elevation: 4,
  },
  mainBtnIcon: { marginRight: 16 },
  mainBtnText: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  mainBtnSub: { color: '#9CAF99', fontSize: 13, marginTop: 2 },
  syncBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#2D6A27',
    marginBottom: 32,
  },
  syncContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  syncBtnText: { color: '#2D6A27', fontSize: 16, fontWeight: '700' },
  syncBtnDisabled: { opacity: 0.5 },
  activitySection: { marginBottom: 40 },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: '#9CAF99', letterSpacing: 1.5, marginBottom: 16 },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 1,
  },
  activityIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F0F5F0', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  activityText: { fontSize: 15, fontWeight: '700', color: '#1C3D1A' },
  activityDate: { fontSize: 12, color: '#9CAF99', marginTop: 2 },
  emptyText: { color: '#9CAF99', fontSize: 14, textAlign: 'center', marginTop: 20 },
})
