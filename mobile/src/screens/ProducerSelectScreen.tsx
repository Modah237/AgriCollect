import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  StatusBar,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { db, SQLiteProducer } from '../db/database'

interface ProducerSelectScreenProps {
  onSelect: (producer: { id: string; fullName: string; phoneMomo: string }) => void
  onBack: () => void
}

export default function ProducerSelectScreen({ onSelect, onBack }: ProducerSelectScreenProps) {
  const [producers, setProducers] = useState<SQLiteProducer[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadProducers()
  }, [])

  async function loadProducers() {
    try {
      const all: SQLiteProducer[] = await db.getAllAsync(
        'SELECT * FROM producers WHERE is_active = 1 ORDER BY full_name ASC'
      );
      setProducers(all)
    } finally {
      setLoading(false)
    }
  }

  const filtered = producers.filter((p) => {
    if (!search) return true
    const normalize = (s: string) =>
      s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    return normalize(p.full_name).includes(normalize(search))
  })

  function renderItem({ item }: { item: SQLiteProducer }) {
    const initials = item.full_name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => onSelect({ id: item.id, fullName: item.full_name, phoneMomo: item.phone_momo })}
        activeOpacity={0.7}
      >
        <LinearGradient
          colors={['#2D6A27', '#1C3D1A']}
          style={styles.avatar}
        >
          <Text style={styles.avatarText}>{initials}</Text>
        </LinearGradient>

        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{item.full_name}</Text>
          <View style={styles.cardDetail}>
            <Ionicons name="wallet-outline" size={14} color="#5A7A55" />
            <Text style={styles.cardPhone}> {item.momo_operator} · {item.phone_momo}</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#C5D9C2" />
      </TouchableOpacity>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      {/* Header Premium */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#2D6A27" />
        </TouchableOpacity>
        <Text style={styles.title}>Choisir un producteur</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{filtered.length} MEMBRES</Text>
        </View>
      </View>

      {/* Barre de recherche avec icône */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={20} color="#9CAF99" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher un nom..."
            value={search}
            onChangeText={setSearch}
            placeholderTextColor="#9CAF99"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={20} color="#C5D9C2" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#2D6A27" style={{ marginTop: 40 }} />
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="people-outline" size={64} color="#C5D9C2" />
          <Text style={styles.emptyText}>
            {search
              ? `Aucun producteur trouvé pour "${search}"`
              : 'Aucun producteur enregistré.\nLancez une synchronisation.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8F6F2' },
  header: { 
    padding: 16, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between' 
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  title: { fontSize: 20, fontWeight: '800', color: '#1C3D1A' },
  badge: {
    backgroundColor: '#E0EBD9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#2D6A27' },
  searchContainer: { paddingHorizontal: 16, paddingBottom: 16 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 54,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, fontSize: 16, color: '#1C3D1A', fontWeight: '500' },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 17, fontWeight: '700', color: '#1C3D1A' },
  cardDetail: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  cardPhone: { fontSize: 13, color: '#5A7A55' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { fontSize: 15, color: '#5A7A55', textAlign: 'center', lineHeight: 24, marginTop: 16 },
})
