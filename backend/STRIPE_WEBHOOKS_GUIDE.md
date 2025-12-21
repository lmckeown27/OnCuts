# 🔔 Stripe Webhooks Setup Guide

## Overview

This guide explains how to set up and test Stripe webhooks for real-time payment processing in CampusCuts.

---

## 📋 Table of Contents

1. [What Are Webhooks?](#what-are-webhooks)
2. [Events We Handle](#events-we-handle)
3. [Local Development Setup](#local-development-setup)
4. [Production Setup](#production-setup)
5. [Database Setup](#database-setup)
6. [Testing Webhooks](#testing-webhooks)
7. [Troubleshooting](#troubleshooting)

---

## 🎯 What Are Webhooks?

Webhooks are **real-time notifications** from Stripe when events occur (payments succeed, fail, refunds, etc.). Without webhooks, you'd need to poll Stripe constantly to check payment status.

### Why We Need Them

- ✅ **Real-time updates**: Know instantly when payments succeed/fail
- ✅ **Reliable**: Stripe retries failed webhooks automatically
- ✅ **Accurate**: Single source of truth for payment status
- ✅ **Secure**: Verified with cryptographic signatures

---

## 📬 Events We Handle

Our webhook handler (`stripe-webhook-enhanced.controller.ts`) processes these events:

### Payment Events

| Event | What It Does | Updates |
|-------|-------------|---------|
| `payment_intent.succeeded` | Payment completed successfully | • Mark booking as `confirmed`<br>• Set payment_status to `paid`<br>• Record transaction<br>• Trigger escrow lock |
| `payment_intent.payment_failed` | Payment failed (declined card, etc.) | • Mark booking as `payment_failed`<br>• Record failure reason<br>• Send notification |
| `payment_intent.canceled` | Payment canceled by user/system | • Mark booking as `canceled`<br>• Update payment status |
| `charge.refunded` | Refund issued | • Mark booking as `refunded`<br>• Release escrow funds<br>• Record refund transaction |

### Stripe Connect Events (Barber Payouts)

| Event | What It Does | Updates |
|-------|-------------|---------|
| `account.updated` | Barber's Stripe Connect account changed | • Update onboarding status<br>• Enable/disable charges/payouts |
| `transfer.created` | Payout sent to barber | • Record payout<br>• Log completion |
| `transfer.updated` | Payout status changed (including failures) | • Update payout status<br>• Handle failures |

---

## 💻 Local Development Setup

### Option 1: Stripe CLI (Recommended)

The **Stripe CLI** forwards webhook events from Stripe to your local server.

#### Step 1: Install Stripe CLI

```bash
# macOS
brew install stripe/stripe-cli/stripe

# Windows (Scoop)
scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git
scoop install stripe

# Linux
wget https://github.com/stripe/stripe-cli/releases/latest/download/stripe_linux_x86_64.tar.gz
tar -xvf stripe_linux_x86_64.tar.gz
sudo mv stripe /usr/local/bin
```

#### Step 2: Login to Stripe

```bash
stripe login
```

This opens your browser to authenticate.

#### Step 3: Forward Webhooks to Local Server

```bash
# Start your backend first
cd ~/Desktop/CampusCuts/backend
npm run dev

# In a new terminal, forward webhooks
stripe listen --forward-to localhost:3001/api/webhooks/stripe
```

**Output:**
```
> Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxx
```

#### Step 4: Copy Webhook Secret to .env

```bash
# backend/.env
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

#### Step 5: Test It!

Trigger a test payment:

```bash
stripe trigger payment_intent.succeeded
```

Check your backend logs - you should see:
```
✅ Stripe webhook verified: payment_intent.succeeded
💰 Payment succeeded: pi_test_xxxxx
```

---

### Option 2: Skip Signature Verification (Dev Only)

For quick testing without Stripe CLI:

```bash
# backend/.env
# Leave STRIPE_WEBHOOK_SECRET empty
STRIPE_WEBHOOK_SECRET=

# The webhook controller will log a warning but process events
```

**⚠️ WARNING:** Never use this in production!

---

## 🌐 Production Setup

### Step 1: Get Your Production Domain

Your webhook endpoint will be:
```
https://api.campuscuts.com/api/webhooks/stripe
```

Or if using EC2:
```
https://13.57.186.52/api/webhooks/stripe
```

### Step 2: Register Webhook in Stripe Dashboard

1. Go to https://dashboard.stripe.com/webhooks
2. Click **"Add endpoint"**
3. **Endpoint URL:**
   ```
   https://api.campuscuts.com/api/webhooks/stripe
   ```
4. **Select events to listen to:**
   - ✅ `payment_intent.succeeded`
   - ✅ `payment_intent.payment_failed`
   - ✅ `payment_intent.canceled`
   - ✅ `charge.refunded`
   - ✅ `account.updated`
   - ✅ `transfer.created`
   - ✅ `transfer.updated`

5. Click **"Add endpoint"**

### Step 3: Copy Webhook Signing Secret

After creating the endpoint, click **"Reveal"** next to **Signing secret**.

Copy it to your production environment:

```bash
# On EC2 or hosting platform
export STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx

# Or in Railway/Render dashboard:
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

### Step 4: Verify Webhook

Stripe will send a test event. Check your server logs:

```bash
# EC2
sudo journalctl -u campuscuts-backend -f

# Docker
docker logs -f campuscuts-backend

# PM2
pm2 logs backend
```

You should see:
```
✅ Stripe webhook verified: checkout.session.completed (test event)
```

---

## 🗄️ Database Setup

Run the migration to create required tables:

```bash
cd ~/Desktop/CampusCuts/backend

# Using psql directly
psql $DATABASE_URL -f database/migrations/006_stripe_payment_tracking.sql

# Or using Prisma (if you're using Prisma)
npx prisma migrate deploy
```

### Tables Created

1. **`payment_transactions`** - All Stripe payments/refunds
2. **`barber_payouts`** - Payouts to barbers
3. **Booking columns:**
   - `payment_intent_id` - Stripe Payment Intent ID
   - `payment_status` - Payment status (pending, paid, failed, etc.)
4. **User columns:**
   - `stripe_account_id` - Stripe Connect account
   - `stripe_connect_onboarded` - Onboarding status
   - `stripe_charges_enabled` - Can accept charges
   - `stripe_payouts_enabled` - Can receive payouts

---

## 🧪 Testing Webhooks

### Manual Testing with Stripe CLI

```bash
# Test successful payment
stripe trigger payment_intent.succeeded

# Test failed payment
stripe trigger payment_intent.payment_failed

# Test refund
stripe trigger charge.refunded

# Test Connect account update
stripe trigger account.updated

# Test payout
stripe trigger transfer.created
```

### Testing with Real Payments

1. **Create a test booking** in your app
2. **Use test card:** `4242 4242 4242 4242`
3. **Any future expiry date, any CVC**
4. **Complete payment**
5. **Check logs** for webhook processing

### Verify in Database

```sql
-- Check payment was recorded
SELECT * FROM payment_transactions 
WHERE booking_id = YOUR_BOOKING_ID;

-- Check booking status updated
SELECT id, status, payment_status, payment_intent_id 
FROM bookings 
WHERE id = YOUR_BOOKING_ID;
```

### Check Stripe Dashboard

Go to: https://dashboard.stripe.com/test/events

You'll see all webhook events and their status.

---

## 🔍 Troubleshooting

### Issue: "Webhook signature verification failed"

**Cause:** Wrong webhook secret or body not raw

**Solution:**
1. Verify `STRIPE_WEBHOOK_SECRET` is correct
2. Ensure webhook route uses `express.raw()` (already configured in `index.ts` line 187)
3. Check Stripe CLI is forwarding to correct URL

```bash
# Restart Stripe CLI with correct URL
stripe listen --forward-to localhost:3001/api/webhooks/stripe
```

---

### Issue: "No booking ID in payment intent metadata"

**Cause:** Payment Intent created without metadata

**Solution:** When creating Payment Intent, include metadata:

```typescript
const paymentIntent = await stripe.paymentIntents.create({
  amount: 3500, // $35.00
  currency: 'usd',
  metadata: {
    bookingId: '123',
    studentId: '456',
    barberId: '789',
  },
});
```

---

### Issue: Webhook received but booking not updated

**Cause:** Database error or booking not found

**Solution:** Check backend logs:

```bash
pm2 logs backend

# Look for errors like:
# "Booking 123 not found in database"
# "Error processing payment success: ..."
```

Verify booking exists:

```sql
SELECT * FROM bookings WHERE id = 123;
```

---

### Issue: "Error: Cannot read property 'id' of undefined"

**Cause:** Missing database columns

**Solution:** Run the migration:

```bash
psql $DATABASE_URL -f backend/database/migrations/006_stripe_payment_tracking.sql
```

---

### Issue: Webhooks timing out

**Cause:** Handler taking too long (Stripe times out after 30 seconds)

**Solution:** 
- Check for slow database queries
- Ensure escrow/notification services don't block
- Consider moving heavy operations to background jobs

---

## 📊 Monitoring Webhooks

### View Webhook Logs

```bash
# Production (EC2)
tail -f /var/log/campuscuts/backend.log | grep "Stripe webhook"

# Docker
docker logs -f campuscuts-backend | grep "Stripe"

# PM2
pm2 logs backend | grep "Stripe"
```

### Stripe Dashboard

Go to: https://dashboard.stripe.com/test/webhooks

- ✅ **Successful webhooks** - green checkmark
- ❌ **Failed webhooks** - red X (Stripe retries automatically)

### Database Queries

```sql
-- Recent payments
SELECT * FROM payment_transactions 
ORDER BY created_at DESC 
LIMIT 10;

-- Failed payments
SELECT * FROM payment_transactions 
WHERE status = 'failed' 
ORDER BY created_at DESC;

-- Pending bookings (payments not completed)
SELECT * FROM bookings 
WHERE payment_status = 'pending' 
AND created_at > NOW() - INTERVAL '1 hour';
```

---

## 🔒 Security Best Practices

1. ✅ **Always verify webhook signatures** (done automatically)
2. ✅ **Use HTTPS in production** (required by Stripe)
3. ✅ **Never commit webhook secrets to Git**
4. ✅ **Rotate secrets if compromised**
5. ✅ **Log all webhook events** for auditing
6. ✅ **Use idempotency** (same event processed multiple times = same result)

---

## 🚀 Quick Start Checklist

### Development
```bash
✅ Install Stripe CLI
✅ Start backend (npm run dev)
✅ Forward webhooks (stripe listen --forward-to localhost:3001/api/webhooks/stripe)
✅ Copy webhook secret to backend/.env
✅ Run database migration
✅ Test with: stripe trigger payment_intent.succeeded
```

### Production
```bash
✅ Register webhook endpoint in Stripe Dashboard
✅ Copy signing secret to production env vars
✅ Deploy backend code
✅ Run database migration on production DB
✅ Send test event from Stripe Dashboard
✅ Monitor logs for successful processing
```

---

## 📚 Additional Resources

- **Stripe Webhooks Docs:** https://stripe.com/docs/webhooks
- **Stripe CLI:** https://stripe.com/docs/stripe-cli
- **Testing Webhooks:** https://stripe.com/docs/webhooks/test
- **Event Types:** https://stripe.com/docs/api/events/types

---

## ✅ Summary

Your Stripe webhook system is now set up to:

1. ✅ **Receive real-time payment notifications** from Stripe
2. ✅ **Update booking status** automatically
3. ✅ **Record all transactions** in the database
4. ✅ **Handle refunds** and cancellations
5. ✅ **Track barber payouts** via Stripe Connect
6. ✅ **Secure** with signature verification
7. ✅ **Reliable** with automatic retries

**Next Steps:**
- Test a real payment flow end-to-end
- Monitor webhook delivery in Stripe Dashboard
- Set up alerts for failed webhooks
- Integrate with notification system

---

**Need help?** Check the troubleshooting section or reach out to the team!

