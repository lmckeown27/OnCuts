# API keys and secrets reference

This document describes **environment-driven keys and secrets** the CampusCuts stack reads at runtime, what they are for, and where they are defined. It is derived from `backend/src`, `web-app/src`, `backend/env.example`, and `web-app/.env.example`.

**Convention**

- **Secret**: must never ship to browsers or mobile clients; keep only on the API server (`.env`, PM2 `env`, secrets manager).
- **Public / client-safe**: may appear in Vite `VITE_*` vars (bundled into the web app) or in Google’s OAuth client IDs; still treat as configuration, not as authorization by itself.

Copy variables from `backend/env.example` and `web-app/.env.example` when bootstrapping a new environment.

---

## Where values are loaded

| Surface | File / mechanism | Notes |
|--------|------------------|--------|
| API (Node) | `backend/.env`, PM2 `ecosystem` env, shell | `dotenv` in `backend/src/index.ts`; production should set `NODE_ENV=production` explicitly for PM2. |
| Web (Vite) | `web-app/.env`, `web-app/.env.production` | Only variables prefixed with `VITE_` are exposed to the browser bundle. |
| AWS S3 | EC2 instance profile (preferred) | `s3.service.ts` does not read `AWS_ACCESS_KEY_ID` in code; IAM role supplies credentials. |

---

## 1. Authentication and sessions

| Variable | Kind | Use case |
|----------|------|----------|
| `JWT_SECRET` | Secret | Signs and verifies access JWTs (`auth.middleware`, `auth.controller`). |
| `JWT_REFRESH_SECRET` | Secret | Optional; refresh tokens fall back to `JWT_SECRET` if unset. |
| `GOOGLE_OAUTH_WEB_CLIENT_ID` | Public ID (still server-trusted config) | zkLogin / Google token audience checks (`zklogin.controller`, `auth.controller`). Must match the web client used for implicit flow. |
| `GOOGLE_OAUTH_IOS_CLIENT_ID` | Public ID | Allowed Google `aud` values for native iOS tokens (`auth.controller`). |
| `GOOGLE_OAUTH_CLIENT_IDS` | Public IDs (comma-separated) | Extra allowed client IDs for Google-issued ID tokens. |
| `VITE_GOOGLE_OAUTH_CLIENT_ID` | Public (web bundle) | Frontend OAuth client; backend also accepts this name when building the allowlist (`auth.controller`). **Set the same web client ID as `GOOGLE_OAUTH_WEB_CLIENT_ID` where both are used.** |
| `APPLE_CLIENT_ID` | Public ID (still server-trusted config) | iOS bundle ID or Sign in with Apple **Services ID**; must match the `aud` claim when verifying Apple `identityToken` on `POST /api/v1/auth/apple` (`apple-auth.service`, `auth.controller`). **Postgres:** add `users.apple_sub` / `users.auth_provider` by applying `backend/src/database/migrations/026_apple_oauth_users.sql` on the API database (from `backend/`: `npm run migrate:sql -- 026`; requires `DATABASE_URL` in `backend/.env` or the shell — the script loads env before connecting). |

**Web (`web-app`)**: `VITE_GOOGLE_OAUTH_CLIENT_ID`, optional `VITE_ZKLOGIN_REDIRECT_ORIGIN` — see `web-app/.env.example`.

---

## 2. Stripe (card payments, Connect, webhooks)

Resolved mainly in `backend/src/config/stripe.ts` and used by booking/payment routes and `stripe.service.ts`.

| Variable | Kind | Use case |
|----------|------|----------|
| `STRIPE_SECRET_KEY` | Secret | Default Restricted or standard **secret** key (`sk_test_*` / `sk_live_*`). |
| `STRIPE_SECRET_KEY_LIVE` / `STRIPE_LIVE_SECRET_KEY` | Secret | Explicit **live** secret when splitting test vs live. |
| `STRIPE_SECRET_KEY_TEST` / `STRIPE_TEST_SECRET_KEY` | Secret | Explicit **test** secret. |
| `STRIPE_MODE` | Config | `auto` (default), `test`, or `live` — chooses which secret key applies to API traffic; interacts with `APP_NETWORK_MODE` (Sui testnet vs mainnet) with special handling so fiat live keys are not swapped for test keys by mistake. |
| `STRIPE_PUBLISHABLE_KEY` | Public (`pk_*`) | Returned to clients (e.g. `GET /api/v1/stripe/client-config`, payment flows) so **native** Stripe SDKs match the server’s account/mode. Aliases: `STRIPE_PUBLIC_KEY`, `STRIPE_PUBLISHABLE_KEY_LIVE`, `STRIPE_LIVE_PUBLISHABLE_KEY`, `STRIPE_PUBLISHABLE_KEY_TEST`, `STRIPE_TEST_PUBLISHABLE_KEY`. |
| `STRIPE_STATEMENT_DESCRIPTOR` | Config (5–22 chars, public on statements) | Optional. **Card/bank statement** line for PaymentIntents via `getOptionalStatementDescriptor()` in `config/stripe.ts`. Does not replace Dashboard business name on **receipt emails**—set your legal/DBA name in Stripe **Settings → Business / public details** as well. |
| `STRIPE_WEBHOOK_SECRET` | Secret | Stripe webhook signature verification (`constructStripeWebhookEvent`). |
| `STRIPE_WEBHOOK_SECRET_LIVE` / `STRIPE_LIVE_WEBHOOK_SECRET` | Secret | Additional live signing secret when one HTTPS endpoint serves both dashboards. |
| `STRIPE_WEBHOOK_SECRET_TEST` / `STRIPE_TEST_WEBHOOK_SECRET` | Secret | Test webhook signing secret. |

**Web**: `VITE_STRIPE_PUBLISHABLE_KEY` (and fallbacks in `web-app/src/config/constants.ts`: `VITE_STRIPE_PUBLIC_KEY`, live/test-specific names) for Stripe.js / Elements — **must be the same Stripe mode and account** as the backend secret key.

**Related non-key config**: `STRIPE_PLATFORM_FEE_PERCENT` (default `5.0`) in `payment.service.ts`; `PLATFORM_FEE_PERCENTAGE` in `env.example` may overlap conceptually — confirm which your deployment reads.

---

## 3. Circle (USDC / programmable wallets)

Used in `backend/src/services/usdc.service.ts`.

| Variable | Kind | Use case |
|----------|------|----------|
| `CIRCLE_API_KEY` | Secret | Production Circle API key. |
| `CIRCLE_TEST_API_KEY` | Secret | If set, preferred over `CIRCLE_API_KEY` for test flows (code logs key type). |
| `CIRCLE_API_URL` | URL | API base (default sandbox URL in code). |
| `CIRCLE_WALLET_SET_ID` | Identifier | Wallet set for Circle wallet APIs / scripts. |
| `CIRCLE_WALLET_ID` | Identifier | Listed in `env.example` for wallet operations. |
| `CIRCLE_BLOCKCHAIN` | Config | e.g. `MATIC-AMOY` default in service. |
| `CIRCLE_TOKEN_ID` | Config | Token identifier default `usdc-testnet`. |

---

## 4. Sui blockchain and gas

| Variable | Kind | Use case |
|----------|------|----------|
| `APP_NETWORK_MODE` / `SUI_NETWORK` | Config | `testnet` / `mainnet` / etc.; drives defaults for RPC and USDC coin type (`app-network.ts`). |
| `SUI_RPC_URL` | URL (non-secret) | RPC endpoint for chain queries, relayer, health checks. |
| `SUI_USDC_COIN_TYPE` | On-chain type string | USDC package::module::struct for the active network. |
| `SUI_PACKAGE_ID` | Address | Module/package for sync logic (`blockchain-sync.service.ts`). |
| `SUI_TREASURY_ADDRESS` | Address | Treasury / platform addresses for payouts, gas estimator, bridge. |
| `SUI_PLATFORM_ADDRESS` | Address | Platform address fallback (`sui-chain.service.ts`). |
| `SUI_PLATFORM_PAYOUT_ADDRESS` | Address | Payout destination (`sui-relayer.service.ts`). |
| `SUI_TREASURY_SECRET` / `SUI_TREASURY_SIGNER_SECRET` | Secret | Key material for signing treasury/relayer transactions (`sui-relayer`, `sui-gas-sponsor`). |
| `GAS_SPONSOR_SECRET` | Secret | Gas sponsorship signing (`sui-gas-sponsor.service.ts`). |
| `SUI_GAS_WALLET_ADDRESS` / `GAS_WALLET_ADDRESS` | Address | Monitored / funded gas wallet. |
| `SUI_SPONSOR_API_URL` / `SUI_SPONSOR_API_KEY` | URL + secret | External transaction sponsor API (`sui-external-sponsor.service.ts`). |
| `SUI_DIY_RELAYER_ENABLED` | Flag | Enables DIY relayer paths in `index.ts` / webhooks. |

**Web**: `VITE_APP_NETWORK_MODE`, `VITE_SUI_RPC_URL`, `VITE_SUI_USDC_COIN_TYPE`, `VITE_SUI_PROVER_URL`, `VITE_SUI_ZKLOGIN_PROVER_URL`, `VITE_SUI_EXPLORER_BASE_URL` — must stay consistent with backend network and coin type.

---

## 5. Push notifications

### Apple (APNs)

From `pushNotification.service.ts`.

| Variable | Kind | Use case |
|----------|------|----------|
| `APN_KEY_ID` / `APN_TEAM_ID` | Apple credentials | JWT auth to APNs. |
| `APN_PRIVATE_KEY` | Secret (.p8 PEM or path) | Signs APNs auth tokens. |
| `APN_SANDBOX_KEY_ID` / `APN_SANDBOX_PRIVATE_KEY` | Secret | Optional separate key for sandbox gateway. |
| `APN_BUNDLE_ID` | Config | Push topic (defaults to `com.campuscuts.ios`). |

### Firebase (FCM / service account)

| Variable | Kind | Use case |
|----------|------|----------|
| `FIREBASE_SERVICE_ACCOUNT` | Secret (JSON string) | Full service account JSON for Admin SDK in `pushNotification.service.ts`. |
| `FIREBASE_PROJECT_ID` / `FIREBASE_PRIVATE_KEY` / `FIREBASE_CLIENT_EMAIL` | Secret | Alternate split env vars for `notification.service.ts`. |

---

## 6. IPFS / Pinata

`ipfs.service.ts` (when `USE_IPFS=true`).

| Variable | Kind | Use case |
|----------|------|----------|
| `PINATA_API_KEY` | Secret | Pinata REST API key. |
| `PINATA_API_SECRET` | Secret | Pinata **secret** (in code; `backend/env.example` also mentions `PINATA_SECRET_API_KEY` / `PINATA_JWT` — align names with Pinata’s dashboard and with `PINATA_API_SECRET` as implemented). |
| `IPFS_NODE_URL` | URL | Local IPFS HTTP API (default `http://localhost:5001`). |
| `USE_IPFS` | Flag | Turns IPFS-backed upload paths on in upload routes. |

---

## 7. Object storage (AWS S3)

`backend/src/services/s3.service.ts`.

| Variable | Kind | Use case |
|----------|------|----------|
| `S3_BUCKET` | Config | Bucket name (default `campuscut-images`). |
| `S3_REGION` | Config | Region (default `us-west-1`). |

**Credentials**: SDK uses the default provider chain (e.g. **EC2 instance role**). No access key env vars are required in application code.

---

## 8. Email (SMTP)

`email.service.ts` — these are **account credentials**, not third-party “API products”, but they behave like secrets.

| Variable | Use case |
|----------|----------|
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Outbound mail (verification, notifications). |
| `AUTO_VERIFY_EMAILS` | Dev-style bypass when `true`. |

---

## 9. Google Calendar OAuth

`google-calendar.service.ts`.

| Variable | Kind | Use case |
|----------|------|----------|
| `GOOGLE_CALENDAR_CLIENT_ID` | OAuth client ID | Calendar OAuth app. |
| `GOOGLE_CALENDAR_CLIENT_SECRET` | Secret | Server-side OAuth exchange. |
| `GOOGLE_CALENDAR_REDIRECT_URI` | URL | Callback URL (default includes `/api/v1/auth/google-calendar/callback`). |

---

## 10. Intera (SMS / notify templates)

`backend/src/services/intera/SmsProvider.ts`, `phone-otp.service.ts`.

| Variable | Use case |
|----------|----------|
| `INTERA_NOTIFY_CONFIGURATION_ID` | Notify / SMS configuration id (has code default if unset). |
| `INTERA_NOTIFY_TEMPLATE_ID` | Template for outbound messages. |
| `INTERA_NOTIFY_TEMPLATE_OTP_KEY` | Template placeholder key for OTP body. |
| `INTERA_OTP_TTL_SECONDS` | OTP time-to-live override. |

---

## 11. Bridge payouts (optional integration)

`bridge-payout.service.ts`.

| Variable | Kind | Use case |
|----------|------|----------|
| `BRIDGE_API_KEY` | Secret | Authenticates to bridge API. |
| `BRIDGE_API_BASE_URL` | URL | API base (placeholder default in code). |

---

## 12. Cryptography and internal secrets

| Variable | Kind | Use case |
|----------|------|----------|
| `CUSTODIAL_ENCRYPTION_SECRET` | Secret | Custodial key encryption (`verify-integration` script documents this). |
| `MASTER_SEED` / `SALT_SERVICE_SECRET` | Secret | Salt derivation (`salt.service.ts`). |
| `ENCRYPTION_KEY` | Secret | Used in tests (`tests/setup.ts`); confirm production name with your deployment. |

---

## 13. Operations and monitoring

| Variable | Use case |
|----------|----------|
| `SLACK_WEBHOOK_URL` | Gas wallet / ops alerts (`gas-wallet-monitor.service.ts`). |
| `ADMIN_EMAIL`, `ADMIN_PHONE` | Alert recipients. |
| `DATABASE_URL` | PostgreSQL connection string (often includes user/password). |
| `REDIS_URL` | Redis for Bull/queues (may include password). |

---

## 14. Documented but unused in current TypeScript tree

- **`WHOIS_API_KEY`**: Present in `backend/env.example` only; no matches under `backend/src` for `WHOIS` — confirm before relying on it.
- **Aptos block** in `backend/env.example` (`APTOS_*`, `PETRA_PRIVATE_KEY`, etc.): No references in `backend/src` `.ts` files; the running API paths in this repo center on **Sui** + Stripe. Treat Aptos vars as legacy documentation unless a separate service still consumes them.

---

## Quick checklist for production

1. **Stripe**: Matching `sk_*` + `pk_*` + webhook `whsec_*` for the same Dashboard mode; set `STRIPE_PUBLISHABLE_KEY` on the server for native `client-config` / PaymentSheet alignment.
2. **JWT**: Strong unique `JWT_SECRET` (and optional `JWT_REFRESH_SECRET`).
3. **Google**: Web + iOS client IDs consistent between Vite, backend allowlist, and Google Cloud Console.
4. **Push**: Valid APNs `.p8` + team/key id; Firebase JSON or split Firebase vars for Android.
5. **S3**: IAM role on the host with `s3:PutObject` / `DeleteObject` on the configured bucket.
6. **Reverse proxy**: Forward `Authorization` to Node so JWT-protected routes (e.g. payment intent) receive the Bearer token.

For variable names and comments as checked into the repo, prefer **`backend/env.example`** and **`web-app/.env.example`** as the source templates; this file explains **usage**, not every default value.
