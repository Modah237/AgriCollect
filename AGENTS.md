# AgriCollect Project Architecture & Guidelines

## Project Overview
AgriCollect is a comprehensive platform for agricultural data collection and management, specifically tailored for the Cameroonian market (CM). The project follows a monorepo-like structure with Backend, Web, and Mobile components.

## Directory Structure
- `/backend`: Node.js/TypeScript Express server.
  - ORM: Prisma (PostgreSQL likely).
  - Messaging/Background Jobs: BullMQ + Redis.
  - SMS/Payments: AfricasTalking.
  - Documentation: PDFKit.
- `/web`: Next.js 15+ (App Router) frontend.
  - Framework: React.
  - Styling: Tailwind CSS.
- `/mobile`: Expo / React Native application.
  - Framework: React Native.
  - Navigation: Expo Router or React Navigation.
- `/docs`: (To be added) Documentation and design files.

## Tech Stack
- **Backend**: Node.js, Express, TypeScript, Prisma, BullMQ, Redis, Zod, Pino (Logging).
- **Frontend (Web)**: Next.js, TypeScript, Tailwind CSS, Lucide React.
- **Mobile**: Expo, React Native, TypeScript.
- **Infrastructure**: Docker, Vercel (Web/Backend), Railway.

## Development Principles
1. **Type Safety**: Use TypeScript strictly. Define Zod schemas for all API inputs/outputs.
2. **Modular Backend**: Follow a service-repository pattern or clear separation of concerns in `src/`.
3. **Responsive Web**: Web interface must be mobile-friendly.
4. **Mobile First**: The mobile app is critical for field agents with limited connectivity.
5. **Localization**: Support for French and English (Cameroon context).

## Agent Instructions
- Always check `backend/prisma/schema.prisma` before modifying database logic.
- Ensure all new backend routes have proper validation using Zod.
- Use `pino` for logging instead of `console.log`.
- Follow the existing project structure for consistency.
- When working on the web, prefer React Server Components where applicable.
