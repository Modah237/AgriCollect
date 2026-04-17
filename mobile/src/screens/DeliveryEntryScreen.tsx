import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Alert,
  ScrollView,
  Image,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import * as Crypto from 'expo-crypto';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { db, SQLitePriceRule } from '../db/database';
import { getDictionary } from '../lib/dictionaries';

interface Producer {
  id: string;
  fullName: string;
  phoneMomo: string;
}

interface DeliveryEntryScreenProps {
  producer: Producer;
  onConfirm: () => void;
  onBack: () => void;
  campaignId: string;
}

interface QualityGradeOption {
  value: 'A' | 'B' | 'C';
  label: string;
  sub: string;
  color: string;
  icon: 'ribbon-outline' | 'medal-outline' | 'alert-circle-outline';
}

export default function DeliveryEntryScreen({
  producer,
  onConfirm,
  onBack,
  campaignId,
}: DeliveryEntryScreenProps) {
  const dict = getDictionary();
  const [quantity, setQuantity] = useState('');
  const [quality, setQuality] = useState('A');
  const [culture, setCulture] = useState('');
  const [cultures, setCultures] = useState<string[]>([]);
  const [pricePerKg, setPricePerKg] = useState<number | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const QUALITY_GRADES: QualityGradeOption[] = [
    { value: 'A', label: dict.quality.gradeA, sub: dict.quality.subA, color: '#2D6A27', icon: 'ribbon-outline' },
    { value: 'B', label: dict.quality.gradeB, sub: dict.quality.subB, color: '#B8860B', icon: 'medal-outline' },
    { value: 'C', label: dict.quality.gradeC, sub: dict.quality.subC, color: '#8B3A3A', icon: 'alert-circle-outline' },
  ];

  useEffect(() => {
    loadCultures();
  }, [quality]);

  async function loadCultures() {
    const activeRules: SQLitePriceRule[] = await db.getAllAsync(
      'SELECT * FROM price_rules WHERE campaign_id = ? AND quality_grade = ?',
      [campaignId, quality]
    );

    const uniqueCultures = [...new Set(activeRules.map(r => r.culture))];
    setCultures(uniqueCultures);

    if (!culture && uniqueCultures.length > 0) setCulture(uniqueCultures[0]);
    const rule = activeRules.find(r => r.culture === (culture || uniqueCultures[0]));
    setPricePerKg(rule?.price_per_kg ?? null);
  }

  useEffect(() => {
    if (culture) {
      db.getAllAsync(
        'SELECT * FROM price_rules WHERE campaign_id = ? AND culture = ? AND quality_grade = ?',
        [campaignId, culture, quality]
      ).then((rules: any[]) => {
        const rule = rules[0] as SQLitePriceRule | undefined;
        setPricePerKg(rule?.price_per_kg ?? null);
      });
    }
  }, [culture, quality]);

  const qty = parseFloat(quantity) || 0;
  const total = pricePerKg ? Math.round(qty * pricePerKg) : 0;

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(dict.collect.permissionDenied, dict.collect.cameraAccess);
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.5, allowsEditing: true });
    if (!result.canceled) setPhoto(result.assets[0].uri);
  }

  async function handleConfirm() {
    if (!quantity || qty <= 0) {
      Alert.alert(dict.collect.invalidQuantity, dict.collect.enterValidQuantity);
      return;
    }
    if (!pricePerKg) {
      Alert.alert(dict.common.error, dict.collect.priceNotDefine);
      return;
    }

    setSaving(true);
    try {
      const offlineUuid = Crypto.randomUUID();

      await db.runAsync(
        `INSERT INTO deliveries (
          offline_uuid, campaign_id, producer_id, culture, quantity_kg, 
          quality_grade, photo_url, notes, price_per_kg, calculated_amount, 
          net_due, created_offline_at, is_synced
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [
          offlineUuid, campaignId, producer.id, culture, qty, quality,
          photo, null, pricePerKg, total, total, new Date().toISOString(),
        ]
      );

      Alert.alert(dict.common.success, dict.collect.saveSuccess.replace('{name}', producer.fullName), [
        { text: dict.common.ok, onPress: onConfirm }
      ]);
    } catch (err) {
      console.error('[SQLite] Save error:', err);
      Alert.alert(dict.common.error, dict.collect.dbError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="flex-row items-center justify-between mb-6">
          <TouchableOpacity onPress={onBack} className="w-11 h-11 rounded-full bg-white items-center justify-center shadow-sm">
            <Ionicons name="chevron-back" size={24} color="#2D6A27" />
          </TouchableOpacity>
          <View className="bg-amber-400 px-3 py-1 rounded-md">
            <Text className="text-[10px] font-black text-green-950">{dict.collect.title}</Text>
          </View>
        </View>

        {/* Producer Info */}
        <View className="flex-row items-center bg-white p-4 rounded-2xl mb-6 shadow-sm">
          <View className="w-12 h-12 rounded-full bg-green-700 items-center justify-center mr-4">
            <Ionicons name="person" size={24} color="#FFFFFF" />
          </View>
          <View>
            <Text className="text-lg font-extrabold text-slate-900">{producer.fullName}</Text>
            <Text className="text-sm text-slate-500 font-medium">{producer.phoneMomo}</Text>
          </View>
        </View>

        {/* Section 1: Product Selection */}
        <Text className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">{dict.collect.chooseProduct}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6">
          {cultures.map(c => (
            <TouchableOpacity
              key={c}
              onPress={() => setCulture(c)}
              className={`px-5 py-3 rounded-full mr-2 border ${culture === c ? 'bg-green-700 border-green-700' : 'bg-white border-slate-200 shadow-sm'}`}
            >
              <Text className={`text-sm font-bold ${culture === c ? 'text-white' : 'text-slate-600'}`}>{c.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Section 2: Quality Selection */}
        <Text className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">{dict.collect.chooseQuality}</Text>
        <View className="gap-3 mb-6">
          {QUALITY_GRADES.map((g: QualityGradeOption) => (
            <TouchableOpacity
              key={g.value}
              onPress={() => setQuality(g.value)}
              className={`flex-row items-center bg-white p-4 rounded-xl border-2 ${quality === g.value ? 'border-green-700 bg-green-50/10' : 'border-slate-100'}`}
              style={quality === g.value ? { borderColor: g.color } : {}}
            >
              <Ionicons name={g.icon as any} size={24} color={quality === g.value ? g.color : '#cbd5e1'} />
              <View className="ml-3">
                <Text className={`text-base font-bold ${quality === g.value ? '' : 'text-slate-400'}`} style={quality === g.value ? { color: g.color } : {}}>{g.label}</Text>
                <Text className="text-xs text-slate-400 font-medium">{g.sub}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Section 3: Weight Input */}
        <Text className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">{dict.collect.weightKg}</Text>
        <View className="flex-row gap-3 mb-8">
          <TextInput
            className="flex-1 bg-white rounded-2xl p-5 text-4xl font-black text-slate-900 text-center shadow-sm border border-slate-100"
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="decimal-pad"
            placeholder="0.0"
            placeholderTextColor="#e2e8f0"
          />
          <TouchableOpacity
            onPress={takePhoto}
            className="w-20 h-20 rounded-2xl bg-white items-center justify-center border-2 border-dashed border-slate-200 shadow-sm"
          >
            {photo ? <Image source={{ uri: photo }} className="w-full h-full rounded-2xl" /> : <Ionicons name="camera" size={32} color="#2D6A27" />}
          </TouchableOpacity>
        </View>

        {/* Summary */}
        {total > 0 && (
          <View className="bg-slate-900 p-6 rounded-3xl items-center mb-6 shadow-lg shadow-black/20">
            <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-[3px]">{dict.collect.estimatedAmount}</Text>
            <Text className="text-4xl font-black text-white my-2">{total.toLocaleString('fr-FR')} XAF</Text>
            <Text className="text-xs text-slate-400 font-medium">{qty} kg × {pricePerKg} XAF/kg</Text>
          </View>
        )}

        {/* Confirm Button */}
        <TouchableOpacity
          className={`py-5 rounded-2xl items-center shadow-lg ${saving || qty <= 0 ? 'bg-slate-300' : 'bg-green-700'}`}
          onPress={handleConfirm}
          disabled={saving || qty <= 0}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="text-white text-base font-black tracking-widest">{dict.collect.confirmButton}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
      </ScrollView>
    </SafeAreaView>
  );
}
