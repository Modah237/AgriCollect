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
} from 'react-native'
import { database, Producer } from '../db/database'

interface ProducerSelectScreenProps {
  onSelect: (producer: { id: string; fullName: string; phoneMomo: string }) => void
  onBack: () => void
}

export default function ProducerSelectScreen({ onSelect, onBack }: ProducerSelectScreenProps) {
  const [producers, setProducers] = useState<Producer[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadProducers()
  }, [])

  async function loadProducers() {
    const all = await database.get<Producer>('producers').query().fetch()
    setProducers(all.filter((p) => p.isActive))
    setLoading(false)
  }

  // Filtrage local — recherche phonétique simplifiée (insensible aux accents)
  const filtered = producers.filter((p) => {
    if (!search) return true
    const normalize = (s: string) =>
      s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    return normalize(p.fullName).includes(normalize(search))
  })

  function renderItem({ item }: { item: Producer }) {
    return (
      <TouchableOpacity
        style={styles.item}
        onPress={() => onSelect({ id: item.serverId, fullName: item.fullName, phoneMomo: item.phoneMomo })}
        activeOpacity={0.7}
      >
        {/* Avatar initiales */}
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {item.fullName.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
          </Text>
        </View>
        <View style={styles.itemInfo}>
          <Text style={styles.itemName}>{item.fullName}</Text>
          <Text style={styles.itemPhone}>{item.momoOperator} · {item.phoneMomo}</Text>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* En-tête */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Choisir un producteur</Text>
        <Text style={styles.count}>{filtered.length} membre{filtered.length > 1 ? 's' : ''}</Text>
      </View>

      {/* Barre de recherche */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.search}
          placeholder="Rechercher un nom..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor="#9CAF99"
          autoFocus
        />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#2D6A27" style={{ marginTop: 40 }} />
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
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
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={styles.list}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F0E8' },
  header: { padding: 16, paddingBottom: 8 },
  backBtn: { marginBottom: 8 },
  backText: { color: '#2D6A27', fontSize: 16 },
  title: { fontSize: 22, fontWeight: '700', color: '#1C3D1A' },
  count: { fontSize: 14, color: '#5A7A55', marginTop: 4 },
  searchContainer: { paddingHorizontal: 16, paddingBottom: 8 },
  search: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#1C3D1A',
    borderWidth: 1,
    borderColor: '#C5D9C2',
  },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#2D6A27',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 17, fontWeight: '600', color: '#1C3D1A' },
  itemPhone: { fontSize: 13, color: '#5A7A55', marginTop: 3 },
  separator: { height: 1, backgroundColor: '#E0EBD9' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { fontSize: 15, color: '#5A7A55', textAlign: 'center', lineHeight: 24 },
})
