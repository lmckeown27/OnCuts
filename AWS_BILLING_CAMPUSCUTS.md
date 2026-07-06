# OnCuts — Where AWS invoice charges come from

This document explains how **Amazon Web Services** line items on a typical bill relate to the OnCuts platform (API, web traffic, DNS, domains, storage). It is based on a sample invoice structure (total **USD 121.42**) and the architecture described in this repository (`server-nginx.conf` on EC2, Node/PM2 backend, S3 image uploads, public DNS).

**Important:** Dollar amounts on *your* invoice will vary with usage, region, instance size, and days in the billing period. Treat the figures below as **an example breakdown**, not a forecast.

---

## Example invoice summary

| AWS service (as shown on bill) | Example charge (USD) | Role for OnCuts |
|--------------------------------|----------------------|----------------------|
| **Amazon Elastic Compute Cloud (EC2)** | 93.74 | Runs the production stack: API (Node/Express), process manager (e.g. PM2), reverse proxy (nginx), and real-time services (e.g. Socket.IO). This is usually the largest line item. |
| **Amazon Registrar** | 15.00 | **Domain registration/renewal** for the public site and API host (e.g. `campuscut.com`). Billed per domain and term, not per booking. |
| **Amazon Virtual Private Cloud (VPC)** | 9.61 | **Networking** around the EC2 instance: isolated network, routing, and often **NAT Gateway** or similar egress paths, **Elastic IPs**, or other VPC-attached resources. Supports secure inbound HTTPS and outbound calls (Stripe, SMTP, Apple Push, etc.). |
| **Amazon Route 53** | 3.05 | **DNS**: hosted zone(s), queries, and health checks so browsers and apps resolve the API and website to the correct AWS endpoints. |
| **AWS Data Transfer** | 0.02 | **Traffic leaving** AWS regions or crossing certain boundaries (API JSON, small assets, webhooks). Often small if most heavy media is served from S3 with efficient caching or CloudFront is billed separately. |
| **Amazon Simple Storage Service (S3)** | 0.00 | **Object storage** for images (e.g. barber portfolios) via `backend` S3 integration. A **zero** line can mean free tier, very low request/storage volume this period, or charges appearing under a different linked account or service. |
| **AWS Key Management Service (KMS)** | 0.00 | **Encryption keys** (optional). OnCuts may use keys managed by other services (e.g. S3 SSE-S3) without separate KMS usage, or usage is below reporting threshold. |
| **AWS Glue** | 0.00 | **ETL / data catalog** service. Not part of the core OnCuts app path in this repo; often **no usage** unless you added separate analytics pipelines in the same AWS account. |

**Example total:** USD 121.42 (sum of the non-zero lines above in this sample).

---

## How this maps to the product (non-technical)

1. **EC2** — “The server that runs OnCuts” for customers and barbers: bookings, messaging, payments orchestration, push triggers, etc.
2. **Registrar** — Paying to **own and keep** the brand’s domain name on the internet.
3. **VPC** — The **private network plumbing** so that server can talk to the internet and other AWS pieces safely.
4. **Route 53** — The **phone book** that turns `campuscut.com` into the server’s address.
5. **Data transfer** — **Bits moving out** of AWS (responses to users, server-to-server calls where egress applies).
6. **S3** — **Photo and file storage** for the marketplace UI; cost scales with storage and requests when usage grows.

---

## What is *not* on this AWS bill (but still costs money)

OnCuts relies on services **outside** AWS that appear on **other** invoices:

| Capability | Typical vendor (not AWS EC2 line item) |
|------------|----------------------------------------|
| Card payments | **Stripe** |
| Email delivery | **SMTP / transactional email** (may be Gmail, SendGrid, etc.) |
| Database | **PostgreSQL** (often RDS, Supabase, Railway, or managed elsewhere—if not on EC2) |
| Job queue / cache | **Redis** (ElastiCache, Upstash, or self-hosted) |
| Apple push | **Apple Developer** program + APNs (no AWS line for the push payload itself) |

PostgreSQL and Redis are in **docker-compose** for local/dev; production may be the same EC2 (Docker) or separate providers—only components **in this AWS account** show on the AWS invoice.

---

## Cost optimization ideas (for operators)

- **EC2:** Right-size the instance; use Reserved Instances or Savings Plans if load is stable.
- **VPC:** Review **NAT Gateway** usage (a common VPC cost driver); consolidate egress or use VPC endpoints for AWS APIs where it makes sense.
- **Route 53:** Minimize unnecessary health checks and extra hosted zones.
- **S3:** Lifecycle rules for old media; consider **CloudFront** in front of S3 for cheaper egress to users (CloudFront would appear as its own line item when enabled).
- **Registrar:** Domains renew annually; plan renewals in finance calendars.

---

## Related documentation

- [`INVESTOR_SECRETS_AND_INFRA.md`](./INVESTOR_SECRETS_AND_INFRA.md) — How Stripe, JWT, S3 credentials, etc., are used in the product.
- [`TECH_STACK.md`](./TECH_STACK.md) — Libraries and services in the monorepo.
- [`server-nginx.conf`](./server-nginx.conf) — Example nginx placement on EC2.

---

*This document is for internal finance and engineering alignment. It is not tax, accounting, or legal advice. Use the AWS Billing Management Console and Cost Explorer for authoritative allocation and tags.*
