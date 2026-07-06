# OnCuts — Tech Stack

This document summarizes the languages, runtimes, and major libraries used across the OnCuts monorepo. Paths are relative to the repository root.

---

## High-level architecture

| Layer | Technology |
|--------|------------|
| **API & real-time server** | Node.js, Express, TypeScript |
| **Primary database** | PostgreSQL |
| **ORM / schema** | Prisma (schema + client; migrations in `backend/prisma`) |
| **SQL access** | `pg` (node-postgres) — many routes use raw SQL via a shared pool alongside Prisma |
| **Consumer web** | React 19, Vite 5, TypeScript, Tailwind CSS |
| **iOS / shared Swift module** | Swift 5.9+, SwiftUI targets iOS 17+ (Swift Package: `OnCutsModule`) |
| **Containers** | Dockerfiles under `backend/` and `web-app/` |

---

## Backend (`backend/`)

- **Runtime:** Node.js  
- **Language:** TypeScript (compiled with `tsc`; dev via `nodemon`)  
- **HTTP:** Express 4  
- **Real-time:** Socket.IO (server) — personal rooms, messaging, booking/payment events  
- **Database:** PostgreSQL via `pg` and Prisma 7 (`@prisma/client`)  
- **Auth & security:** JWT (`jsonwebtoken`), `bcrypt`, Helmet, CORS, `express-rate-limit`, `express-validator` / Joi  
- **Passkeys:** `@simplewebauthn/server`  
- **Payments:** Stripe (`stripe`) — Connect, payment intents, webhooks (see `backend/src/controllers` / routes)  
- **Email:** Nodemailer  
- **Logging:** Winston  
- **Scheduling:** `node-cron`  
- **Queues / jobs:** BullMQ (Redis-backed)  
- **Cache / pub-sub:** `redis` client  
- **File / media:** Multer, Sharp (images), AWS S3 SDK (`@aws-sdk/client-s3`, legacy `aws-sdk`)  
- **Push:** APN (`apn`), Firebase Admin  
- **Calendar:** Google APIs / `google-auth-library`  
- **Blockchain (Sui):** `@mysten/sui`  
- **IPFS:** `ipfs-http-client`  
- **Dates:** `date-fns`, Luxon (used in some routes)  
- **Testing:** Jest, `ts-jest`  

---

## Web application (`web-app/`)

- **Build tool:** Vite 5  
- **UI:** React 19, React DOM, React Router 6  
- **Styling:** Tailwind CSS 3, PostCSS, Autoprefixer  
- **State & data:** Zustand, TanStack React Query 5  
- **Forms:** React Hook Form  
- **HTTP:** Axios  
- **Real-time:** `socket.io-client`  
- **Payments (client):** Stripe.js + `@stripe/react-stripe-js`  
- **WebAuthn (client):** `@simplewebauthn/browser`  
- **Sui / wallets:** `@mysten/dapp-kit`, `@mysten/sui`, `@wallet-standard/core`  
- **Charts:** Chart.js, `react-chartjs-2`  
- **UX:** `react-hot-toast`, Lucide React icons  
- **Telegram (optional):** `@telegram-apps/bridge`  
- **Lint / types:** ESLint 9, TypeScript ~5.9  

The production build outputs static assets suitable for CDN or static hosting; API calls target the backend (configured via environment).

---

## iOS (`ios-app/`) and Swift module (`ios-module/`)

- **App:** Native Swift / SwiftUI (Xcode project under `ios-app/`)  
- **Shared package:** `OnCutsModule` (Swift Package in repo root `Package.swift`)  
  - **Platforms:** iOS 17+, macOS 14+ (for the library product)  
  - **Real-time:** [Socket.IO Swift client](https://github.com/socketio/socket.io-client-swift) (`SocketIO`)  
- **Networking / auth in app:** See `ios-app/OnCuts/Services` (e.g. `NetworkManager`, Keychain)  

---

## End-to-end tests (`e2e/`)

- **Runner:** [Playwright](https://playwright.dev/) (`@playwright/test` — install locally or in CI as needed)  
- **Config:** `e2e/playwright.config.ts` (default `baseURL` `http://localhost:3000`, Chromium / Firefox / WebKit + mobile projects)  
- **Specs:** `e2e/tests/*.spec.ts`  

---

## Infrastructure & operations (typical)

- **PostgreSQL** as the system of record for users, bookings, messaging metadata, etc.  
- **Redis** for BullMQ (and any Redis usage in the backend).  
- **Stripe** for card payments and barber payouts (Connect).  
- **AWS S3** (or compatible) for object storage where configured.  
- **Docker** images defined for backend and web-app for deployable services.  

Exact hosting (e.g. which cloud, reverse proxy, env vars) is environment-specific; see `backend/.env.example` and `web-app/.env.example` for variable names.

---

## Documentation elsewhere

Product and flow docs (messaging, pages, Postgres snippets) live in markdown files at the repo root (e.g. `MESSAGING.md`, `PAGE_FLOWS.md`, `POSTGRES_COMMANDS.md`) and under `ios-module/`.

---

*Last updated to reflect the repository layout and `package.json` / `Package.swift` dependencies as of the document’s creation.*
