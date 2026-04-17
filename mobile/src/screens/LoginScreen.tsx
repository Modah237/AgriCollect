import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Animated,
  StatusBar,
  Dimensions,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import NumPad from '../components/NumPad'
import { trpc } from '../lib/trpc'
import {
  saveTokens,
  saveUser,
  saveGicId,
  getOrCreateDeviceId,
  getGicId,
} from '../stores/authStore'

const PIN_LENGTH = 4
const DEFAULT_GIC_ID = process.env.EXPO_PUBLIC_GIC_ID ?? ''
  const [pin, setPin] = useState('')
  const [gicId, setGicId] = useState(DEFAULT_GIC_ID)
  
  const loginMutation = trpc.auth.loginCollector.useMutation({
    onSuccess: async (result) => {
      await Promise.all([
        saveTokens(result.accessToken, result.refreshToken),
        saveUser(result.user),
        saveGicId(gicId),
      ]);
      onLoginSuccess();
    },
    onError: (err) => {
      shake();
      const msg = err.message === 'PIN incorrect' ? 'PIN incorrect' : 'Erreur de connexion';
      Alert.alert('Accès refusé', msg);
      setPin('');
    }
  });

  const shakeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    getGicId().then((saved) => { if (saved) setGicId(saved) })
  }, [])

  useEffect(() => {
    if (pin.length === PIN_LENGTH) {
      handleLogin()
    }
  }, [pin])

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start()
  }

  async function handleLogin() {
    if (!gicId) {
      Alert.alert('Configuration', 'GIC ID non configuré.')
      setPin('')
      return
    }

    const deviceId = await getOrCreateDeviceId()
    loginMutation.mutate({ gicId, deviceId, pin })
  }

  const dots = Array.from({ length: PIN_LENGTH }, (_, i) => i < pin.length)

  return (
    <View style={styles.main}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#1C3D1A', '#2D6A27', '#3E8E36']}
        style={styles.gradient}
      >
        <View style={styles.overlay}>
          {/* Header Premium */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Text style={styles.logoEmoji}>🌿</Text>
            </View>
            <Text style={styles.title}>AgriCollect</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>COLLECTEUR</Text>
            </View>
          </View>

          {/* Saisie PIN avec Shake */}
          <View style={styles.centerSection}>
            <Text style={styles.subtitle}>Saisissez votre code personnel</Text>
            <Animated.View style={[styles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}>
              {dots.map((filled, i) => (
                <View key={i} style={[styles.dot, filled && styles.dotFilled]} />
              ))}
            </Animated.View>
          </View>

          {/* NumPad translucide */}
          <View style={styles.bottomSection}>
            {loginMutation.isPending ? (
              <ActivityIndicator size="large" color="#FFFFFF" />
            ) : (
              <NumPad 
                value={pin} 
                onChange={setPin} 
                maxLength={PIN_LENGTH} 
                variant="transparent" 
              />
            )}
          </View>
        </View>
      </LinearGradient>
    </View>
  )
}

const styles = StyleSheet.create({
  main: { flex: 1 },
  gradient: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.1)' },
  header: { flex: 1.5, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  logoEmoji: { fontSize: 50 },
  title: { fontSize: 38, fontWeight: '900', color: '#FFFFFF', letterSpacing: 2 },
  badge: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 8,
  },
  badgeText: { fontSize: 10, fontWeight: '900', color: '#1C3D1A' },
  centerSection: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  subtitle: { fontSize: 16, color: '#E0EBD9', marginBottom: 24, fontWeight: '500' },
  dotsRow: {
    flexDirection: 'row',
    gap: 20,
    padding: 10,
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    backgroundColor: 'transparent',
  },
  dotFilled: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  bottomSection: { flex: 2, paddingBottom: 40, justifyContent: 'center' },
})
