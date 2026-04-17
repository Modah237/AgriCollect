import React, { useState, useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import "./global.css";
import { initDB, db } from './src/db/database';
import { getAccessToken, getUser, clearAuth, getGicId, getCampaignId, saveCampaignId } from './src/stores/authStore';
import { trpc, trpcClient } from './src/lib/trpc';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import LoginScreen from './src/screens/LoginScreen';
import SyncScreen from './src/screens/SyncScreen';
import ProducerSelectScreen from './src/screens/ProducerSelectScreen';
import DeliveryEntryScreen from './src/screens/DeliveryEntryScreen';

const queryClient = new QueryClient();

type Screen = 'loading' | 'login' | 'home' | 'producer-select' | 'delivery-entry';

interface SelectedProducer {
  id: string;
  fullName: string;
  phoneMomo: string;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('loading');
  const [gicId, setGicId] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [selectedProducer, setSelectedProducer] = useState<SelectedProducer | null>(null);

  useEffect(() => {
    async function prepare() {
      try {
        await initDB();
        await checkAuth();
      } catch (e) {
        console.warn('Erreur lors du chargement de l''app:', e);
        setScreen('login');
      }
    }
    prepare();
  }, []);

  async function checkAuth() {
    try {
      const [token, user, savedGicId] = await Promise.all([
        getAccessToken(),
        getUser(),
        getGicId(),
      ]);

      if (token && user && savedGicId) {
        setGicId(savedGicId);
        const savedCampaignId = await getCampaignId();
        if (savedCampaignId) {
          setCampaignId(savedCampaignId);
        } else {
          const rule: any = await db.getFirstAsync('SELECT campaign_id FROM price_rules LIMIT 1');
          if (rule) {
            const cId = rule.campaign_id;
            setCampaignId(cId);
            await saveCampaignId(cId);
          }
        }
        setScreen('home');
      } else {
        setScreen('login');
      }
    } catch {
      setScreen('login');
    }
  }

  async function handleLoginSuccess() {
    const [savedGicId] = await Promise.all([getGicId()]);
    if (savedGicId) setGicId(savedGicId);
    setScreen('home');
  }

  async function handleLogout() {
    await clearAuth();
    setScreen('login');
  }

  function handleProducerSelect(producer: SelectedProducer) {
    setSelectedProducer(producer);
    setScreen('delivery-entry');
  }

  function handleDeliveryConfirm() {
    setSelectedProducer(null);
    setScreen('home');
  }

  if (screen === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F0E8' }}>
        <ActivityIndicator size="large" color="#2D6A27" />
      </View>
    );
  }

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {screen === 'login' && (
          <LoginScreen onLoginSuccess={handleLoginSuccess} />
        )}
        {screen === 'home' && (
          <SyncScreen
            gicId={gicId}
            onNewDelivery={() => setScreen('producer-select')}
            onLogout={handleLogout}
          />
        )}
        {screen === 'producer-select' && (
          <ProducerSelectScreen
            onSelect={handleProducerSelect}
            onBack={() => setScreen('home')}
          />
        )}
        {screen === 'delivery-entry' && selectedProducer && (
          <DeliveryEntryScreen
            producer={selectedProducer}
            campaignId={campaignId}
            onConfirm={handleDeliveryConfirm}
            onBack={() => setScreen('producer-select')}
          />
        )}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
