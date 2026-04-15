# Utilisation d'une image Node.js stable
FROM node:22-slim

# Installation des dépendances système nécessaires pour Prisma
RUN apt-get update && apt-get install -y openssl libssl-dev && rm -rf /var/lib/apt/lists/*

# Dossier de travail
WORKDIR /app

# Copie des fichiers de dépendances
COPY package*.json ./

# Installation des dépendances (y compris dev pour le build tsc)
RUN npm install

# Copie du schéma Prisma avant la génération
COPY prisma ./prisma/

# Génération du client Prisma
RUN npx prisma generate

# Copie du reste du code source
COPY . .

# Build du projet TypeScript
RUN npm run build

# Exposition du port par défaut (Railway injectera PORT)
EXPOSE 3001

# Commande de démarrage
CMD ["npm", "start"]
