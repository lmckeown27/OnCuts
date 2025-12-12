# Gas Wallet Monitoring Setup Guide

Automated monitoring system that tracks gas wallet balance and sends alerts when it's running low.

---

## Features

✅ **Automated Balance Checks** - Every 15 minutes  
✅ **Multi-Channel Alerts** - Email, Slack, SMS (critical only)  
✅ **Usage Analytics** - Track daily gas consumption  
✅ **Smart Predictions** - Estimates days remaining  
✅ **Alert Cooldown** - Prevents spam (6-hour minimum between alerts)  
✅ **Admin Dashboard** - Visual monitoring interface  

---

## Quick Start

### 1. Environment Variables

Add these to your `backend/.env`:

```bash
# Gas Wallet Address (REQUIRED)
GAS_WALLET_ADDRESS=0x1234567890abcdef1234567890abcdef12345678

# Alert Thresholds (in APT)
GAS_WALLET_CRITICAL_THRESHOLD=10   # Critical alert below this
GAS_WALLET_WARNING_THRESHOLD=50    # Warning alert below this
GAS_WALLET_HEALTHY_THRESHOLD=100   # Healthy above this

# Alert Cooldown
ALERT_COOLDOWN_HOURS=6  # Hours between alerts

# Admin Contact
ADMIN_EMAIL=admin@campuscuts.com

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@campuscuts.com
SMTP_PASS=your_app_password_here
FROM_EMAIL=noreply@campuscuts.com
FROM_NAME=CampusCuts Gas Monitor

# Slack (Optional)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Phone for SMS (Optional - Critical alerts only)
ADMIN_PHONE=+1234567890
```

### 2. Email Setup (Gmail Example)

**Using Gmail:**
1. Go to Google Account Settings
2. Security → 2-Step Verification → App Passwords
3. Generate an app password
4. Use this as `SMTP_PASS`

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-digit-app-password
```

### 3. Slack Setup (Optional)

1. Go to https://api.slack.com/messaging/webhooks
2. Create an Incoming Webhook
3. Choose channel for alerts (e.g., #gas-wallet-alerts)
4. Copy webhook URL
5. Add to `.env`:

```bash
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX
```

### 4. Start Backend

The monitoring starts automatically when backend starts:

```bash
cd backend
npm run dev
```

You'll see:
```
✅ Gas wallet monitoring started (checks every 15 min, alerts when low)
```

---

## Alert Levels

### 🟢 Healthy (≥ 100 APT)
- No alerts sent
- Normal operation
- Monitoring continues

### 🟡 Warning (< 50 APT)
- **Email + Slack** alerts sent
- Action recommended soon
- Check every 15 minutes

### 🔴 Critical (< 10 APT)
- **Email + Slack + SMS** alerts sent
- **IMMEDIATE ACTION REQUIRED**
- Service disruption imminent

---

## Monitoring Schedule

| Job | Frequency | Purpose |
|-----|-----------|---------|
| **Quick Check** | Every 15 min | Balance check + alerts |
| **Detailed Check** | Every hour | Full stats + usage analysis |
| **Daily Summary** | 9 AM daily | Comprehensive report |

---

## API Endpoints

### Get Current Status
```bash
GET /api/gas/monitor/status
```

Response:
```json
{
  "success": true,
  "status": {
    "address": "0x123...",
    "balance": 75.42,
    "status": "warning",
    "estimatedDaysRemaining": 15
  }
}
```

### Get Usage Statistics
```bash
GET /api/gas/monitor/usage
```

### Get Alert History
```bash
GET /api/gas/monitor/alerts?limit=10
```

### Get Complete Dashboard
```bash
GET /api/gas/monitor/dashboard
```

### Manual Check (Admin Only)
```bash
POST /api/gas/monitor/check-now
Authorization: Bearer {token}
```

---

## Admin Dashboard

View monitoring at: **http://localhost:3000/admin**

**Dashboard shows:**
- Current balance with status indicator
- Estimated days remaining
- Daily usage chart
- Recent alerts
- Monitoring status

**Visual Status Indicators:**
- 🔴 Red border = Critical
- 🟡 Yellow border = Warning
- 🟢 Green border = Healthy

---

## Alert Examples

### Email Alert

**Subject:** `🚨 CRITICAL: Gas Wallet Nearly Empty`

```
Current Balance: 8.45 APT
Status: CRITICAL
Estimated Days Remaining: 2 days
Wallet Address: 0x1234...5678

⛔️ IMMEDIATE ACTION REQUIRED
Fund the gas wallet NOW to prevent service disruption.

How to Fund:
1. Go to Admin Dashboard
2. Click "Connect Wallet"
3. Transfer APT to gas wallet
4. Recommended: 200 APT
```

### Slack Alert

```
🚨 CRITICAL: Gas Wallet Nearly Empty

Current Balance: 8.45 APT
Status: CRITICAL
Est. Days Remaining: 2 days
Wallet: 0x1234...5678

⛔️ IMMEDIATE ACTION REQUIRED
Fund the gas wallet NOW to prevent service disruption.

[Go to Admin Dashboard]
```

---

## Usage Analytics

### Daily Usage Tracking

System automatically tracks gas consumption per day:

```javascript
{
  "2024-12-10": 5.2,  // APT used
  "2024-12-11": 4.8,
  "2024-12-12": 6.1,
  // ... last 30 days
}
```

**Used for:**
- Calculating average daily usage
- Predicting days remaining
- Identifying usage spikes
- Cost forecasting

---

## Customization

### Adjust Thresholds

Edit `.env`:
```bash
# More conservative (alert earlier)
GAS_WALLET_WARNING_THRESHOLD=100   # Up from 50
GAS_WALLET_CRITICAL_THRESHOLD=25   # Up from 10

# Less frequent alerts
ALERT_COOLDOWN_HOURS=12  # Up from 6
```

### Disable Monitoring

Comment out in `backend/src/index.ts`:
```typescript
// gasWalletCron.start();
```

---

## Troubleshooting

### No Alerts Being Sent

**Check:**
1. Environment variables set correctly
2. SMTP credentials valid
3. Slack webhook URL correct
4. Check backend logs for errors

**Test manually:**
```bash
curl -X POST http://localhost:3001/api/gas/monitor/check-now \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Alerts Spam

- Alert cooldown prevents spam (6 hours by default)
- Increase `ALERT_COOLDOWN_HOURS` if needed
- Check if balance is fluctuating around threshold

### Balance Not Updating

- Check `GAS_WALLET_ADDRESS` is correct
- Verify Aptos node URL in main `.env`
- Check Redis connection (used for caching)

---

## Production Recommendations

### Critical Setup
1. ✅ Configure email alerts (admin email)
2. ✅ Set up Slack alerts (for team visibility)
3. ✅ Set realistic thresholds based on usage
4. ✅ Test alerts before going live

### Best Practices
- Monitor dashboard weekly
- Review usage trends monthly
- Keep gas wallet funded above warning threshold
- Set up PagerDuty/OpsGenie for critical alerts
- Document funding procedures for team

### Funding Schedule
- **Conservative:** Keep above 200 APT
- **Balanced:** Keep above 100 APT
- **Aggressive:** Keep above 50 APT (more frequent funding needed)

---

## Cost Analysis

### Typical Usage

**Assumptions:**
- 100 transactions/day
- 0.05 APT per transaction (gas)
- = 5 APT/day

**Monthly cost:**
- 5 APT/day × 30 days = **150 APT/month**
- At $10/APT = **$1,500/month**

**Recommended balance:**
- Keep 200-300 APT for 1-2 months buffer
- Fund monthly or bi-weekly

---

## Support

**Issues?**
1. Check backend logs: `npm run dev` output
2. Check frontend console: Browser DevTools
3. Test endpoints manually
4. Verify environment variables

**Logs to check:**
```
Gas wallet monitoring started...
Checking gas wallet balance...
Gas wallet balance: 75.42 APT (warning)
Gas wallet WARNING - sending alerts
```

---

## Files Created

**Backend:**
- `backend/src/services/gas-wallet-monitor.service.ts` - Core monitoring logic
- `backend/src/services/gas-wallet-cron.service.ts` - Scheduled jobs
- `backend/src/services/email.service.ts` - Email alerts
- `backend/src/services/slack.service.ts` - Slack alerts
- `backend/src/controllers/gas-monitoring.controller.ts` - API endpoints
- `backend/src/routes/gas-wallet.routes.ts` - Updated routes

**Frontend:**
- `web-app/src/components/GasWalletMonitor.tsx` - Dashboard component
- `web-app/src/pages/admin/AdminDashboard.tsx` - Updated dashboard

---

## Next Steps

1. ✅ Configure environment variables
2. ✅ Set up email/Slack
3. ✅ Restart backend
4. ✅ Visit `/admin` to see dashboard
5. ✅ Test with `POST /api/gas/monitor/check-now`
6. ✅ Fund gas wallet to healthy level

**You're all set!** The system will now monitor your gas wallet 24/7 and alert you when funding is needed.

