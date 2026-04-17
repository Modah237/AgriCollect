# AgriCollect Project Architecture & Guidelines

## Project Overview
AgriCollect is a comprehensive platform for agricultural data collection and management, specifically tailored for the Cameroonian market (CM). The project follows a monorepo-like structure with Backend, Web, and Mobile components.

## Directory Structure
- `/backend`: Node.js/TypeScript Express server.
  - ORM: Prisma (Postgres).
  - Messaging/Background Jobs: BullMQ + Redis.
  - SMS/Payments: Fapshi.
  - API: **tRPC** (Primary) + REST.
- `/web`: Next.js 15+ (App Router) frontend.
  - Framework: React + TanStack Query.
  - Styling: Tailwind CSS.
- `/mobile`: Expo / React Native application.
  - Framework: React Native + Expo Router.
  - Navigation: Expo Router.
  - Database: **expo-sqlite** (Offline-first).
  - Styling: **NativeWind** (Tailwind for mobile).
- `/docs`: Documentation and design files.

## Tech Stack
- **Backend**: Node.js, Express, TypeScript, Prisma, BullMQ, Redis, Zod, Pino (Logging), **tRPC**.
- **Frontend (Web)**: Next.js, TypeScript, Tailwind CSS, Lucide React, TanStack Query.
- **Mobile**: Expo, React Native, TypeScript, **expo-sqlite**, **NativeWind**.
- **Infrastructure**: Vercel (Web), Railway (Backend/Redis/DB).

## Development Principles
1. **Type Safety**: Use TypeScript strictly. Use **tRPC** to share types between backend and apps.
2. **Modular Backend**: Follow a service-repository pattern.
3. **Responsive Web**: Web interface must be mobile-friendly.
4. **Mobile First**: The mobile app is critical for field agents with limited connectivity.
5. **Localization**: Support for French and English (Cameroon context).

## Agent Instructions
- Always check `backend/prisma/schema.prisma` before modifying database logic.
- Ensure all new backend routes go through **tRPC** routers where possible, with proper **Zod** validation.
- Use `pino` for logging.
- Follow the existing project structure.
- Prefer React Server Components for the web when applicable.
