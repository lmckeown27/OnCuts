# OnCuts — How core credentials and infrastructure are used

*Audience: investors and partners. This summarizes **implementation** (what each piece does in the product), not variable names. Technical names and a fuller list live in [`API_KEYS.md`](./API_KEYS.md).*

---

## Why this matters

OnCuts separates **money** (Stripe), **identity** (JWT), **durability** (PostgreSQL, Redis), **media** (object storage), **mobile engagement** (Apple push), **customer communication** (email), and **optional treasury flows** (Bridge). Each is wired only on the **server** or in **managed cloud configuration**—not embedded in mobile or web bundles—so secrets stay out of client code paths.

---

## Stripe (card payments and payouts)

**Role in the product:** Customers pay for bookings with cards; barbers are paid through Stripe’s marketplace primitives (including Connect-style flows where applicable). Webhooks confirm payment success so bookings and downstream jobs stay in sync with what Stripe recorded.

**Implementation:** The API holds the **secret** keys and creates **PaymentIntents** (and related objects) server-side. A **publishable** key is exposed to clients only so Stripe’s official SDKs can collect card data in Stripe’s UI—the full card number never passes through OnCuts servers in the same way as raw PAN handling. **Webhook signing secrets** let the backend reject forged payment events. Mode (test vs live) is aligned with deployment so test cards never hit live financial reporting.

**Investor angle:** Standard, audit-friendly payment rail; reduced custom PCI scope versus building card storage in-house.

---

## Apple Push Notification (APN) credentials

**Role in the product:** Native iOS users receive timely notifications (for example booking reminders and operational updates) without keeping the app open.

**Implementation:** The server uses Apple’s **token-based APNs** model: a **private signing key** (.p8), **key identifier**, and **team identifier** authenticate outbound pushes. The **app bundle identifier** scopes pushes to the correct iOS app. Sandbox vs production gateways are handled so TestFlight and App Store builds both work when configured.

**Investor angle:** Supports retention and completion of time-sensitive bookings—table stakes for a serious consumer iOS app.

---

## Amazon S3 (images and media)

**Role in the product:** Profile photos, portfolio images, and similar assets are stored durably and served over HTTPS with long cache headers where appropriate.

**Implementation:** The backend uploads via the **AWS SDK** to a configured **bucket and region**. In typical production, **no long-lived access keys live in application configuration**: the compute host uses an **IAM instance role** so AWS rotates credentials automatically. That is a common security and operations best practice.

**Investor angle:** Predictable media costs, CDN-friendly URLs, and enterprise-grade object durability without custom file servers.

---

## SMTP (transactional email)

**Role in the product:** Account verification, booking confirmations, and other operational messages reach users in their inbox.

**Implementation:** The API sends mail through a standard **SMTP** provider (for example a transactional email service or secure mailbox) using **host, port, username, and password** (or app-specific password) supplied only in server environment configuration.

**Investor angle:** Reliable delivery channel for legally and operationally important communications, independent of push notifications.

---

## Bridge API (optional payout rail)

**Role in the product:** After card settlement, a portion of funds can be represented or moved in ways that involve **on-chain USDC** on **Sui** (barber vs platform split is encoded in the integration). This connects fiat settlement to treasury logic where the Bridge integration is enabled.

**Implementation:** When a **Bridge API key** is present, the server calls Bridge’s HTTP API with **Bearer** authentication to request payouts tied to booking and Stripe session references. If the key is absent, the code path can **log intent only** (dry run) so development and demos do not require live Bridge credentials. A **treasury address** on Sui is required for real splits.

**Investor angle:** Optional bridge between familiar card rails and digital-asset treasury design—useful for roadmap storytelling; production use depends on contract and compliance posture with the chosen provider.

---

## JWT (session signing)

**Role in the product:** After login (or equivalent), the client receives a signed token; every protected API call proves the same session without sending passwords repeatedly.

**Implementation:** The API signs tokens with a **server-only secret** and validates the `Authorization` header on protected routes. Refresh-token behavior can use a **separate secret** for additional rotation hygiene. Tokens are short-lived enough for mobile and web patterns while Redis/Postgres hold authoritative session and business state.

**Investor angle:** Stateless horizontal scaling for the API tier (any instance can verify a token) with a clear security boundary.

---

## Redis

**Role in the product:** Background work—such as **payout processing**—runs asynchronously so HTTP requests stay fast and retries are orderly.

**Implementation:** **BullMQ** connects to Redis using a single **connection URL** (which may include a password in hosted offerings). Queues define retries and backoff so transient failures do not lose financial jobs.

**Investor angle:** Standard pattern for reliable job processing at modest scale, with a clear upgrade path to managed Redis and multiple workers.

---

## PostgreSQL

**Role in the product:** System of record for users, barbers, bookings, messaging metadata, payment references, and operational state the product queries constantly.

**Implementation:** The API uses a **connection string** (`DATABASE_URL`) to a pooled **PostgreSQL** connection with production **TLS** expectations. **Prisma** manages schema evolution; many hot paths also use a shared **SQL pool** for performance-sensitive queries.

**Investor angle:** Mature relational model for reporting, integrity constraints, and marketplace queries—investors recognize PostgreSQL as a low–technical-risk datastore.

---

## At a glance

| Credential / connection | Primary product job | Where it runs |
|-------------------------|---------------------|---------------|
| **Stripe** (secret, publishable, webhook secret) | Card capture, settlement, Connect payouts, event reconciliation | API server only (publishable key exposed to clients for Stripe UI only) |
| **APN** (.p8 + Apple IDs) | iOS push notifications | API server |
| **S3 / AWS** (typically IAM role + bucket config) | Durable images and media | API server → AWS |
| **SMTP** | Transactional email | API server → mail provider |
| **Bridge** (API bearer key) | Optional fiat→treasury / USDC payout API | API server → Bridge |
| **JWT secret** | Session integrity for the API | API server only |
| **Redis URL** | Job queues (e.g. payouts) | API server + workers → Redis |
| **PostgreSQL URL** | Authoritative business data | API server → Postgres |

---

## Governance and disclosure

- Secrets are loaded from **environment** or **secrets managers** in deployment; they are not checked into source control in real environments.
- Third-party subprocessors (Stripe, AWS, email provider, Apple, Bridge when used) should appear in your **privacy policy** and vendor due-diligence materials.
- This document describes **technical wiring**; it is not legal, PCI, or investment advice.

---

*For engineering depth on every environment variable, see [`API_KEYS.md`](./API_KEYS.md). For the broader stack narrative, see [`INVESTOR_TECH_OVERVIEW.md`](./INVESTOR_TECH_OVERVIEW.md).*
