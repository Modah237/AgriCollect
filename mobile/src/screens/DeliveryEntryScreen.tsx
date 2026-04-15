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
} from 'react-native'
import { database, Delivery, PriceRule } from '../db/database'

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
  { value: 'A', label: 'A — Qualité supérieure', color: '#2D6A27' },
  { value: 'B', label: 'B — Qualité standard', color: '#B8860B' },
  { value: 'C', label: 'C — Déclassé', color: '#8B3A3A' },
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
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadCultures()
  }, [quality])

  async function loadCultures() {
    const rules = await database.get<PriceRule>('price_rules').query().fetch()
    const activeCampaignRules = rules.filter(
      (r) => r.campaignId === campaignId && r.qualityGrade === quality
    )
    const uniqueCultures = [...new Set(activeCampaignRules.map((r) => r.culture))]
    setCultures(uniqueCultures)

    // Sélectionner automatiquement la première culture si pas encore choisie
    if (!culture && uniqueCultures.length > 0) {
      setCulture(uniqueCultures[0])
    }

    // Mettre à jour le prix selon la culture et qualité sélectionnées
    const rule = activeCampaignRules.find((r) => r.culture === (culture || uniqueCultures[0]))
    setPricePerKg(rule?.pricePerKg ?? null)
  }

  useEffect(() => {
    if (culture) {
      database.get<PriceRule>('price_rules').query().fetch().then((rules) => {
        const rule = rules.find(
          (r) => r.campaignId === campaignId && r.culture === culture && r.qualityGrade === quality
        )
        setPricePerKg(rule?.pricePerKg ?? null)
      })
    }
  }, [culture, quality])

  const qty = parseFloat(quantity) || 0
  const total = pricePerKg ? Math.round(qty * pricePerKg) : 0

  async function handleConfirm() {
    if (!quantity || qty <= 0) {
      Alert.alert('Saisie invalide', 'Entrez une quantité valide.')
      return
    }
    if (!culture) {
      Alert.alert('Saisie invalide', 'Sélectionnez une culture.')
      return
    }
    if (!pricePerKg) {
      Alert.alert('Prix manquant', 'Aucun prix défini pour cette culture/qualité.')
      return
    }

    setSaving(true)
    try {
      // Générer un UUID v4 offline unique
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
          record.createdOfflineAt = new Date()
          record.isSynced = false
          record.syncError = null
        })
      })

      Alert.alert(
        'Livraison enregistrée ✓',
        `${producer.fullName}\n${qty} kg de ${culture} (Grade ${quality})\n= ${total.toLocaleString('fr-FR')} XAF`,
        [{ text: 'OK', onPress: onConfirm }]
      )
    } catch (err) {
      Alert.alert('Erreur', 'Impossible d\'enregistrer la livraison.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* En-tête producteur */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Text style={styles.backText}>← Retour</Text>
          </TouchableOpacity>
          <View style={styles.producerCard}>
            <Text style={styles.producerName}>{producer.fullName}</Text>
            <Text style={styles.producerPhone}>{producer.phoneMomo}</Text>
          </View>
        </View>

        {/* Sélection culture */}
        {cultures.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.label}>Culture</Text>
            <View style={styles.pills}>
              {cultures.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.pill, culture === c && styles.pillSelected]}
                  onPress={() => setCulture(c)}
                >
                  <Text style={[styles.pillText, culture === c && styles.pillTextSelected]}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Sélection qualité */}
        <View style={styles.section}>
          <Text style={styles.label}>Qualité</Text>
          <View style={styles.qualityOptions}>
            {QUALITY_GRADES.map((g) => (
              <TouchableOpacity
                key={g.value}
                style={[styles.qualityBtn, quality === g.value && { borderColor: g.color, backgroundColor: g.color + '15' }]}
                onPress={() => setQuality(g.value)}
              >
                <Text style={[styles.qualityBtnText, quality === g.value && { color: g.color, fontWeight: '700' }]}>
                  {g.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Quantité */}
        <View style={styles.section}>
          <Text style={styles.label}>Quantité (kg)</Text>
          <TextInput
            style={styles.quantityInput}
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="decimal-pad"
            placeholder="0.0"
            placeholderTextColor="#9CAF99"
          />
        </View>

        {/* Calcul automatique */}
        {pricePerKg && qty > 0 && (
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>Montant calculé</Text>
            <Text style={styles.totalAmount}>{total.toLocaleString('fr-FR')} XAF</Text>
            <Text style={styles.totalDetail}>
              {qty} kg × {pricePerKg.toLocaleString('fr-FR')} XAF/kg
            </Text>
          </View>
        )}

        {/* Bouton confirmer */}
        <TouchableOpacity
          style={[styles.confirmBtn, (saving || qty === 0) && styles.confirmBtnDisabled]}
          onPress={handleConfirm}
          disabled={saving || qty === 0}
          activeOpacity={0.8}
        >
          <Text style={styles.confirmBtnText}>
            {saving ? 'Enregistrement...' : '✓  Confirmer la livraison'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F0E8' },
  container: { padding: 20, paddingBottom: 40 },
  header: { marginBottom: 20 },
  backBtn: { marginBottom: 12 },
  backText: { color: '#2D6A27', fontSize: 16 },
  producerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#2D6A27',
  },
  producerName: { fontSize: 20, fontWeight: '700', color: '#1C3D1A' },
  producerPhone: { fontSize: 14, color: '#5A7A55', marginTop: 4 },
  section: { marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '600', color: '#5A7A55', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.8 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#C5D9C2',
  },
  pillSelected: { backgroundColor: '#2D6A27', borderColor: '#2D6A27' },
  pillText: { fontSize: 15, color: '#5A7A55', fontWeight: '500' },
  pillTextSelected: { color: '#FFFFFF', fontWeight: '700' },
  qualityOptions: { gap: 8 },
  qualityBtn: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#C5D9C2',
  },
  qualityBtnText: { fontSize: 15, color: '#5A7A55' },
  quantityInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 18,
    fontSize: 32,
    fontWeight: '700',
    color: '#1C3D1A',
    textAlign: 'center',
    borderWidth: 1.5,
    borderColor: '#C5D9C2',
  },
  totalCard: {
    backgroundColor: '#1C3D1A',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
  },
  totalLabel: { color: '#9CAF99', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.8 },
  totalAmount: { color: '#FFFFFF', fontSize: 36, fontWeight: '800', marginVertical: 4 },
  totalDetail: { color: '#9CAF99', fontSize: 13 },
  confirmBtn: {
    backgroundColor: '#2D6A27',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  confirmBtnDisabled: { backgroundColor: '#9CAF99' },
  confirmBtnText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
})
