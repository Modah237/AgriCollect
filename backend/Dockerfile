# Utilisation d'une image Node.js stable
FROM node:22-slim

# Installation des dépendances système nécessaires pour Prisma
RUN apt-get update && apt-get install -y openssl libssl-dev && rm -rf /var/lib/apt/lists/*

# Dossier de travail à la racine pour gérer les workspaces
WORKDIR /app

# Copie des fichiers de dépendances de la racine et du backend
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY .npmrc ./

# Installation des dépendances
RUN npm install

# Copie du schéma Prisma et génération du client
COPY backend/prisma ./backend/prisma/
RUN npx prisma generate --schema=backend/prisma/schema.prisma

# Copie de tout le code source
COPY . .

# Build du backend via le workspace
RUN npm run build --workspace=backend

# Exposition du port (Railway injectera la variable PORT)
EXPOSE 3001

# Commande de démarrage via le workspace
CMD ["npm", "start", "--workspace=backend"]
