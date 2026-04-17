import * as SQLite from 'expo-sqlite';

const DB_NAME = 'agricollect_v1.db';

export const db = SQLite.openDatabaseSync(DB_NAME);

/**
 * Initialisation de la base de données SQL
 * Crée les tables si elles n'existent pas (Idempotent)
 */
export const initDB = async () => {
  try {
    // 1. Table Producteurs (Sync depuis le serveur)
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS producers (
        id TEXT PRIMARY KEY NOT NULL,
        full_name TEXT NOT NULL,
        phone_momo TEXT NOT NULL,
        phone_sms TEXT,
        momo_operator TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        synced_at TEXT NOT NULL
      );
    `);

    // 2. Table Règles de Prix (Sync depuis le serveur)
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS price_rules (
        id TEXT PRIMARY KEY NOT NULL,
        campaign_id TEXT NOT NULL,
        campaign_name TEXT NOT NULL,
        culture TEXT NOT NULL,
        quality_grade TEXT NOT NULL,
        price_per_kg INTEGER NOT NULL,
        effective_from TEXT NOT NULL
      );
    `);

    // 3. Table Livraisons (Saisie Offline)
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS deliveries (
        offline_uuid TEXT PRIMARY KEY NOT NULL,
        campaign_id TEXT NOT NULL,
        producer_id TEXT NOT NULL,
        culture TEXT NOT NULL,
        quantity_kg REAL NOT NULL,
        quality_grade TEXT NOT NULL,
        photo_url TEXT,
        notes TEXT,
        price_per_kg INTEGER NOT NULL,
        calculated_amount INTEGER NOT NULL,
        advance_deducted INTEGER DEFAULT 0,
        net_due INTEGER NOT NULL,
        created_offline_at TEXT NOT NULL,
        is_synced INTEGER DEFAULT 0,
        sync_error TEXT
      );
    `);

    console.log('[SQLite] Base de données initialisée avec succès');
  } catch (error) {
    console.error('[SQLite] Erreur lors de l''initialisation:', error);
    throw error;
  }
};

/**
 * Types TS pour les enregistrements SQLite
 */

export interface SQLiteProducer {
  id: string;
  full_name: string;
  phone_momo: string;
  phone_sms?: string;
  momo_operator: string;
  is_active: number;
  synced_at: string;
}

export interface SQLitePriceRule {
  id: string;
  campaign_id: string;
  campaign_name: string;
  culture: string;
  quality_grade: string;
  price_per_kg: number;
  effective_from: string;
}

export interface SQLiteDelivery {
  offline_uuid: string;
  campaign_id: string;
  producer_id: string;
  culture: string;
  quantity_kg: number;
  quality_grade: string;
  photo_url?: string;
  notes?: string;
  price_per_kg: number;
  calculated_amount: number;
  advance_deducted?: number;
  net_due: number;
  created_offline_at: string;
  is_synced: number;
  sync_error?: string;
}
