# Stripe integration — CampusCuts

This document describes **how Stripe is wired into the CampusCuts platform**: configuration, API surface, payment flows, webhooks, Connect onboarding, and the web client. For environment variable names, see [`API_KEYS.md`](./API_KEYS.md). For high-level investor copy, see [`INVESTOR_SECRETS_AND_INFRA.md`](./INVESTOR_SECRETS_AND_INFRA.md).

---

## 1. Role in the product

Stripe is the **primary card payment and payout rail**:

- **Consumers** pay for bookings with cards (and enabled wallet methods where Stripe supports them).
- **Barbers** receive funds through **Stripe Connect Express** accounts when configured, using **destination charges** or related Connect patterns on PaymentIntents.
- **Platform revenue** is taken as an **application fee** on the service portion of a charge (see §6).
- A **V2 Checkout** path can use **hosted Stripe Checkout** sessions so customers pay on Stripe’s pages; fulfillment is still driven by **webhooks** and Postgres updates.

The health endpoint reports `payment_provider: 'stripe'` and an off-chain architecture (`GET /health`).

---

## 2. Configuration (`backend/src/config/stripe.ts`)

All server-side Stripe SDK usage goes through centralized helpers:

| Concern | Behavior |
|--------|----------|
| **Secret API keys** | `STRIPE_SECRET_KEY` and/or split keys (`STRIPE_SECRET_KEY_LIVE` / `STRIPE_SECRET_KEY_TEST`, legacy alias names supported). `STRIPE_MODE` (`auto`, `test`, `live`) selects which key applies to normal API traffic. In `auto`, the resolver may consider other deployment env signals; there is logic so a **live** platform Stripe secret is not incorrectly paired with **test-only** keys when configuring mixed environments. |
| **Publishable keys** | `STRIPE_PUBLISHABLE_KEY` (and aliases) must be the **same Stripe account and mode** (`pk_live` / `pk_test`) as the default secret key. Exposed to clients via `GET /api/v1/stripe/client-config`. |
| **Webhooks** | `STRIPE_WEBHOOK_SECRET` plus optional `STRIPE_WEBHOOK_SECRET_LIVE` / `STRIPE_TEST_WEBHOOK_SECRET` variants; `constructStripeWebhookEvent` tries each secret so one HTTPS endpoint can serve test and live Dashboard endpoints. |
| **Per-event livemode** | `getStripeClientForLivemode` picks the correct secret when re-fetching objects after webhooks. |
| **Boot diagnostics** | Logs a safe fingerprint of the default secret key; warns if publishable key is missing or mismatched (common cause of **PaymentSheet 404** on iOS when `pk` and `sk` differ). |

The Stripe API version is pinned in code (`STRIPE_API_VERSION` in `stripe.ts`).

---

## 3. Express middleware and webhook wiring

**Critical:** Stripe webhook signature verification requires the **raw** request body.

In `backend/src/index.ts`:

1. `app.use('/api/webhooks', express.raw({ type: 'application/json' }), webhookRoutes);` is registered **before** `express.json()`.
2. All other routes use JSON parsing as usual.

The active Stripe webhook route is:

- **`POST /api/webhooks/stripe`** → `handleStripeWebhookSecure` (`stripe-webhook-secure.controller.ts`).

> **Note:** `stripe-webhook.routes.ts` still points at the older **enhanced** handler but is **not** mounted from `index.ts`. Production behavior is defined by `routes/webhook.routes.ts`.

---

## 4. HTTP API surface (Stripe-related)

| Area | Base path | Auth | Purpose |
|------|-----------|------|---------|
| **Public client config** | `GET /api/v1/stripe/client-config` | None | Returns `publishableKey` + `publishableKeyPrefix` for native apps and tooling so PaymentSheet / Elements use the same account/mode as the server. |
| **Barber Connect** | `/api/v1/barber/...` and legacy `/api/barber/...` | JWT + barber role | Create Connect account, onboarding/refresh links, return handler, Express **dashboard login** link, payout status/summary. See `barber-connect.routes.ts`. |
| **Booking payments (legacy / alternate)** | `/api/v1/bookings` via `bookingPaymentRoutes` | Varies by route | Uses `stripe.service` patterns (e.g. PaymentIntents with **manual capture** in some flows). |
| **Bookings “simple”** | `POST /api/v1/bookings-simple/:id/create-payment-intent` | JWT (consumer) | Creates a **PaymentIntent** with `automatic_payment_methods`, Connect **destination** + **application_fee** when `users.stripe_account_id` is set; booking and fee metadata; optional tips. |
| **Payments module** | `/api/v1/payments` | Per route | `payment.routes.ts` / `payment.controller.ts` / `stripe-payment.service.ts` for PaymentIntent-style operations. |
| **Wallet V2** | `/api/v2/wallet` | Per route | Deposit intents and related helpers (see `wallet-v2` routes). |
| **Bookings V2** | `/api/v2/bookings` | Per route | **Checkout Session** creation for hosted booking checkout (`booking-v2.controller.ts`, `payment-v2.service.ts`). |
| **Webhooks** | `POST /api/webhooks/stripe` | Stripe signature | Secure handler: signature verification, idempotency, booking/payment rows in Postgres. |

Nginx (or any reverse proxy) must forward **`Authorization`** to Node for authenticated payment routes (see historical production notes in repo).

---

## 5. Payment flows

### 5.1 Simple booking — PaymentIntent + Connect (`booking-simple.routes.ts`)

Used for the common path: consumer pays after a booking is **ACCEPTED** or **COMPLETED**.

1. **Auth:** Bearer JWT; user must be the booking’s consumer.
2. **Amount:** `priceUsdCents` + optional `tipAmountCents` from the body.
3. **Connect:** If the barber’s user row has `stripe_account_id`, the PaymentIntent includes:
   - `transfer_data.destination` = Connect account  
   - `application_fee_amount` = **15% of the service subtotal only** (not tips).
4. **Metadata:** `booking_id`, `consumer_id`, `barber_id`, `barber_user_id`, `service_name`, `tip_amount_cents`, `platform_fee_cents`, etc. (snake_case).
5. **Receipts:** `receipt_email` may be set from the consumer’s email; **`customer` is intentionally omitted** on the PaymentIntent so native **PaymentSheet** does not require an ephemeral key for saved payment methods.
6. **Response:** Client receives `client_secret` and related fields for Stripe SDK confirmation.

The service may run a **publishable-key probe** against the PaymentIntent to log misconfiguration (404 when `pk`/`sk` accounts differ).

### 5.2 Core Stripe service (`stripe.service.ts`)

Shared primitives used by Connect and booking controllers:

- **PaymentIntents** with `payment_method_types: ['card']` and **`capture_method: 'manual'`** for flows that authorize first and capture later.
- **Capture** and **refund** helpers.
- **Customers.create** for users when you explicitly want Stripe Customer objects.
- **Connect Express** `accounts.create`, `accountLinks.create`, **transfers.create** (with optional `source_transaction`), plus **retry** logic if test/live API keys disagree with the connected account’s mode.

### 5.3 Payment service V2 (`payment-v2.service.ts`)

Supports:

1. **`createBookingPaymentIntent`** — Card-only PaymentIntent; if Connect is present, sets `transfer_data` + `application_fee_amount` (same **15%** fee pattern on the PI amount).
2. **`createBookingCheckoutSession`** — **Stripe Checkout** `mode: 'payment'` with booking metadata (ids, consumer, barber). Used for **V2 booking checkout** that completes in Stripe’s hosted UI; **webhooks** finalize paid state in Postgres. *(Implementation detail: the service may try broader `payment_method_types` and fall back to card-only if Stripe rejects the session—production should align Dashboard and code with **card-only** policy if required.)*

### 5.4 Controllers and entrypoints

- **`booking-payment.controller.ts`** — Delegates to `stripeService.createPaymentIntent` for integrated booking payment flows.
- **`payment.controller.ts`** — Uses `stripePaymentService.createPaymentIntent`.
- **`booking-v2.controller.ts`** — Creates Checkout sessions, persists `stripe_checkout_session_id` on the booking, returns `checkoutUrl`.

---

## 6. Platform fee

Multiple layers use a **~15% platform fee on the service amount** (comments reference covering Stripe processing and netting ~11% to the platform). Exact constants live next to each flow (e.g. `PLATFORM_FEE_PERCENTAGE = 0.15` in `booking-simple.routes.ts` and webhook secure controller; `PLATFORM_FEE_RATE` in `payment-v2.service.ts`). **`payment.service.ts`** also references `STRIPE_PLATFORM_FEE_PERCENT` for other payment-mode logic—**confirm which path your product surface uses** so fee disclosure stays consistent.

**Tips:** In the simple booking PaymentIntent path, the fee is applied **only to the haircut/service line**, not to tips.

---

## 7. Webhooks — secure handler (`stripe-webhook-secure.controller.ts`)

**Endpoint:** `POST /api/webhooks/stripe`

**Properties:**

1. **Signature required** — Rejects if `STRIPE_WEBHOOK_SECRET*` is not configured (unlike the enhanced handler’s dev bypass).
2. **Idempotency** — `stripe_webhook_events` table stores `event_id`; duplicates short-circuit.
3. **Post-verification** — For `payment_intent.succeeded`, optionally re-retrieves the PaymentIntent with `getStripeClientForLivemode` and checks amount/status.
4. **Transactions** — Critical booking updates run inside SQL transactions where applicable.

**Handled event types (non-exhaustive for “interesting” ones):**

| Event | Purpose |
|-------|---------|
| `checkout.session.completed` | Marks booking **paid / COMPLETED**, writes `payments` row, may archive/delete conversation messages tied to the booking. |
| `payment_intent.succeeded` | Completes booking payment in the database when the Checkout path has **not** already finalized the same payment (the handler skips duplicate work when session-level metadata indicates the Checkout handler owns fulfillment). |
| `payment_intent.payment_failed` | Failure handling / logging. |
| `transfer.created` / `transfer.updated` | Connect transfer telemetry; failed transfers handled. |
| `account.updated` | Persists Connect onboarding/charges status for barbers. |

Configure the **same URL** in the Stripe Dashboard for both test and live if you use split webhook secrets.

---

## 8. Stripe Connect (barbers)

**Flow:**

1. `POST /api/v1/barber/connect/create` — Creates an **Express** connected account (`stripeService.createConnectedAccount`), stores `users.stripe_account_id`.
2. **Account Links** — Onboarding and refresh URLs use `FRONTEND_URL` + `/web/barber/connect/refresh` and `/return`.
3. `GET /api/v1/barber/connect/status` — Surface onboarding state to the app.
4. `GET /api/v1/barber/connect/dashboard` — Creates a **login link** to the Express dashboard for payout/bank management.

**UI:** Web barber surfaces (`PaymentManagementModal`, `BarberEarningsPage`, `BarberConnectOnboarding`) explain that payouts are via **Connect**, not a CampusCuts-held balance.

---

## 9. Web application (`web-app/`)

- **Publishable key:** `web-app/src/config/constants.ts` resolves `STRIPE_PUBLIC_KEY` from `VITE_STRIPE_PUBLISHABLE_KEY` and related `VITE_*` names for the web bundle.
- **Stripe.js:** `@stripe/stripe-js` and `@stripe/react-stripe-js` (see `package.json`) for Elements-style flows where used.
- **Copy / legal:** Terms reference Stripe as the processor; barber pages describe Connect payouts.

The **backend** must still return a publishable key consistent with `STRIPE_SECRET_KEY` for **native** clients that call `create-payment-intent` and PaymentSheet.

---

## 10. Operational checklist

1. **Dashboard:** Same Stripe account for `sk_*`, `pk_*`, webhook endpoint, and Connect applications.
2. **Webhook URL:** `https://<your-api-host>/api/webhooks/stripe` — raw body, no JSON middleware in front.
3. **Events:** Enable at least: `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `account.updated`, and transfer events you rely on.
4. **Connect:** Complete Stripe Connect platform onboarding in Dashboard; test Express accounts in test mode.
5. **Metadata:** Keep `booking_id` (and consumer/barber ids) consistent so webhooks can idempotently update Postgres.
6. **Migrations:** Schema support includes webhook idempotency / Connect status (e.g. `010_stripe_webhook_idempotency.sql`, `016_stripe_connect_status.sql`).

---

## 11. Source file map

| File | Responsibility |
|------|----------------|
| `backend/src/config/stripe.ts` | Keys, clients, webhook verification, client-config payload, diagnostics |
| `backend/src/services/stripe.service.ts` | PaymentIntents, customers, Connect accounts/links, transfers, refunds |
| `backend/src/services/stripe-payment.service.ts` | Payment-intent orchestration for payments routes |
| `backend/src/services/payment-v2.service.ts` | V2 PaymentIntents + Checkout Sessions |
| `backend/src/services/stripe-connect.service.ts` | Connect-oriented helpers |
| `backend/src/routes/public-stripe.routes.ts` | `GET .../stripe/client-config` |
| `backend/src/routes/webhook.routes.ts` | **Production** `POST .../stripe` |
| `backend/src/controllers/stripe-webhook-secure.controller.ts` | **Production** webhook logic |
| `backend/src/controllers/stripe-webhook-enhanced.controller.ts` | Alternate handler (not mounted by default) |
| `backend/src/routes/booking-simple.routes.ts` | `create-payment-intent` |
| `backend/src/routes/barber-connect.routes.ts` | Connect REST surface |
| `backend/src/controllers/booking-v2.controller.ts` | Checkout session creation |
| `web-app/src/config/constants.ts` | Vite Stripe publishable key resolution |

---

## 12. Out of scope for this doc

- **Stripe Dashboard** pricing, tax, Radar, or Connect pricing tables — use Stripe’s docs and contracts.
- **PCI SAQ** level — depends on integration pattern; Elements / Checkout / PaymentSheet reduce raw PAN exposure.

---

*Last updated to reflect a Stripe-only product narrative; some legacy files in the repo may still contain unused settlement hooks—treat this document as the source of truth for **intended** payment behavior.*
