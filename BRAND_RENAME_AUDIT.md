# Brand Rename Audit: CampusCuts / Intera → OnCuts

**Last updated:** July 2026  
**Purpose:** Track what has been renamed to OnCuts, what still uses legacy CampusCuts or Intera naming, and a tiered plan for completing the migration without breaking production.

---

## Executive summary

OnCuts is the **current product brand** (web, marketing, emails, production domain). The codebase reflects a **partial rebrand** from an earlier stack:

| Legacy name | Role today |
|-------------|------------|
| **CampusCuts** | Original product name; still used heavily in iOS/Swift module naming, infra defaults, and migration shims |
| **Intera** | Parent/host iOS platform that embeds booking via `CampusCutsModule`; SMS OTP, dual App Store apps (consumer + provider) |
| **Avila Platforms** | Consumer iOS app on the App Store (`avilaplatforms`); legacy browser storage keys |
| **Pismo Platforms** | Stripe Connect platform account (replacing Intera Platforms LLC keys per ops docs) |

**Production web/API canonical origin:** `https://oncuts.com`

---

## Brand relationship diagram

```
┌─────────────────────────────────────────────────────────────┐
│  OnCuts (product brand — web, emails, oncuts.com)           │
├─────────────────────────────────────────────────────────────┤
│  CampusCutsModule (Swift package — legacy internal name)    │
│    └── embedded in Intera / Avila iOS apps                  │
├─────────────────────────────────────────────────────────────┤
│  Intera (platform layer)                                    │
│    ├── AvilaPlatforms (consumer App Store app)              │
│    ├── InteraProvider (barber/provider App Store app)       │
│    ├── SMS OTP (intera/* backend services)                  │
│    └── Shared backend with OnCuts API                       │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ Already updated to OnCuts

These areas use OnCuts as the primary name and should be treated as **source of truth**.

### Web & marketing

| Item | Location | Notes |
|------|----------|-------|
| Page title, OG tags, PWA name | `web-app/index.html` | `OnCuts` throughout |
| Legal pages | `web-app/src/pages/legal/*` | Terms, Privacy, GDPR |
| Landing page copy | `web-app/src/pages/LandingPage.tsx` | OnCuts branding |
| PWA manifest | `web-app/public/manifest.json`, `site.webmanifest` | OnCuts |
| App install / download pages | `AppInstallPage.tsx`, `MobileAppDownloadPage.tsx` | OnCuts |
| OnCuts logo asset export | `web-app/src/assets/index.ts` → `OnCutsLogo` (also stale `CampusCutLogo` alias — see Tier 1) |
| iOS promo OnCuts card | `web-app/src/components/IosAppPromoSection.tsx` | Uses `OnCuts_Logo.png` |

### Backend runtime

| Item | Location | Notes |
|------|----------|-------|
| API server identity | `backend/src/index.ts` logs | "OnCuts API server" |
| Canonical frontend URL | `backend/src/config/app-url.ts` | `DEFAULT_PRODUCTION_APP_URL = https://oncuts.com` |
| JWT issuance (new tokens) | `backend/src/utils/jwt.utils.ts` | `iss: oncuts-api`, `aud: oncuts-client` |
| PM2 process name | `backend/ecosystem.config.cjs` | `oncuts-backend` (legacy `campuscuts-backend` noted in comment) |
| Package name | `backend/package.json` | `oncuts-backend` |
| Docker containers | `docker-compose.yml` | `oncuts-api`, `oncuts-postgres`, `oncuts-frontend`, `oncuts-redis` |
| Database name (prod docs) | `README.md` | `oncuts` / `oncuts_user` |
| Email from-name & templates | `backend/src/services/email.service.ts` | "OnCuts" in subjects, HTML, verification flows |
| Stripe statement descriptors | `payout.service.ts`, `payout-v2.service.ts`, config | `OnCuts`, `OnCuts Payout`, `STRIPE_STATEMENT_DESCRIPTOR=ONCUT` |
| Google Calendar integration | `google-calendar.service.ts` | OnCuts in user-facing strings |
| Nginx production config | `server-nginx.conf` | `oncuts.com` only |
| Support email (README) | `README.md` | `support@oncuts.com` |

### iOS (user-visible only)

| Item | Location | Notes |
|------|----------|-------|
| Home screen display name | `ios-app/CampusCuts/Info.plist` | `CFBundleDisplayName` = **OnCuts** |
| API production URL | `ios-module/.../CampusCutsEnvironment.swift` | Points to `https://oncuts.com/api/v1` (type name still CampusCuts*) |

### Web client storage (new keys)

Migration helpers in `web-app/src/utils/storageMigration.ts` copy legacy keys → `oncuts_*`:

| New key | Legacy key(s) | File |
|---------|---------------|------|
| `oncuts_user_location` | `campuscut_user_location` | `useGeolocation.ts` |
| `oncuts_location_permission` | `campuscut_location_permission` | `useGeolocation.ts` |
| `oncuts_selected_college_town` | `campuscut_selected_college_town` | `collegeTowns.ts` |
| `oncuts_offline_actions` | `campuscuts_offline_actions` | `appUtils.ts` |
| `oncuts_filter_criteria` | — | `ConsumerPage.tsx` |
| `oncuts_pending_signup_phone` | `avilaplatforms_pending_signup_phone` | `storageMigration.ts` |
| `oncuts_verify_gate_ok:*` | `avilaplatforms_verify_gate_ok:*` | `VerifyEmailPage.tsx` |
| `oncuts_barber_hidden_paid_bookings_*` | `avilaplatforms_barber_hidden_paid_bookings_*` | `BarberPage.tsx` |

Auth tokens use **generic** keys (`accessToken`, `refreshToken`, `user`) — not brand-prefixed.

---

## 🟡 Still CampusCuts (legacy product name)

~75 files still reference CampusCuts / campuscut / campuscuts. Grouped by impact.

### iOS & Swift (largest remaining block)

| Category | Examples | Files (approx.) |
|----------|----------|-----------------|
| Swift package | `CampusCutsModule` product/target | `Package.swift` |
| Source directory | `ios-module/Sources/CampusCutsModule/` | 30+ Swift files |
| Public API types | `CampusCutsClient`, `CampusCutsAPIService`, `CampusCutsHomeView`, `CampusCutsSignUpAPI`, … | ios-module |
| Xcode target / app | `CampusCuts` target, `CampusCutsApp`, `CampusCuts.xcodeproj` | ios-app |
| Podfile | `target 'CampusCuts'` | `ios-app/Podfile` |
| CI test scheme | `-scheme CampusCuts` | `scripts/test-all.sh` |
| Keychain services | `com.campuscuts.ios`, `com.campuscuts.module.auth` | `KeychainManager.swift`, `CampusCutsAuthTokenStore.swift |
| Swift comments | `// CampusCutsModule` file headers | Most ios-module files |
| Misleading variable | `isProductionCampusCuts` (checks `oncuts.com`) | `StripeService.swift` |

**Note:** Display name is OnCuts; **internal module and likely bundle ID remain CampusCuts-era.**

### Backend — auth & push defaults

| Item | Location | Value / behavior |
|------|----------|------------------|
| JWT legacy verification | `backend/src/utils/jwt.utils.ts` | Still accepts `campuscuts-api` / `campuscuts-client` |
| APNs fallback bundle ID | `pushNotification.service.ts`, `apn-topic-routing.ts` | Defaults to `com.campuscuts.ios` |
| Env example | `backend/env.example` | `APN_BUNDLE_ID=com.campuscuts.ios` |

### Backend — CORS / allowed origins

Still allowed in `backend/src/index.ts`:

- `https://campuscut.com`, `https://www.campuscut.com`
- `https://campuscuts.app`, `https://www.campuscuts.app`
- `https://api.campuscuts.app`

*(No matching nginx redirect blocks in `server-nginx.conf` — legacy domains may still hit the API if DNS points here.)*

### Infrastructure & assets

| Item | Location | Notes |
|------|----------|-------|
| S3 bucket default | `backend/src/services/s3.service.ts` | `campuscut-images` |
| S3 URL helper | `CampusCutsS3ImageURL.swift` | Hardcoded `campuscut-images.s3.amazonaws.com` |
| QR script output | `backend/src/scripts/generate-qr.ts` | Default `campuscut-qr.png` |
| README S3 example | `README.md` | `S3_BUCKET_NAME=campuscut-images` |

### Database & schema (comments / examples only)

| Item | Location |
|------|----------|
| Prisma schema header | `backend/prisma/schema.prisma` — "CampusCuts Production Database Schema" |
| SQL migration headers | `001_init_core_schema.sql`, `002_reputation_and_intelligence.sql`, etc. |
| Commented GRANT examples | `campuscuts_user`, `campuscuts_app` in several migrations |
| Seed run instructions | `psql -d campuscuts` in `seed_campuses.sql`, `seed-mock-data.sql` |
| Migration comment | `029_mobile_devices_bundle_id.sql` — "CampusCuts consumer vs Intera Provider" |

### Web — minor leftovers

| Item | Location |
|------|----------|
| Logo export alias | `CampusCutLogo` in `web-app/src/assets/index.ts` (unused) |
| Legacy storage keys (read-only migration) | `campuscut_*`, `campuscuts_*` in geolocation, collegeTowns, appUtils |

### Copy bug (OnCuts + CampusCut mixed)

| Item | Location |
|------|----------|
| Barber interview mailto body | `email.service.ts` ~L1627 — subject says OnCuts; body says "barber on **CampusCut**" |

---

## 🔵 Intera / Avila / Pismo (platform layer — separate from OnCuts rebrand)

These are **intentional** integrations with the parent iOS platform. Renaming to OnCuts may not be desired without a coordinated Intera product decision.

### Intera — backend services & routes

| Item | Location | Purpose |
|------|----------|---------|
| SMS OTP | `backend/src/services/intera/` (`SmsProvider.ts`, `phone-otp.service.ts`) | Phone sign-in for Intera iOS |
| OTP Redis prefix | `intera:sms_otp:` | `phone-otp.service.ts` |
| OTP controller | `backend/src/controllers/intera-otp.controller.ts` | `request-otp` / `verify-otp` |
| Auth routes | `backend/src/routes/auth.routes.ts` | Aliases documented for Intera sign-up |
| Google / Apple login | `auth.controller.ts`, `index.ts` comments | "Intera / iOS" JWT exchange |
| User profile API | `user.controller.ts` | "Intera / native" camelCase mapping |
| Provider API shape | `provider.routes.ts`, `service-provider.mapper.ts`, `service-provider.types.ts` | Intera `ServiceProvider` DTO parity |
| Booking routes | `booking-request.routes.ts` | Intera alias for `providerId` |
| Message routes | `message.routes.ts` | Intera-compatible report URL |
| Push notifications | `pushNotification.service.ts`, `apn-topic-routing.ts` | Dual Intera apps on one backend |
| Stripe Connect cleanup | `connect-consumer-eligibility.service.ts`, `clear-stripe-connect.ts` | Migration from Intera Platforms LLC → Pismo |
| Env docs | `backend/.env.example` | `INTERA_*`, `APPLE_CLIENT_ID=Liam.Intera`, Google audiences for Intera plist |

### Intera — APNs dual-app routing

`apn-topic-routing.ts` resolves push topics for:

1. **`mobile_devices.bundle_id`** (per-device, most accurate)
2. **`CONSUMER_APN_BUNDLE_ID`** / **`PROVIDER_APN_BUNDLE_ID`** (role-based env)
3. **Legacy fallback:** `APN_BUNDLE_ID` → `com.campuscuts.ios`

Provider bundle example from env comments: `Liam.Intera---Provider` (three hyphens preserved).

### Intera / Avila — iOS & web

| Item | Location | Notes |
|------|----------|-------|
| Module embed comments | `CampusCutsClient+ShellBooking.swift`, `+ShellProfile.swift` | "host apps (e.g. Intera)" |
| UI component comment | `CampusCutsLiquidToggle.swift` | "matches Intera liquid-glass surfaces" |
| Login splash | `ios-app/.../LoginView.swift` | Shows "AvilaPlatforms" text |
| App Store links | `IosAppPromoSection.tsx` | AvilaPlatforms + InteraProvider apps |
| App Store URLs | | Consumer: `avilaplatforms/id6763953203`; Provider: `interaprovider/id6770430152` |
| Provider logo asset | `iOS_InteraProvider_Logo.png` | Landing promo |
| Browse categories | `providerCategories.ts`, `service-provider.ts` | "aligned with Intera ServiceCategory" |
| CORS origins | `backend/src/index.ts` | `avilaplatforms.com`, `pismoplatforms.com` |

### Avila Platforms — legacy browser storage

| Legacy key | Migrated to | File |
|------------|-------------|------|
| `avilaplatforms_pending_signup_phone` | `oncuts_pending_signup_phone` | `storageMigration.ts` |
| `avilaplatforms_verify_gate_ok:*` | `oncuts_verify_gate_ok:*` | `VerifyEmailPage.tsx` |
| `avilaplatforms_verify_terms_ok:*` | (read via migration) | `VerifyEmailPage.tsx` |
| `avilaplatforms_barber_hidden_paid_bookings_*` | `oncuts_barber_hidden_paid_bookings_*` | `BarberPage.tsx` |
| `avilaplatforms_access_token` etc. | Cleared on logout | `ConsumerProfileEditor.tsx` |

### Pismo Platforms — ops / Stripe (not product branding)

Documented in `POSTGRES_COMMANDS.md`: Stripe Connect migration from **Intera Platforms LLC** to **Pismo Platforms** live keys. This is a **payment platform account** change, not an OnCuts rename task.

---

## Tiered migration plan

Ordered by risk. Complete lower tiers before higher ones.

### Tier 0 — Cosmetic (✅ safe anytime)

**Risk:** None

- [ ] Update SQL/Prisma file header comments (CampusCuts → OnCuts)
- [ ] Update Swift file header comments
- [ ] Fix seed script comments (`psql -d campuscuts` → `oncuts`)
- [ ] Rename QR script default output filename
- [ ] Update README S3 env var example to match `S3_BUCKET`
- [ ] Remove unused `CampusCutLogo` export or rename to `OnCutsLogo`

**Effort:** ~1–2 hours · **No deploy coordination**

---

### Tier 1 — Low-risk user-facing copy

**Risk:** Low

- [ ] Fix "CampusCut" typo in barber interview email mailto body (`email.service.ts`)
- [ ] Rename `isProductionCampusCuts` → `isProductionOnCuts` in `StripeService.swift`

**Effort:** ~30 min

---

### Tier 2 — Web localStorage legacy keys

**Risk:** Low while migration helpers remain · **Medium if removed too early**

- [ ] Audit all `readLocalStorageWithMigration` call sites run on boot
- [ ] Monitor legacy key usage (optional analytics)
- [ ] Wait 2–3 release cycles
- [ ] Remove legacy key constants and migration reads

**Do not remove yet** — returning PWA users may still have `campuscut_*` / `avilaplatforms_*` keys.

---

### Tier 3 — Infrastructure defaults & CORS

**Risk:** Medium

**3a. Legacy domains**

- [ ] Confirm DNS: which of `campuscut.com`, `campuscuts.app`, `api.campuscuts.app` still resolve
- [ ] Check server logs for `Origin` from legacy domains
- [ ] Add nginx 301 redirects → `oncuts.com`
- [ ] Remove CORS entries only after redirects live and traffic is zero

**3b. S3 bucket `campuscut-images`**

- [ ] Confirm prod `S3_BUCKET` env (vs code default)
- [ ] If renaming: create `oncuts-images`, dual-read period, migrate objects, update Swift helper + backend

**3c. Database name in docs**

- Comments only — **do not rename** production Postgres database casually

**Effort:** 2–4 hours + DNS/ops · **Requires coordination**

---

### Tier 4 — Auth & push

**Risk:** Medium–high

**4a. JWT legacy issuers**

- [ ] Sample prod JWTs — any still `iss: campuscuts-api`?
- [ ] Wait full token TTL after last old-claim issuance (7d per README)
- [ ] Remove `LEGACY_JWT_ISSUERS` / `LEGACY_JWT_AUDIENCES` from `jwt.utils.ts`

**4b. APNs bundle IDs**

- [ ] Document actual prod values for `CONSUMER_APN_BUNDLE_ID`, `PROVIDER_APN_BUNDLE_ID`, `APN_BUNDLE_ID`
- [ ] Do **not** change code default until bundle ID strategy is decided
- [ ] Bundle ID change = new App Store app or complex migration + re-register all devices

**Effort:** 30 min code + waiting period · **Can log users out or break push**

---

### Tier 5 — iOS / Swift restructure

**Risk:** High · **Breaks Intera embed consumers if uncoordinated**

- [ ] Confirm external repos importing `CampusCutsModule` (Intera host app)
- [ ] Phase A: Add `typealias` shims (`CampusCutsClient` → `OnCutsClient`)
- [ ] Phase B: Rename module, directory, types, Xcode target, Podfile, tests
- [ ] Phase C: Remove shims after consumers update
- [ ] Phase D: Bundle ID decision (`com.campuscuts.ios` → `com.oncuts.ios`?) — separate App Store track

**Effort:** 1–3 days + consumer release coordination

---

### Tier 6 — Very high / avoid unless required

| Action | Why risky |
|--------|-----------|
| Rename Postgres database | Connection strings, downtime |
| Rename S3 bucket without dual-read | Broken portfolio images globally |
| Change App Store bundle ID | New listing or migration |
| Remove legacy CORS before DNS redirects | Clients on old domains fail |
| Rename `CampusCutsModule` without Intera coordination | Host apps fail to compile |
| Rename Intera backend services (`intera/*`) to OnCuts | Breaks documented Intera API contracts unless Intera app is also updated |

---

## Pre-flight checklist (before any breaking change)

- [ ] **Live domains:** Traffic on `campuscut.com`, `campuscuts.app`, `api.campuscuts.app`?
- [ ] **JWT audit:** Any tokens with `iss: campuscuts-api` in the wild?
- [ ] **`mobile_devices` query:** `SELECT DISTINCT bundle_id FROM mobile_devices;`
- [ ] **S3:** Is prod using env `S3_BUCKET` or default `campuscut-images`?
- [ ] **External consumers:** Does Intera (or other apps) import `CampusCutsModule` from this repo?
- [ ] **App Store Connect:** Bundle IDs vs display names for AvilaPlatforms / InteraProvider / standalone CampusCuts app
- [ ] **Stripe:** Platform account is Pismo (not Intera Platforms LLC) per `POSTGRES_COMMANDS.md`

---

## Recommended execution order

```
Tier 0 (comments/docs)
  → Tier 1 (copy typos)
  → Tier 2 (monitor localStorage migration)
  → Tier 3a (legacy domain redirects + CORS audit)
  → Tier 4a (JWT legacy removal after expiry window)
  → Tier 4b (document APN bundle IDs; don't change defaults blindly)
  → Tier 5 (Swift rename with typealiases + Intera coordination)
  → Tier 6 (S3 / bundle ID — only if product requires)
```

**Intera / Avila / Pismo items** should be treated as a **parallel track** — coordinate with the Intera platform team; do not fold into OnCuts rename without explicit product decision.

---

## Effort summary

| Tier | Scope | Effort | Ship independently? |
|------|-------|--------|---------------------|
| 0 | Comments, docs, dead exports | 1–2 hrs | Yes |
| 1 | Email typo, Swift variable rename | 30 min | Yes |
| 2 | localStorage migration monitoring | Ongoing | Yes |
| 3 | CORS, nginx, S3 | 2–4 hrs + ops | Needs DNS/infra |
| 4 | JWT + APN defaults | 30 min + wait | After audit |
| 5 | iOS module rename | 1–3 days | Needs Intera coordination |
| 6 | S3 bucket / bundle ID | 1–2 weeks | Major release |

---

## Quick reference: what to call things today

| Context | Use this name |
|---------|---------------|
| User-facing web, emails, legal | **OnCuts** |
| Production URL | **oncuts.com** |
| API JWT (new) | `oncuts-api` / `oncuts-client` |
| PM2 / Docker | `oncuts-*` |
| Swift package (code) | **CampusCutsModule** (legacy — rename in Tier 5) |
| iOS home screen | **OnCuts** (display name) |
| Embedded iOS host platform | **Intera** / **Avila Platforms** |
| Barber iOS app (App Store) | **InteraProvider** |
| Stripe Connect platform (live) | **Pismo Platforms** (per ops docs) |
| S3 images bucket (default) | **campuscut-images** (legacy infra) |
| APNs fallback bundle | **com.campuscuts.ios** (legacy default) |

---

*Generated from codebase audit, July 2026. Re-run ripgrep for `CampusCuts|campuscuts|campuscut|Intera|avilaplatforms` after major refactors to keep this doc current.*
