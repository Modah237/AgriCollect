import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native'
import NumPad from '../components/NumPad'
import { loginCollector } from '../services/api'
import {
  saveTokens,
  saveUser,
  saveGicId,
  getOrCreateDeviceId,
  getGicId,
} from '../stores/authStore'

interface LoginScreenProps {
  onLoginSuccess: () => void
}

const PIN_LENGTH = 4
// GIC ID fixé pour le collecteur — en production, scanné via QR code ou pré-configuré
const DEFAULT_GIC_ID = process.env.EXPO_PUBLIC_GIC_ID ?? ''

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [gicId, setGicId] = useState(DEFAULT_GIC_ID)

  useEffect(() => {
    // Récupérer le GIC ID sauvegardé (si déjà configuré)
    getGicId().then((saved) => { if (saved) setGicId(saved) })
  }, [])

  useEffect(() => {
    if (pin.length === PIN_LENGTH) {
      handleLogin()
    }
  }, [pin])

  async function handleLogin() {
    if (!gicId) {
      Alert.alert('Configuration', 'GIC ID non configuré. Contactez votre gestionnaire.')
      setPin('')
      return
    }

    setLoading(true)
    try {
      const deviceId = await getOrCreateDeviceId()
      const result = await loginCollector(gicId, deviceId, pin)

      await Promise.all([
        saveTokens(result.accessToken, result.refreshToken),
        saveUser(result.user),
        saveGicId(gicId),
      ])

      onLoginSuccess()
    } catch (err: any) {
      const msg = err.message === 'PIN incorrect'
        ? 'PIN incorrect. Réessayez.'
        : 'Connexion impossible. Vérifiez votre réseau.'
      Alert.alert('Erreur', msg)
      setPin('')
    } finally {
      setLoading(false)
    }
  }

  // Affichage des points du PIN
  const dots = Array.from({ length: PIN_LENGTH }, (_, i) => i < pin.length)

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Logo / Titre */}
        <View style={styles.header}>
          <Text style={styles.logo}>🌿</Text>
          <Text style={styles.title}>AgriCollect</Text>
          <Text style={styles.subtitle}>Entrez votre PIN</Text>
        </View>

        {/* Indicateur PIN */}
        <View style={styles.dotsRow}>
          {dots.map((filled, i) => (
            <View key={i} style={[styles.dot, filled && styles.dotFilled]} />
          ))}
        </View>

        {/* Chargement */}
        {loading ? (
          <ActivityIndicator size="large" color="#2D6A27" style={{ marginTop: 40 }} />
        ) : (
          <NumPad value={pin} onChange={setPin} maxLength={PIN_LENGTH} />
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F0E8' },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  header: { alignItems: 'center' },
  logo: { fontSize: 64, marginBottom: 8 },
  title: { fontSize: 32, fontWeight: '800', color: '#1C3D1A', letterSpacing: 1 },
  subtitle: { fontSize: 16, color: '#5A7A55', marginTop: 8 },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginVertical: 16,
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#2D6A27',
    backgroundColor: 'transparent',
  },
  dotFilled: { backgroundColor: '#2D6A27' },
})
