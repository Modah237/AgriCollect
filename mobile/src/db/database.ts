// Point d'entrée de la base de données (Refonte SQLite Robuste)
export * from './client';

/**
 * Note sur la migration :
 * Nous avons abandonné WatermelonDB (ORM complexe) au profit de expo-sqlite
 * pour garantir la stabilité sur les téléphones Android d'entrée de gamme
 * et une compatibilité parfaite avec Expo Go.
 */
