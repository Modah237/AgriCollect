import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { db, SQLiteProducer } from '../db/database';

interface ProducerSelectScreenProps {
  onSelect: (producer: { id: string; fullName: string; phoneMomo: string }) => void;
  onBack: () => void;
}

export default function ProducerSelectScreen({ onSelect, onBack }: ProducerSelectScreenProps) {
  const [producers, setProducers] = useState<SQLiteProducer[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProducers();
  }, []);

  async function loadProducers() {
    try {
      const all: SQLiteProducer[] = await db.getAllAsync(
        'SELECT * FROM producers WHERE is_active = 1 ORDER BY full_name ASC'
      );
      setProducers(all);
    } finally {
      setLoading(false);
    }
  }

  const filtered = producers.filter((p) => {
    if (!search) return true;
    const normalize = (s: string) =>
      s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return normalize(p.full_name).includes(normalize(search));
  });

  const renderItem = ({ item }: { item: SQLiteProducer }) => {
    const initials = item.full_name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();

    return (
      <TouchableOpacity
        className="flex-row items-center bg-white rounded-2xl p-4 mb-3 shadow-sm"
        onPress={() => onSelect({ id: item.id, fullName: item.full_name, phoneMomo: item.phone_momo })}
        activeOpacity={0.7}
      >
        <LinearGradient
          colors={['#2D6A27', '#1C3D1A']}
          className="w-12 h-12 rounded-full items-center justify-center mr-4"
        >
          <Text className="text-white text-lg font-extrabold">{initials}</Text>
        </LinearGradient>

        <View className="flex-1">
          <Text className="text-lg font-bold text-slate-900">{item.full_name}</Text>
          <View className="flex-row items-center mt-1">
            <Ionicons name="wallet-outline" size={12} color="#64748b" />
            <Text className="text-sm text-slate-500 ml-1">
              {item.momo_operator} · {item.phone_momo}
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View className="px-5 py-4 flex-row items-center justify-between">
        <TouchableOpacity 
          onPress={onBack} 
          className="w-10 h-10 rounded-full bg-white items-center justify-center shadow-sm"
        >
          <Ionicons name="chevron-back" size={24} color="#2D6A27" />
        </TouchableOpacity>
        <Text className="text-xl font-black text-slate-900">Producteurs</Text>
        <View className="bg-green-100 px-2 py-1 rounded-md">
          <Text className="text-[10px] font-bold text-green-800">{filtered.length} MEMBRES</Text>
        </View>
      </View>

      {/* Search */}
      <View className="px-5 pb-4">
        <View className="flex-row items-center bg-white rounded-xl px-4 h-14 shadow-sm">
          <Ionicons name="search-outline" size={20} color="#94a3b8" className="mr-3" />
          <TextInput
            className="flex-1 text-base text-slate-900 font-medium"
            placeholder="Rechercher par nom..."
            value={search}
            onChangeText={setSearch}
            placeholderTextColor="#94a3b8"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={20} color="#cbd5e1" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#2D6A27" className="mt-10" />
      ) : filtered.length === 0 ? (
        <View className="flex-1 items-center justify-center p-8">
          <Ionicons name="people-outline" size={64} color="#e2e8f0" />
          <Text className="text-base text-slate-400 text-center mt-4 leading-6">
            {search
              ? `Aucun membre trouvé pour "${search}"`
              : 'Aucun producteur enregistré.\nSynchronisez l\'application.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerClassName="px-5 pb-10"
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}
