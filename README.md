# OnCuts

**A campus marketplace connecting students with barbers — web, iOS, and API.**

Production: [oncuts.com](https://oncuts.com)

---

## Overview

OnCuts is a peer-to-peer barber marketplace for college communities. Students discover providers near their campus, book appointments, message, pay after service, and leave reviews. Barbers manage availability, accept bookings, and get paid via **Stripe Connect**.

The platform ships as:

| Client | Path | Notes |
|--------|------|--------|
| **Web PWA** | `web-app/` | Primary surface — consumer, barber, and admin UIs at `/web` and `/app` |
| **OnCuts** (iOS) | App Store + `ios-module/` | Native consumer app (SwiftUI SPM module) |
| **OnCuts Operator** (iOS) | App Store + `ios-module/` | Native barber/operator app |
| **API** | `backend/` | Node.js REST + Socket.IO on AWS EC2 |

`ios-app/` is a legacy standalone Xcode prototype; production iOS builds embed **`ios-module`** (`CampusCutsModule`).

Architecture diagrams: [`OnCuts_C4_Model`](OnCuts_C4_Model) (draw.io, L1–L3). Infrastructure details: [`AWS_INFRASTRUCTURE.md`](AWS_INFRASTRUCTURE.md).

---

## How It Works

**For students (consumers):**
1. Pick a campus or location
2. Browse barbers — profiles, portfolios, ratings, pricing
3. Book a time slot (1-hour blocks prevent double-booking)
4. Message the barber before or after booking
5. Get the service at the scheduled time
6. Pay with card (Stripe) or cash after service; optional tip
7. Leave a review

**For barbers (operators):**
1. Apply to join (registered or guest application flow)
2. Complete **Stripe Connect** onboarding for payouts
3. Set weekly availability and service pricing
4. Accept or reject booking requests; message clients
5. Mark services complete
6. Receive payout minus platform commission (15% default)

**For platform admins:**
- Full operations via the embedded **Admin Dashboard** in the web app (users, campuses, bookings, moderation, platform settings, metrics)

---

## Platform Highlights

- **100+ campuses** seeded across the United States
- **Post-service payments** — card (Stripe), cash (admin-toggleable), Apple Pay / Google Pay on web
- **Stripe Connect** — barber onboarding, Express payouts, webhook-driven status sync
- **Real-time messaging** — Socket.IO on web; REST polling on iOS
- **Push notifications** — APN for iOS (booking reminders, status updates)
- **Location-aware discovery** — campus catalog, provider service pins, Nominatim geocoding
- **Marketplace engine** — dynamic pricing signals and provider ranking (cron)
- **Beauty services** — barber and beauty provider types (braids, nails, etc.)
- **Admin Dashboard** — campus oversight, user roles, UGC moderation, notification templates

---

## Quick Start

```bash
git clone https://github.com/lmckeown27/OnCuts.git
cd OnCuts

# Backend
cd backend
npm install --legacy-peer-deps
cp .env.example .env   # configure DATABASE_URL, JWT, Stripe, etc.
npm run build
npm run dev            # http://localhost:3000 (set PORT=3001 in .env if needed)

# Web (separate terminal)
cd ../web-app
npm install
cp .env.example .env   # VITE_API_URL, Stripe publishable key
npm run dev            # http://localhost:5173
```

**Production API** (requires `NODE_ENV=production`):

```bash
cd backend && pm2 start ecosystem.config.cjs --env production
```

---

## Tech Stack

### Backend (`backend/`)
- Node.js, TypeScript, Express 4, Socket.IO
- PostgreSQL (+ PostGIS) via `pg`; Prisma schema in `backend/prisma/`
- Redis — OTP cache, sessions, messaging helpers
- Stripe (payments + Connect webhooks)
- AWS S3 (images), AWS Pinpoint SMS Voice v2 (phone OTP)
- Nodemailer (SMTP), APN + Firebase Admin (push scaffold)
- node-cron (scheduled jobs), Multer + Sharp (uploads)
- Google / Apple ID token verification (`google-auth-library`, `jwks-rsa`)

Payments are **Stripe off-chain only** in production. Legacy Aptos/Sui/Circle paths are disabled.

### Web (`web-app/`)
- React 19, TypeScript, Vite 5, TailwindCSS
- Zustand, TanStack React Query, React Router 6
- Socket.IO client, Stripe.js, Leaflet, Chart.js
- Typography: **Inter** (Google Fonts)

### iOS (`ios-module/` + App Store apps)
- SwiftUI, SwiftPM (iOS 17+), URLSession REST client
- Stripe iOS SDK, APN via `UserNotifications`
- Shared module consumed by **OnCuts** and **OnCuts Operator** host apps

---

## Architecture

OnCuts uses the [C4 model](https://c4model.com/) (Levels 1–3). Open [`OnCuts_C4_Model`](OnCuts_C4_Model) in [draw.io](https://app.diagrams.net/).

| Page | Scope |
|------|--------|
| L1 — System Context | People, OnCuts, external systems |
| L2 — Containers | Web, API, iOS apps, PostgreSQL, Redis, Nginx |
| L3 — API Application | Backend domain components |
| L3 — Web Application | React PWA components |
| L3 — iOS Consumer / Operator | SwiftUI modules |

### L1 — Personas & externals

| Persona | Description |
|---------|-------------|
| **CONSUMER** | Books, messages, pays, reviews |
| **BARBER** | Availability, bookings, Connect payouts |
| **ADMIN** | Platform ops via Admin Dashboard |

| External system | Purpose |
|-----------------|---------|
| Google OAuth / Apple Sign-In | ID token auth (web Google; native Google + Apple) |
| AWS | EC2 compute, S3 storage, SMS APIs |
| Stripe | Card payments and Connect payouts |
| APN | iOS push |
| SMS OTP | Phone verification (API + web UI; requires Redis) |
| SMTP | Transactional email |
| OpenStreetMap Nominatim | Geocoding |

### L2 — Containers

Hosted on **AWS EC2 (Ubuntu)** with **Nginx** terminating TLS, serving static web assets, and proxying `/api` and `/socket.io`.

| Container | Technology |
|-----------|------------|
| Web Application | React + Vite PWA |
| API Application | Node.js + Express + Socket.IO |
| iOS Consumer / Operator | SwiftUI (`ios-module`) |
| Database | PostgreSQL (+ PostGIS) |
| Cache | Redis |
| Reverse Proxy | Nginx |

Web uses **HTTPS REST + WebSocket**. iOS uses **REST only** (no Socket.IO client in production module).

### Booking flow

```
Consumer books → Barber accepts/rejects → Service performed →
Barber marks complete → Consumer pays (card or cash) → PAID
```

### Real-time events (web)

```
Socket.IO: booking-update, payment-received, new-message, notification
```

---

## Authentication & Roles

### Sign-in methods

| Method | Web | iOS | Backend |
|--------|-----|-----|---------|
| Email + password | ✅ | ✅ | `POST /auth/login`, `/register` |
| Email verification (6-digit) | ✅ | ✅ | `POST /auth/verify-email` |
| Google Sign-In | ✅ | ✅ (native) | `POST /auth/google` |
| Apple Sign-In | — | ✅ (native) | `POST /auth/apple` |
| SMS OTP | ✅ | ✅ (module) | `POST /auth/request-otp`, `/verify-otp` |
| Password reset | ✅ | — | `POST /auth/request-password-reset` |

All auth goes through the API. Admin access is granted via the database `ADMIN` role only — no hardcoded client credentials.

### Roles (database)

| DB role | Web UI type | Description |
|---------|-------------|-------------|
| `CONSUMER` | `student` | Books appointments |
| `BARBER` | `barber` | Service provider |
| `CAMPUS_MANAGER` | `barber` | Legacy role; no dedicated UI — campus ops are **admin-only** |
| `ADMIN` | `admin` | Full platform access via Admin Dashboard |

Promote admins via the Admin Dashboard or SQL (see `POSTGRES_COMMANDS.md`).

### JWT

- Access token (default 7 days)
- Refresh token (default 3650 days in `.env.example`)
- Role-based middleware on all protected routes

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Payments

**Stripe Connect** is the production payment rail.

| Feature | Status |
|---------|--------|
| Post-service card checkout | ✅ |
| Optional tips (15%, 20%, 25%, custom) | ✅ |
| Cash payments | ✅ (admin-toggleable) |
| Apple Pay / Google Pay (web) | ✅ |
| Barber Connect onboarding | ✅ |
| Platform commission | 15% default (admin-configurable incentives) |
| Wallet API (`/api/v2/wallet`) | ✅ |
| Circle / Aptos / Sui on-chain | ❌ disabled |

```
Barber marks complete → Consumer receives email → Consumer pays → Funds via Connect
```

---

## Key Features

### Consumers
- Campus and location-based barber discovery
- Booking with availability and conflict prevention
- Real-time messaging (web) / REST chat (iOS)
- Post-service card or cash payment with tips
- Reviews and ratings
- Booking status tracking

### Barbers / operators
- Weekly schedule and custom service pricing
- Accept/reject bookings; reschedule requests
- Stripe Connect onboarding and earnings
- Portfolio uploads (S3), Instagram link
- Visibility toggle (hidden from discovery, direct-booking links)
- Analytics panel (earnings, bookings)
- Barber application flow (consumer → operator)

### Platform (admin)
- Embedded Admin Dashboard (users, campuses, bookings, moderation)
- Platform settings (fees, cash payments, waitlist home mode)
- Notification templates and custom announcements
- Live transaction feed, audit logs, UGC reports
- Barber application review

---

## Database Setup

```bash
sudo -u postgres psql
CREATE DATABASE oncuts;
CREATE USER oncuts_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE oncuts TO oncuts_user;
\c oncuts
GRANT ALL ON SCHEMA public TO oncuts_user;
```

**Run migrations** (65+ SQL files in `backend/src/database/migrations/`):

```bash
cd backend
for f in src/database/migrations/*.sql; do
  sudo -u postgres psql -d oncuts -f "$f"
done
sudo -u postgres psql -d oncuts -f src/database/seed_campuses.sql
```

Prisma schema: `backend/prisma/schema.prisma`. Optional: `npm run migrate:deploy` in `backend/`.

See [`POSTGRES_COMMANDS.md`](POSTGRES_COMMANDS.md) for operational queries.

---

## Environment Variables

Copy `backend/.env.example` → `backend/.env` and `web-app/.env.example` → `web-app/.env`.

### Backend (essential)

```bash
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://oncuts_user:password@localhost:5432/oncuts
REDIS_URL=redis://127.0.0.1:6379

JWT_SECRET=
JWT_REFRESH_SECRET=
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=3650d

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET_ACCOUNT=
STRIPE_WEBHOOK_SECRET_CONNECT=
STRIPE_MODE=auto

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
EMAIL_FROM="OnCuts <oncutshelp@gmail.com>"
FRONTEND_URL=https://oncuts.com
AUTO_VERIFY_EMAILS=false

USE_S3=true
S3_BUCKET=campuscut-images
S3_REGION=us-west-1

GOOGLE_OAUTH_IOS_CLIENT_ID=
GOOGLE_OAUTH_WEB_CLIENT_ID=
APPLE_CLIENT_ID=
APPLE_PROVIDER_CLIENT_ID=

# SMS OTP (requires REDIS_URL)
# ONCUTS_SMS_NOTIFY_CONFIGURATION_ID=
# ONCUTS_SMS_NOTIFY_TEMPLATE_ID=

# iOS push (APN)
# APN_KEY_ID=
# APN_TEAM_ID=
# APN_PRIVATE_KEY=
# APN_BUNDLE_ID=
```

### Web

```bash
VITE_API_URL=https://oncuts.com/api/v1
VITE_API_ORIGIN=https://oncuts.com
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_…
VITE_GOOGLE_OAUTH_CLIENT_ID=
```

Legacy blockchain env vars in older example files (`env.production.example`) are **not** used by the current payment architecture.

---

## Development

```bash
# Backend (nodemon, default port 3000)
cd backend && npm run dev

# Web (Vite, port 5173)
cd web-app && npm run dev

# iOS module (SwiftPM)
swift build   # from repo root (Package.swift)
```

### Useful API checks

```bash
curl http://localhost:3000/health
curl http://localhost:3000/api/v1/campus
curl "http://localhost:3000/api/v1/barbers?campusId=<uuid>"
```

### Stripe test cards

```
4242 4242 4242 4242  — success
4000 0000 0000 0002  — decline
4000 0000 0000 9995  — insufficient funds
```

---

## Deployment

Production runs on a single **AWS EC2** instance (Ubuntu):

1. PostgreSQL and Redis on-host (or Upstash for Redis)
2. **PM2** fork mode, 1 API instance (`backend/ecosystem.config.cjs`)
3. **Nginx** — TLS, static files at `/var/www/oncuts/dist`, proxy to API
4. **S3** for image storage (`us-west-1`)

```bash
git clone https://github.com/lmckeown27/OnCuts.git
cd OnCuts

# Database + migrations (see Database Setup)
cp backend/.env.example backend/.env && nano backend/.env

cd backend && npm install --legacy-peer-deps && npm run build
cd ../web-app && npm install && npm run build

cd ../backend && pm2 start ecosystem.config.cjs --env production
pm2 startup && pm2 save

sudo mkdir -p /var/www/oncuts/dist
sudo rsync -a --delete ../web-app/dist/ /var/www/oncuts/dist/
sudo cp ../server-nginx.conf /etc/nginx/sites-available/oncuts
sudo ln -sf /etc/nginx/sites-available/oncuts /etc/nginx/sites-enabled/oncuts
sudo nginx -t && sudo systemctl reload nginx
```

**Deploy updates:**

```bash
cd ~/OnCuts && git pull origin main
cd backend && npm install && npm run build && pm2 restart oncuts-backend --update-env
cd ../web-app && npm install && npm run build
sudo rsync -a --delete dist/ /var/www/oncuts/dist/
```

CI: `.github/workflows/ci.yml` (Node 24, Redis service, backend tests).

---

## Database Schema

### Key tables

| Table | Description |
|-------|-------------|
| `users` | Accounts, roles, Stripe Connect fields |
| `barbers` | Provider profiles, availability, pricing, service location |
| `bookings` | Appointments and status lifecycle |
| `reviews` | Post-service ratings |
| `campuses` | University catalog |
| `conversations` / `messages` | Messaging |
| `barber_applications` / `guest_barber_applications` | Operator onboarding |
| `notifications` / `notification_templates` | In-app and push copy |
| `platform_settings` | Admin-editable platform config |

### Booking statuses

| Status | Description |
|--------|-------------|
| `PENDING` | Awaiting barber response |
| `ACCEPTED` | Confirmed, upcoming |
| `COMPLETED` | Service done, awaiting payment |
| `PAID` | Payment received |
| `CANCELLED` | Cancelled by consumer |
| `REJECTED` | Rejected by barber |

---

## Troubleshooting

**Backend won't start**
```bash
pm2 logs oncuts-backend --lines 50
cd backend && rm -rf dist && npm run build && pm2 restart oncuts-backend --update-env
```

**Database connection**
```bash
sudo -u postgres psql -d oncuts -c "SELECT 1;"
grep DATABASE_URL backend/.env
```

**Email not sending** — verify `SMTP_*`, app password, `EMAIL_FROM`, spam folder.

**Images not uploading** — verify `USE_S3`, `S3_BUCKET`, `S3_REGION`, bucket CORS.

**SMS OTP failing** — requires `REDIS_URL` and AWS Pinpoint notify config (`ONCUTS_SMS_*`).

**Stripe Connect stale** — `npm run clear-stripe-connect -- --validate-stale` in `backend/`.

---

## Performance

- Payment processing: ~2–3s (Stripe)
- Database queries: <50ms typical
- API response: <200ms typical
- WebSocket latency: <100ms (web)
- PM2 single fork instance; scale via instance size or future cluster config

---

## Security

- JWT + refresh tokens, bcrypt password hashing
- Email verification on signup
- Google / Apple ID token verification
- Role-based access control
- Parameterized SQL, Helmet, CORS, rate limits on auth
- HTTPS in production (Nginx)
- Admin promotion via database role only (no client-side bypass)

---

## Roadmap

### Shipped
- Stripe post-service payments + Connect payouts
- Web PWA (consumer, barber, admin)
- Native iOS apps (OnCuts + OnCuts Operator)
- Email verification, SMS OTP, Google / Apple auth
- Real-time messaging (web), push notifications (APN)
- Admin Dashboard, marketplace pricing, location discovery
- Beauty provider types, waitlist home mode, UGC moderation

### In progress / planned
- Deeper analytics and exports
- Full waitlist product (beyond landing mode)
- Recurring appointments
- Android app
- Loyalty / rewards program

---

## Project Structure

```
OnCuts/
├── backend/
│   ├── src/
│   │   ├── controllers/       # Route handlers
│   │   ├── routes/              # API mounts
│   │   ├── services/            # Business logic (payments, SMS OTP, push, etc.)
│   │   ├── middleware/          # Auth, validation
│   │   ├── database/migrations/ # Primary SQL migrations (65+)
│   │   └── index.ts             # API entry
│   ├── prisma/                  # Prisma schema
│   └── ecosystem.config.cjs     # PM2 config
├── web-app/                     # React PWA
├── ios-module/                  # SwiftPM shared iOS module (production)
├── ios-app/                     # Legacy Xcode prototype
├── e2e/                         # Playwright tests
├── scripts/                     # Deploy / ops scripts
├── OnCuts_C4_Model              # C4 architecture (draw.io)
├── AWS_INFRASTRUCTURE.md        # AWS inventory and ops notes
├── POSTGRES_COMMANDS.md         # Database runbook
├── server-nginx.conf            # Production Nginx config
└── README.md
```

---

## Related Documentation

| Document | Contents |
|----------|----------|
| [`OnCuts_C4_Model`](OnCuts_C4_Model) | L1–L3 architecture diagrams |
| [`AWS_INFRASTRUCTURE.md`](AWS_INFRASTRUCTURE.md) | EC2, S3, SMS, IAM, production topology |
| [`POSTGRES_COMMANDS.md`](POSTGRES_COMMANDS.md) | SQL runbook, admin promotion, Stripe diagnostics |

---

## Support

- **Issues:** [GitHub Issues](https://github.com/lmckeown27/OnCuts/issues)
- **Email:** oncutshelp@gmail.com
- **Production:** https://oncuts.com
- **iOS:** [OnCuts](https://apps.apple.com/us/app/oncuts/id6789238174) · [OnCuts Operator](https://apps.apple.com/us/app/oncuts-operator/id6789008195)

---

## License

MIT License — see [LICENSE](LICENSE).

---

Platform version: 2.1.0 · Last updated: August 2026
