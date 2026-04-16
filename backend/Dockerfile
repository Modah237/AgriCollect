FROM node:22-slim

# Dépendances Prisma
RUN apt-get update && apt-get install -y openssl libssl-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ─── Étape 1 : Copie des manifestes et du schéma Prisma ─────────────────────
# Le schéma est requis avant npm install à cause du script postinstall
COPY package*.json ./
COPY .npmrc ./
COPY backend/package*.json ./backend/
COPY backend/prisma ./backend/prisma/

# ─── Étape 2 : Installation des dépendances (backend seulement) ──────────────
# On ignore les workspaces web pour ne pas installer Next.js dans l'image backend
RUN npm install --workspace=backend --include-workspace-root

# ─── Étape 3 : Génération du client Prisma ───────────────────────────────────
COPY backend/prisma ./backend/prisma/
RUN npx prisma generate --schema=./backend/prisma/schema.prisma

# ─── Étape 4 : Copie du code source et build TypeScript ──────────────────────
COPY backend/src ./backend/src
COPY backend/tsconfig.json ./backend/tsconfig.json

RUN npm run build --workspace=backend

# ─── Étape 5 : Démarrage ─────────────────────────────────────────────────────
EXPOSE 3001

CMD ["node", "backend/dist/index.js"]
