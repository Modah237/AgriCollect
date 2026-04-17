# ─── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:22-slim AS builder

RUN apt-get update && apt-get install -y openssl libssl-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copie des manifestes et du schéma Prisma (requis pour npm install / postinstall)
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY backend/prisma ./backend/prisma/

# Installation des dépendances (incluant devDeps pour le build TS)
RUN npm install --workspace=backend --include-workspace-root

# Génération du client Prisma
RUN npx prisma generate --schema=./backend/prisma/schema.prisma

# Build du code source
COPY backend/src ./backend/src
COPY backend/tsconfig.json ./backend/tsconfig.json
RUN npm run build --workspace=backend

# ─── Stage 2: Runtime ────────────────────────────────────────────────────────
FROM node:22-slim AS runner

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# On ne copie que ce qui est nécessaire pour l'exécution
COPY package.json ./
COPY backend/package.json ./backend/
COPY backend/prisma ./backend/prisma/
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/backend/node_modules ./backend/node_modules
COPY --from=builder /app/backend/dist ./backend/dist

# Variables d'environnement par défaut
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

# L'utilisateur node est plus sécurisé
USER node

CMD ["node", "backend/dist/index.js"]
