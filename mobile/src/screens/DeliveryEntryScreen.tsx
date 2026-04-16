import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  TextInput,
  Alert,
  ScrollView,
  Image,
  Dimensions,
  StatusBar,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { database, Delivery, PriceRule } from '../db/database'

const { width } = Dimensions.get('window')

interface Producer {
  id: string
  fullName: string
  phoneMomo: string
}

interface DeliveryEntryScreenProps {
  producer: Producer
  onConfirm: () => void
  onBack: () => void
  campaignId: string
}

const QUALITY_GRADES = [
  { value: 'A', label: 'Grade A', sub: 'Qualité Supérieure', color: '#2D6A27', icon: 'ribbon-outline' },
  { value: 'B', label: 'Grade B', sub: 'Qualité Standard', color: '#B8860B', icon: 'medal-outline' },
  { value: 'C', label: 'Grade C', sub: 'Déclassé', color: '#8B3A3A', icon: 'alert-circle-outline' },
]

export default function DeliveryEntryScreen({
  producer,
  onConfirm,
  onBack,
  campaignId,
}: DeliveryEntryScreenProps) {
  const [quantity, setQuantity] = useState('')
  const [quality, setQuality] = useState('A')
  const [culture, setCulture] = useState('')
  const [cultures, setCultures] = useState<string[]>([])
  const [pricePerKg, setPricePerKg] = useState<number | null>(null)
  const [photo, setPhoto] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadCultures()
  }, [quality])

  async function loadCultures() {
    const rules = await database.get<PriceRule>('price_rules').query().fetch()
    const activeRules = rules.filter(r => r.campaignId === campaignId && r.qualityGrade === quality)
    const uniqueCultures = [...new Set(activeRules.map(r => r.culture))]
    setCultures(uniqueCultures)

    if (!culture && uniqueCultures.length > 0) setCulture(uniqueCultures[0])
    const rule = activeRules.find(r => r.culture === (culture || uniqueCultures[0]))
    setPricePerKg(rule?.pricePerKg ?? null)
  }

  useEffect(() => {
    if (culture) {
      database.get<PriceRule>('price_rules').query().fetch().then(rules => {
        const rule = rules.find(r => r.campaignId === campaignId && r.culture === culture && r.qualityGrade === quality)
        setPricePerKg(rule?.pricePerKg ?? null)
      })
    }
  }, [culture, quality])

  const qty = parseFloat(quantity) || 0
  const total = pricePerKg ? Math.round(qty * pricePerKg) : 0

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission refusée', 'L\'accès à la caméra est requis.')
      return
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.5, allowsEditing: true })
    if (!result.canceled) setPhoto(result.assets[0].uri)
  }

  async function handleConfirm() {
    if (!quantity || qty <= 0) {
      Alert.alert('Saisie invalide', 'Entrez une quantité valide.')
      return
    }
    setSaving(true)
    try {
      const offlineUuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
      })

      await database.write(async () => {
        await database.get<Delivery>('deliveries').create((record) => {
          record.offlineUuid = offlineUuid
          record.campaignId = campaignId
          record.producerId = producer.id
          record.culture = culture
          record.quantityKg = qty
          record.qualityGrade = quality
          record.pricePerKg = pricePerKg!
          record.calculatedAmount = total
          record.photoUrl = photo
          record.createdOfflineAt = new Date()
          record.isSynced = false
        })
      })

      Alert.alert('Succès ✓', `Pesée enregistrée pour ${producer.fullName}`, [{ text: 'OK', onPress: onConfirm }])
    } catch (err) {
      Alert.alert('Erreur', 'Impossible d\'enregistrer.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#2D6A27" />
          </TouchableOpacity>
          <View style={styles.badge}><Text style={styles.badgeText}>NOUVELLE PESÉE</Text></View>
        </View>

        {/* Info Producteur */}
        <View style={styles.producerCard}>
          <View style={styles.producerIcon}><Ionicons name="person" size={24} color="#FFFFFF" /></View>
          <View>
            <Text style={styles.producerName}>{producer.fullName}</Text>
            <Text style={styles.producerPhone}>{producer.phoneMomo}</Text>
          </View>
        </View>

        {/* Sélection Culture */}
        <Text style={styles.sectionTitle}>1. Choisir le produit</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cultureScroll}>
          {cultures.map(c => (
            <TouchableOpacity key={c} onPress={() => setCulture(c)} style={[styles.culturePill, culture === c && styles.culturePillActive]}>
              <Text style={[styles.cultureText, culture === c && styles.cultureTextActive]}>{c.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Sélection Qualité */}
        <Text style={styles.sectionTitle}>2. Qualité du lot</Text>
        <View style={styles.qualityContainer}>
          {QUALITY_GRADES.map(g => (
            <TouchableOpacity key={g.value} onPress={() => setQuality(g.value)} 
              style={[styles.qualityCard, quality === g.value && { borderColor: g.color, backgroundColor: g.color + '15' }]}>
              <Ionicons name={g.icon as any} size={24} color={quality === g.value ? g.color : '#9CAF99'} />
              <View style={{ marginLeft: 12 }}>
                <Text style={[styles.qualityLabel, quality === g.value && { color: g.color }]}>{g.label}</Text>
                <Text style={styles.qualitySub}>{g.sub}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Saisie Poids */}
        <Text style={styles.sectionTitle}>3. Pesage (kg)</Text>
        <View style={styles.weightBox}>
          <TextInput style={styles.weightInput} value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" placeholder="0.0" />
          <TouchableOpacity onPress={takePhoto} style={styles.photoBtn}>
            {photo ? <Image source={{ uri: photo }} style={styles.photoPreview} /> : <Ionicons name="camera" size={30} color="#2D6A27" />}
          </TouchableOpacity>
        </View>

        {/* Récapitulatif Financer */}
        {total > 0 && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>MONTANT TOTAL</Text>
            <Text style={styles.summaryValue}>{total.toLocaleString('fr-FR')} XAF</Text>
            <Text style={styles.summaryDetail}>{qty} kg × {pricePerKg} XAF/kg</Text>
          </View>
        )}

        {/* Bouton Validation */}
        <TouchableOpacity style={[styles.confirmBtn, (saving || qty <= 0) && { opacity: 0.5 }]} onPress={handleConfirm} disabled={saving || qty <= 0}>
          <Text style={styles.confirmText}>{saving ? 'ENREGISTREMENT...' : 'CONFIRMER LA PESÉE'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F6F2' },
  container: { padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', elevation: 2 },
  badge: { backgroundColor: '#FFD700', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: '900', color: '#1C3D1A' },
  producerCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, marginBottom: 24, elevation: 1 },
  producerIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#2D6A27', alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  producerName: { fontSize: 18, fontWeight: '800', color: '#1C3D1A' },
  producerPhone: { fontSize: 13, color: '#5A7A55' },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: '#9CAF99', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  cultureScroll: { marginBottom: 24 },
  culturePill: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, backgroundColor: '#FFFFFF', marginRight: 8, borderWidth: 1, borderColor: '#E0EBD9' },
  culturePillActive: { backgroundColor: '#2D6A27', borderColor: '#2D6A27' },
  cultureText: { fontSize: 14, fontWeight: '700', color: '#5A7A55' },
  cultureTextActive: { color: '#FFFFFF' },
  qualityContainer: { gap: 10, marginBottom: 24 },
  qualityCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#E0EBD9' },
  qualityLabel: { fontSize: 15, fontWeight: '700', color: '#1C3D1A' },
  qualitySub: { fontSize: 12, color: '#9CAF99' },
  weightBox: { flexDirection: 'row', gap: 10, marginBottom: 30 },
  weightInput: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, fontSize: 32, fontWeight: '800', color: '#1C3D1A', textAlign: 'center', elevation: 2 },
  photoBtn: { width: 80, height: 80, borderRadius: 16, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed', borderWidth: 2, borderColor: '#C5D9C2' },
  photoPreview: { width: 76, height: 76, borderRadius: 14 },
  summaryCard: { backgroundColor: '#1C3D1A', padding: 24, borderRadius: 20, alignItems: 'center', marginBottom: 20 },
  summaryTitle: { fontSize: 11, fontWeight: '700', color: '#9CAF99', letterSpacing: 2 },
  summaryValue: { fontSize: 34, fontWeight: '900', color: '#FFFFFF', marginVertical: 4 },
  summaryDetail: { fontSize: 13, color: '#9CAF99' },
  confirmBtn: { backgroundColor: '#2D6A27', padding: 22, borderRadius: 16, alignItems: 'center', elevation: 4 },
  confirmText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', letterSpacing: 1 },
})
