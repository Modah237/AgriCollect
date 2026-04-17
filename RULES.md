# AgriCollect Engineering & Design Rules

## 1. Design System & UI/UX (Senior Designer)
- **Mobile First**: All web components must be fully responsive, targeting low-end Android devices as the primary consumer for field agents.
- **Offline-Ready UX**: UI must clearly indicate sync status (Synced, Pending, Offline). Use optimistic UI updates for a snappy feel in rural areas.
- **Color Palette**: 
  - Primary: Agricultural Green (Success/Growth)
  - Secondary: Earthy Brown/Tan (Stability)
  - Accent: Cameroonian Yellow (Actions/Emphasis)
- **Typography**: High legibility fonts (e.g., Inter, Geist). Minimum touch target 44x44px for mobile.

## 2. Technical Standards (Senior IT)
- **Database (Prisma/Postgres)**:
  - Never delete financial records (`Deliveries`, `PaymentLines`); use `isActive` or `status` flags.
  - All monetary values must be `Int` (XAF) to avoid floating-point errors.
- **API Design (Express/Zod)**:
  - Versioning: All APIs under `/api/v1/...`.
  - Idempotency: `offlineUuid` from mobile is mandatory for delivery creation to prevent duplicates during retry-on-reconnect.
- **State Management**:
  - Web: TanStack Query (React Query) for server state handling.
  - Mobile: **expo-sqlite** for persistent offline data.
- **Communication (API)**:
  - **tRPC**: Use tRPC for end-to-end type safety between backend and clients.
  - **Zod**: Mandatory for all request/response validation schemas.
- **Security**:
  - Use Argon2 or Bcrypt for password hashing.
  - Collector auth: PIN + Device ID binding.
  - Manager auth: Email/Password + JWT & Refresh Tokens.

## 3. Deployment & CI/CD
- **Environment**: Strict separation of `development`, `staging`, and `production`.
- **Backend**: Railway/Vercel with Docker.
- **Mobile**: Expo EAS for builds and OTA (Over-The-Air) updates.
- **Monitoring**: Sentry for error tracking, Pino for structured logging.
