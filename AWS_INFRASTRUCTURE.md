# AWS Infrastructure Layout — OnCuts

**Purpose:** Map every AWS touchpoint before changing the repo or EC2 instance.  
**Scope:** AWS only (APN, Stripe, Firebase documented elsewhere).  
**Last updated:** July 2026

---

## 1. High-level layout

Production (documented in `POSTGRES_COMMANDS.md`, `server-nginx.conf`) runs on a **single EC2 instance** in the default VPC. The Node API calls **two AWS APIs** from that box; everything else on the server is self-hosted or third-party.

```
                         ┌─────────────────────────────────────┐
                         │           AWS Account               │
                         │                                     │
   Internet ────────────►│  Route 53 (likely — DNS for         │
                         │            oncuts.com)              │
                         │       │                             │
                         │       ▼                             │
                         │  ┌─────────────────────────────┐    │
                         │  │ EC2  ip-172-31-22-181       │    │
                         │  │  (default VPC, private IP   │    │
                         │  │   172.31.x.x)               │    │
                         │  │                             │    │
                         │  │  nginx :443 → :3001         │    │
                         │  │  PM2  oncuts-backend        │    │
                         │  │  PostgreSQL (local)         │    │
                         │  │  Redis (REDIS_URL)          │    │
                         │  │  /var/www/oncuts/dist       │    │
                         │  │  ~/OnCuts/backend/.env      │    │
                         │  │                             │    │
                         │  │  IAM Instance Profile ──────┼──┐ │
                         │  └─────────────────────────────┘  │ │
                         │                                     │ │
                         │  ┌──────────────┐  ┌───────────────▼┐ │
                         │  │ S3           │  │ End User       │ │
                         │  │ (images)     │  │ Messaging      │ │
                         │  │ us-west-1    │  │ (SMS OTP)      │ │
                         │  └──────────────┘  │ us-west-1      │ │
                         │                    └────────────────┘ │
                         └─────────────────────────────────────┘

NOT AWS (same EC2 or external):
  SMTP (email) · Let's Encrypt (TLS certs on nginx) · Apple APN · Firebase · Stripe
```

**Not used in code today:** RDS, ElastiCache, CloudFront, SES, SNS (mobile push), Lambda, ECR (prod uses PM2 + git pull, not Docker on EC2).

---

## 2. AWS services inventory

| AWS service | Used by app? | Region (code default) | Auth method | Status in prod `.env` |
|-------------|--------------|------------------------|-------------|-------------------------|
| **EC2** | Hosts entire stack | — | SSH | ✅ You are on `ip-172-31-22-181` |
| **VPC** | EC2 network | default VPC implied (`172.31.x.x`) | — | ✅ (implicit) |
| **IAM** | Instance profile for API calls | — | Role on EC2 | ✅ No `AWS_ACCESS_KEY_*` in `.env` (role expected) |
| **S3** | Portfolio / image storage | `us-west-1` | Instance role or env keys | ✅ `S3_BUCKET`, `S3_REGION` set |
| **End User Messaging** (Pinpoint SMS Voice v2) | OnCuts phone OTP | `us-west-1` (hardcoded) | Same as S3 | ⚠️ Partial — see §4 |
| **Route 53** | DNS (inferred) | — | Console | ❓ Not in repo; admin dashboard uses **hardcoded cost estimate** only |
| **Data transfer / S3 billing** | Egress + storage | — | — | Estimated in admin UI, not integrated |

---

## 3. Known production `.env` snapshot (AWS-related)

From your EC2 probe (`grep` on `~/OnCuts/backend/.env`):

| Variable | Present? | Notes |
|----------|----------|-------|
| `S3_BUCKET` | ✅ | Actual bucket name redacted in your paste |
| `S3_REGION` | ✅ | |
| `AWS_ACCESS_KEY_ID` | ❌ | Expected if using IAM role |
| `AWS_SECRET_ACCESS_KEY` | ❌ | Expected if using IAM role |
| `USE_S3` | ❌ not in grep | **Important** — see §5.1 |
| `S3_DELETE_LOCAL` | ❌ | Optional; keep local copies after S3 upload |
| `ONCUTS_SMS_NOTIFY_CONFIGURATION_ID` | ❌ | Falls back to code default (legacy `INTERA_*` accepted) |
| `ONCUTS_SMS_NOTIFY_TEMPLATE_ID` | ❌ | Falls back to `notify-code-verification-english-001` |
| `ONCUTS_SMS_NOTIFY_TEMPLATE_OTP_KEY` | ✅ | |
| `REDIS_URL` | ✅ | Not AWS unless you point it at ElastiCache |

PM2 does **not** inject these vars (`ecosystem.config.cjs` only sets `NODE_ENV`). The app loads `backend/.env` via **dotenv** at startup — so `pm2 env oncuts-backend | grep AWS` returning empty is **normal**.

---

## 4. Code paths — how AWS is called

### 4.1 S3 — image storage

| File | Behavior |
|------|----------|
| `backend/src/services/s3.service.ts` | `S3Client` — no explicit credentials (EC2 role chain) |
| `backend/src/controllers/barber.controller.ts` | Portfolio upload **always** calls `uploadToS3()` |
| `backend/src/services/image.service.ts` | Uploads to S3 only if `USE_S3=true` |
| `ios-module/.../CampusCutsS3ImageURL.swift` | Hardcoded host `campuscut-images.s3.amazonaws.com` (legacy name) |

**Env vars (code):**

| Variable | Default if unset | README / docker drift |
|----------|------------------|------------------------|
| `S3_BUCKET` | `campuscut-images` | README says `S3_BUCKET_NAME` ❌ |
| `S3_REGION` | `us-west-1` | README says `AWS_REGION` ❌ |
| `USE_S3` | off (`!== 'true'`) | Not documented in README |
| `S3_DELETE_LOCAL` | keep locals | Optional |

**Public URL pattern:**

```
https://{S3_BUCKET}.s3.{S3_REGION}.amazonaws.com/{key}
```

**IAM permissions needed (minimum):**

```json
{
  "Effect": "Allow",
  "Action": ["s3:PutObject", "s3:DeleteObject", "s3:GetObject"],
  "Resource": "arn:aws:s3:::YOUR_BUCKET/*"
}
```

Optional: `s3:ListBucket` on `arn:aws:s3:::YOUR_BUCKET` for debugging.

**Bucket policy:** Objects must be **publicly readable** (or you need CloudFront + OAI — not in repo today) because clients load images via direct S3 HTTPS URLs.

---

### 4.2 End User Messaging — SMS OTP (OnCuts)

| File | Behavior |
|------|----------|
| `backend/src/services/sms-otp/SmsProvider.ts` | `PinpointSMSVoiceV2Client`, `SendNotifyTextMessageCommand` |
| `backend/src/controllers/phone-otp.controller.ts` | `POST /api/v1/auth/request-otp`, `/verify-otp` |
| `backend/src/services/sms-otp/phone-otp.service.ts` | Stores OTP in **Redis** (`oncuts:sms_otp:{phone}`) |

**Region:** `us-west-1` — **hardcoded** in `SmsProvider.ts` (must match where Notify resources live).

**Env vars:**

| Variable | If unset |
|----------|----------|
| `ONCUTS_SMS_NOTIFY_CONFIGURATION_ID` | `notify-cb19ae925d014cdba7b540cca202f72d` (hardcoded default) |
| `ONCUTS_SMS_NOTIFY_TEMPLATE_ID` | `notify-code-verification-english-001` |
| `ONCUTS_SMS_NOTIFY_TEMPLATE_OTP_KEY` | `code` |

**IAM permission needed:**

```json
{
  "Effect": "Allow",
  "Action": "sms-voice:SendNotifyTextMessage",
  "Resource": "*"
}
```

(Tighten to your notify configuration ARN when you know it.)

**Dependency chain:** SMS requires **Redis** (`REDIS_URL`) for OTP storage — Redis failure = OTP endpoints fail even if AWS SMS works.

---

### 4.3 Admin dashboard — AWS cost **estimates only**

`backend/src/controllers/admin.controller.ts` → `calculateAwsCosts()` uses **fixed placeholder numbers**, not Cost Explorer or billing API:

| Line item | Hardcoded (cents/mo) |
|-----------|----------------------|
| EC2 | $72.42 |
| VPC | $6.72 |
| Route 53 | $2.53 |
| S3 / data transfer | Derived from booking counts |

This is **not** live AWS integration — do not use it as an inventory source.

---

## 5. Gaps & inconsistencies (factual — decisions pending)

### 5.1 Two different S3 code paths

| Path | Gated by `USE_S3`? |
|------|---------------------|
| `barber.controller` portfolio API | **No** — always S3 |
| `image.service` (profile, upload routes) | **Yes** — needs `USE_S3=true` |

If `USE_S3` is unset/false, portfolio may still hit S3 while other uploads stay local/nginx `/uploads`.

**Discovery on EC2:**

```bash
grep -E '^USE_S3=' ~/OnCuts/backend/.env
ls -la ~/OnCuts/backend/uploads 2>/dev/null | head
```

### 5.2 Documentation vs code env names

| Docs / docker-compose | Code actually reads |
|-----------------------|---------------------|
| `S3_BUCKET_NAME` | `S3_BUCKET` |
| `AWS_REGION` | `S3_REGION` |
| `AWS_ACCESS_KEY_ID` / `SECRET` | Optional; EC2 role preferred |

### 5.3 Legacy bucket name in clients

| Location | Bucket reference |
|----------|------------------|
| Code default | `campuscut-images` |
| Swift iOS module | `campuscut-images.s3.amazonaws.com` (no region in URL) |
| Your prod `.env` | `S3_BUCKET` set (unknown if still `campuscut-images`) |

If prod bucket ≠ `campuscut-images`, iOS hardcoded URLs may break for some images.

### 5.4 SMS defaults may not match your AWS account

Hardcoded `ONCUTS_SMS_NOTIFY_CONFIGURATION_ID` in repo may belong to a **different** AWS account or old setup. If prod `.env` omits it, the app uses the repo default — verify in AWS Console that ID exists in **your** account.

### 5.5 Duplicate / unused `.env` keys (from your grep)

- `APN_*` appeared **twice** — unrelated to AWS but worth cleaning on same pass
- Legacy `INTERA_*` env vars are accepted as fallbacks during migration

---

## 6. EC2 discovery checklist

Run on the instance. Paste results into the tables in §8 when filled in.

### 6.1 Identity & IAM role

**Note:** This instance requires **IMDSv2** (token header). Plain `curl` to `iam/info` returns empty.

```bash
TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")

curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/iam/info

curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/iam/security-credentials/

curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/instance-id

curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/instance-type

# Temporary creds JSON (AccessKeyId, Secret, Token — do not paste publicly)
curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/iam/security-credentials/EC2-S3-Access

# If AWS CLI installed:
aws sts get-caller-identity
```

### 6.2 S3

```bash
cd ~/OnCuts/backend
set -a && source .env && set +a

echo "Bucket: $S3_BUCKET  Region: $S3_REGION  USE_S3: ${USE_S3:-unset}"

aws s3 ls "s3://${S3_BUCKET}/" --region "${S3_REGION}" 2>&1 | head -10
aws s3api get-bucket-location --bucket "${S3_BUCKET}" 2>&1

# Public access / policy (needs s3:GetBucketPolicy)
aws s3api get-public-access-block --bucket "${S3_BUCKET}" 2>&1
```

### 6.3 SMS (End User Messaging)

```bash
aws pinpoint-sms-voice-v2 describe-notify-configurations --region us-west-1 \
  --query 'NotifyConfigurations[].{Id:NotifyConfigurationId,Status:Status}' --output table

aws pinpoint-sms-voice-v2 describe-notify-templates --region us-west-1 \
  --query 'NotifyTemplates[].{Id:TemplateId,Name:TemplateName}' --output table
```

Compare output IDs to what's in `.env` vs hardcoded defaults in `SmsProvider.ts`.

### 6.4 What runs on the box (non-AWS but affects AWS calls)

```bash
pm2 list
pm2 logs oncuts-backend --lines 50 --nostream | grep -iE 'S3|APN topic|Redis|PostgreSQL|Pinpoint|AWS'

sudo systemctl is-active nginx postgresql redis-server 2>/dev/null
ss -tlnp | grep -E '3001|5432|6379|80|443'
```

### 6.5 DNS (Route 53 or elsewhere)

From your **laptop** (not EC2):

```bash
dig +short oncuts.com A
dig +short oncuts.com NS
dig +short campuscuts.app A 2>/dev/null
```

If NS records are `awsdns-*`, DNS is Route 53. If Cloudflare or other, DNS is outside AWS.

---

## 7. AWS Console checklist (browser)

Use the same region **`us-west-1`** for S3 and SMS unless your `.env` says otherwise.

| Console area | What to record |
|--------------|----------------|
| **EC2 → Instances** | Instance ID, type, state, public IP, VPC, subnet, security groups |
| **EC2 → Instance → Security** | IAM role name → click through to role |
| **IAM → Roles → {role}** | Attached policies; confirm S3 + `sms-voice:SendNotifyTextMessage` |
| **S3 → Buckets** | Bucket name, region, public access settings, approximate size |
| **S3 → Bucket → Permissions** | Bucket policy (public read?), CORS if any |
| **End User Messaging / Pinpoint SMS** | Notify configurations + templates in us-west-1 |
| **Route 53 → Hosted zones** | Whether `oncuts.com` is hosted here |
| **Billing → Cost Explorer** | Filter: EC2, S3, Data Transfer, Pinpoint/SMS (last 30 days) |

---

## 8. Fill-in worksheet (your account)

**Discovered 2026-07-07** from EC2 `ip-172-31-22-181` (IMDSv2 required — plain `curl` to `iam/info` returns empty).

```
EC2
  Instance ID:              i-08c4d5d42164101b5
  Instance type:            t3.medium
  AWS account ID:           099296997760
  Public IP / Elastic IP:   (check EC2 console)
  IAM instance profile:     EC2-S3-Access
  IAM role name:            EC2-S3-Access
  Profile ARN:              arn:aws:iam::099296997760:instance-profile/EC2-S3-Access
  Availability zone:        (run metadata curl below)

S3
  Prod bucket name:         set in .env as S3_BUCKET (redacted)
  Region:                   set in .env as S3_REGION (redacted)
  USE_S3 in .env:           true ✅
  AWS CLI on instance:      not installed (apt install awscli)
  Approx object count/size:  pending (needs CLI or Console)
  Public read:              pending

SMS
  Notify configuration ID:  pending (Console or CLI from laptop)
  ID in .env:               unset → code default notify-cb19ae925d014cdba7b540cca202f72d
  ONCUTS_SMS_NOTIFY_TEMPLATE_OTP_KEY: set in .env ✅
  SMS on same IAM role?:    unknown — role name implies S3 only; verify policies
  SMS working in prod:      untested

DNS
  oncuts.com hosted in:     pending (dig NS from laptop)
  Legacy domains still DNS: pending

IAM role policies (summary):
  - S3:                     likely yes (role name EC2-S3-Access) — confirm in Console
  - sms-voice:              pending — may need policy add if OTP fails
  - other:                  pending
```

**Remaining metadata (run on EC2):**

```bash
TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")
curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/placement/availability-zone
curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
  http://169.254.169.254/latest/meta-data/public-ipv4
```

---

## 9. Open decisions (subjective — do after §6–8)

Use discovery results before changing anything.

| # | Question | Options |
|---|----------|---------|
| 1 | **Bucket name** | Keep `campuscut-images` vs rename to `oncuts-images` (+ client URL updates) |
| 2 | **S3 upload strategy** | Unify on `USE_S3=true` everywhere vs always-S3 in barber controller only |
| 3 | **Image delivery** | Direct public S3 URLs vs CloudFront CDN |
| 4 | **Credentials** | Keep EC2 IAM role (recommended) vs access keys in `.env` |
| 5 | **SMS config** | Move hardcoded notify ID to `.env` only; remove repo default |
| 6 | **Redis** | Stay local on EC2 vs ElastiCache |
| 7 | **Database** | Stay PostgreSQL on EC2 vs RDS |
| 8 | **DNS** | Consolidate legacy domains in Route 53 + nginx redirects |
| 9 | **Docs cleanup** | Align README/docker env names with `S3_BUCKET` / `S3_REGION` |
| 10 | **iOS S3 URLs** | Parameterize `CampusCutsS3ImageURL` from env/API vs hardcoded host |

---

## 10. Suggested order of work (AWS only)

1. **Discover** — complete §6–8 on EC2 + Console (no changes).
2. **Verify IAM** — role has S3 + SMS; test `aws s3 ls` and a dry-run OTP in staging.
3. **Verify S3 behavior** — confirm `USE_S3`, bucket name, public URLs load in browser.
4. **Verify SMS** — confirm notify configuration ID belongs to your account; test `request-otp`.
5. **Document decisions** — update this file §8 worksheet + tick choices in §9.
6. **Then** repo/instance changes (bucket rename, env cleanup, doc fixes) as separate PRs.

---

## 11. Related files in repo

| File | Relevance |
|------|-----------|
| `backend/src/services/s3.service.ts` | S3 client + URL builder |
| `backend/src/services/sms-otp/SmsProvider.ts` | SMS API |
| `backend/ecosystem.config.cjs` | PM2 (does not load AWS env) |
| `server-nginx.conf` | TLS + proxy; no S3/CloudFront |
| `POSTGRES_COMMANDS.md` | EC2 paths, Postgres on same host |
| `README.md` | Outdated AWS env var names |
| `docker-compose.production.yml` | `S3_BUCKET_NAME` drift |
| `BRAND_RENAME_AUDIT.md` | S3 bucket legacy naming context |

---

*After completing discovery, update §8 and note the date. Defer APN (`APN_*`), Stripe, and Firebase to a separate infra doc.*
