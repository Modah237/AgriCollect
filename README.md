# 🌱 AgriCollect CM

Plateforme de collecte et de gestion des données agricoles pour le marché Camerounais.
**Backend (Railway)** | **Web (Vercel)** | **Mobile (Expo)**

---

## 🏗 Architecture du Projet

Le projet est structuré en monorepo :
- `backend/` : API Express + Prisma + BullMQ (Node.js/TS).
- `web/` : Dashboard Gestionnaire (Next.js 15 + Tailwind).
- `mobile/` : Application Collecteur (Expo + WatermelonDB Offline).

---

## 🚀 Déploiement

### 1. Backend (Railway)
Le backend est déployé via Docker.
- **Service Database** : Provisionner un PostgreSQL.
- **Service Redis** : Provisionner un Redis (requis pour BullMQ).
- **Variables d'environnement** :
  - `DATABASE_URL` : URL de connexion PostgreSQL.
  - `REDIS_URL` : URL de connexion Redis.
  - `JWT_ACCESS_SECRET` : Secret pour les Access Tokens.
  - `JWT_REFRESH_SECRET` : Secret pour les Refresh Tokens.
  - `FAPSHI_API_USER_ID` & `FAPSHI_API_KEY` : Identifiants Payouts.
  - `AFRICASTALKING_API_KEY` : Pour les notifications SMS.

### 2. Web (Vercel)
Le dashboard est déployé sur Vercel.
- **Root Directory** : `web/`
- **Framework Preset** : `Next.js`
- **Variables d'environnement** :
  - `NEXT_PUBLIC_API_URL` : URL de l'API déployée sur Railway.

### 3. Mobile (Expo)
- Build via EAS : `eas build --platform android`
- OTA Updates activés pour les corrections rapides sur le terrain.

---

## 🛠 Développement Local

1. **Installation** :
   ```bash
   # À la racine
   npm install
   
   # Dans le backend
   cd backend && npm install && npx prisma generate
   ```

2. **Base de données** :
   - Configurez votre `.env` dans `backend/`.
   - Lancez les migrations : `npx prisma migrate dev`.
   - Injectez les données de test : `npx tsx src/scripts/run-simulations.ts`.

3. **Lancement** :
   ```bash
   npm run backend  # Port 3001
   npm run web      # Port 8084
   ```

---

## 📜 Règles de Développement
Voir [RULES.md](./RULES.md) pour les standards de code et [AGENTS.md](./AGENTS.md) pour l'architecture détaillée.
