# Admin Section Reorganization

## Overview

The admin section has been reorganized into a professional dashboard with dedicated routes for each major function.

---

## New Route Structure

```
/admin                    → Main Dashboard (Navigation Hub)
/admin/campuses           → Campus/Barber/Student Management
/admin/system-health      → System Mode Meter & Infrastructure
/admin/gas-wallet         → Gas Wallet Monitoring & Alerts
/admin/pricing            → Dynamic Pricing Management
/admin/user/:userId       → Individual User Admin View
```

---

## Pages

### 1. Admin Dashboard Main (`/admin`)

**File:** `web-app/src/pages/admin/AdminDashboardMain.tsx`

**Features:**
- Navigation hub with cards for each admin section
- Quick stats overview (campuses, system status, gas wallet)
- 6 admin sections:
  1. **Campus Management** - View and manage all campuses, barbers, and students
  2. **System Health** - Monitor system mode (Hybrid vs Blockchain-only)
  3. **Gas Wallet Monitor** - Track gas wallet balance and usage
  4. **Platform Analytics** - Coming soon
  5. **Fraud Detection** - Coming soon (AI-powered)
  6. **Dispute Resolution** - Coming soon (AI-assisted)

**Visual Design:**
```
┌────────────────────────────────────────────────────────┐
│ CampusCuts Logo    Admin Dashboard         Back       │
├────────────────────────────────────────────────────────┤
│                                                        │
│ Platform Administration                                │
│ Manage campuses, monitor system health, and oversee   │
│ platform operations                                    │
│                                                        │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │
│ │  5 CAMPUSES  │ │ OPERATIONAL  │ │  MONITORING  │  │
│ └──────────────┘ └──────────────┘ └──────────────┘  │
│                                                        │
│ ┌─────────────────────────┐ ┌─────────────────────┐  │
│ │ Campus Management       │ │ System Health       │  │
│ │ View and manage all     │ │ Monitor system mode │  │
│ │ campuses, barbers, and  │ │ (Hybrid vs BC)      │  │
│ │ students                │ │                     │  │
│ │ [Open Campus Mgmt →]    │ │ [Open System →]     │  │
│ └─────────────────────────┘ └─────────────────────┘  │
│                                                        │
│ ┌─────────────────────────┐ ┌─────────────────────┐  │
│ │ Gas Wallet Monitor      │ │ Platform Analytics  │  │
│ │ Track gas wallet        │ │ View revenue,       │  │
│ │ balance and usage       │ │ bookings, growth    │  │
│ │                         │ │ Coming soon         │  │
│ │ [Open Gas Wallet →]     │ │ [Coming soon]       │  │
│ └─────────────────────────┘ └─────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

---

### 2. Campus Management (`/admin/campuses`)

**File:** `web-app/src/pages/admin/AdminCampusesPage.tsx`

**Features:**
- View all campuses or select individual campus
- Barber performance scores and management
- Student account management
- Live transaction feed per campus
- Click on names to access user admin view
- "How Payments Work" explanation section

**Views:**
1. **All Campuses View** - Grid of all universities
2. **Individual Campus View** - Detailed campus stats, barbers, students, live transactions

---

### 3. System Health (`/admin/system-health`)

**File:** `web-app/src/pages/admin/AdminSystemHealthPage.tsx`

**Features:**
- System mode meter (Hybrid vs Blockchain-Only)
- PostgreSQL connection status
- Blockchain connection status
- Performance information
- Architecture explanation
- Auto-refreshes every 10 seconds

**Visual Design:**
```
┌─────────────────────────────────────────────────────┐
│ System Mode                    [Hybrid Mode ✓]      │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Hybrid ←──▮──────────────────────→ Blockchain Only │
│     [GREEN]  10%                         [ORANGE]   │
│                                                      │
│  ● PostgreSQL: Connected                            │
│  ● Blockchain: Connected                            │
│                                                      │
│  ✓ Optimal Performance                              │
│  Fast queries using PostgreSQL cache                │
└─────────────────────────────────────────────────────┘
```

**API Endpoint:**
```
GET /api/system/health

Response:
{
  "mode": "hybrid" | "blockchain-only",
  "postgres": {
    "status": "connected" | "disconnected",
    "healthy": true | false
  },
  "blockchain": {
    "status": "connected",
    "healthy": true,
    "url": "https://fullnode.devnet.aptoslabs.com/v1"
  },
  "timestamp": "2024-01-08T10:30:00Z"
}
```

---

### 4. Gas Wallet Monitor (`/admin/gas-wallet`)

**File:** `web-app/src/pages/admin/AdminGasWalletPage.tsx`

**Features:**
- Current balance display (APT)
- Status indicator (healthy/warning/critical)
- Daily usage tracking
- Days remaining calculation
- Alert notifications
- 7-day usage history chart
- Manual balance check button
- Link to blockchain explorer

**Status Thresholds:**
- **Healthy:** > 100 APT (green)
- **Warning:** 20-100 APT (yellow)
- **Critical:** < 20 APT (red)

**Visual Design:**
```
┌─────────────────────────────────────────────────────┐
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │
│ │ BALANCE     │ │ DAILY USAGE │ │ DAYS LEFT   │   │
│ │ 45.7823 APT │ │ 0.0234 APT  │ │ 1956        │   │
│ │ ⚠ WARNING   │ │             │ │             │   │
│ └─────────────┘ └─────────────┘ └─────────────┘   │
│                                                      │
│ ⚠ Recent Alerts                                     │
│ ┌──────────────────────────────────────────────┐   │
│ │ WARNING: Balance below 50 APT threshold      │   │
│ │ 2 hours ago                                  │   │
│ └──────────────────────────────────────────────┘   │
│                                                      │
│ 7-Day Usage History                                 │
│ ┌──────────────────────────────────────────────┐   │
│ │ 2024-01-01  [████████] 0.0189 APT  46.2 APT │   │
│ │ 2024-01-02  [█████████] 0.0212 APT 46.1 APT │   │
│ │ 2024-01-03  [████████] 0.0198 APT  46.0 APT │   │
│ └──────────────────────────────────────────────┘   │
│                                                      │
│ [Check Balance Now] [View on Explorer]              │
└─────────────────────────────────────────────────────┘
```

---

## Backend API Endpoints

### Gas Wallet Monitoring

**Base URL:** `/api/gas/monitor`

#### 1. Get Status
```
GET /api/gas/monitor/status

Response:
{
  "address": "0x1234...5678",
  "balance": 45.7823,
  "balanceFormatted": "45.7823 APT",
  "status": "warning",
  "dailyUsage": 0.0234,
  "daysRemaining": 1956,
  "lastChecked": "2024-01-08T10:30:00Z"
}
```

#### 2. Get Usage History
```
GET /api/gas/monitor/usage?days=7

Response:
{
  "address": "0x1234...5678",
  "history": [
    {
      "date": "2024-01-01T00:00:00Z",
      "usage": 0.0189,
      "balance": 46.2
    },
    ...
  ],
  "totalUsage": 0.1568,
  "averageDaily": 0.0224
}
```

#### 3. Get Alerts
```
GET /api/gas/monitor/alerts?limit=10

Response:
{
  "alerts": [
    {
      "level": "warning",
      "message": "Gas wallet balance below 50 APT threshold",
      "timestamp": "2024-01-08T08:30:00Z"
    }
  ],
  "count": 1
}
```

#### 4. Check Now
```
POST /api/gas/monitor/check-now

Response:
{
  "success": true,
  "message": "Gas wallet check completed",
  "balance": 45.7823,
  "timestamp": "2024-01-08T10:30:00Z"
}
```

### System Health

**Base URL:** `/api/system`

#### 1. Get System Health
```
GET /api/system/health

Response:
{
  "mode": "hybrid",
  "postgres": {
    "status": "connected",
    "healthy": true
  },
  "blockchain": {
    "status": "connected",
    "healthy": true,
    "url": "https://fullnode.devnet.aptoslabs.com/v1"
  },
  "timestamp": "2024-01-08T10:30:00Z"
}
```

#### 2. Get Database Status
```
GET /api/system/database-status

Response:
{
  "postgres": {
    "enabled": true,
    "connected": true,
    "status": "healthy",
    "message": "PostgreSQL cache is working - queries are fast"
  },
  "blockchain": {
    "enabled": true,
    "connected": true,
    "status": "healthy",
    "message": "Aptos blockchain is the source of truth"
  },
  "recommendation": "System running optimally in hybrid mode"
}
```

---

## File Structure

```
web-app/src/pages/admin/
├── AdminDashboardMain.tsx        # Main dashboard (navigation)
├── AdminCampusesPage.tsx         # Campus/barber/student management
├── AdminSystemHealthPage.tsx     # System health meter
├── AdminGasWalletPage.tsx        # Gas wallet monitoring
└── AdminUserView.tsx             # Individual user admin view

backend/src/
├── controllers/
│   ├── gas-wallet.controller.ts  # Gas wallet monitoring logic
│   └── system-health.controller.ts # System health checks
└── routes/
    ├── gas-wallet.routes.ts      # Gas wallet API routes
    └── system-health.routes.ts   # System health API routes
```

---

## Navigation Flow

```
Role Selection (/)
  ↓ Select "Admin"
Admin Dashboard (/admin)
  ├─→ Campus Management (/admin/campuses)
  │     ├─→ Individual Campus View
  │     └─→ User Admin View (/admin/user/:userId)
  ├─→ System Health (/admin/system-health)
  ├─→ Gas Wallet Monitor (/admin/gas-wallet)
  ├─→ Pricing Management (/admin/pricing)
  └─→ Back to Role Selection (/)
```

---

## Key Features

### Campus Management
✅ View all campuses  
✅ Barber performance scores  
✅ Student accounts  
✅ Live transaction feed  
✅ Click names to access user admin view  
✅ Payment system explanation  

### System Health
✅ Hybrid vs Blockchain-Only meter  
✅ PostgreSQL connection status  
✅ Blockchain status  
✅ Performance metrics  
✅ Auto-refresh every 10s  
✅ Architecture documentation  

### Gas Wallet Monitor
✅ Current balance (APT)  
✅ Status indicator (healthy/warning/critical)  
✅ Daily usage tracking  
✅ Days remaining calculation  
✅ Alert notifications  
✅ 7-day usage history chart  
✅ Manual balance check  
✅ Link to blockchain explorer  

---

## Benefits

1. **Clean Separation of Concerns** - Each admin function has its own dedicated page
2. **Scalable Architecture** - Easy to add new admin sections
3. **Better UX** - Focused pages instead of one giant page
4. **Professional Interface** - Modern dashboard design
5. **Real-time Monitoring** - Live updates for transactions, system health, and gas wallet
6. **Automated Alerts** - Proactive notifications for critical issues
7. **Comprehensive Tracking** - Full visibility into platform operations

---

## Testing

### 1. Access Admin Dashboard
```
http://localhost:3000/admin
```

### 2. Test Each Section
- Click "Campus Management" → Should show all campuses
- Click "System Health" → Should show meter with current mode
- Click "Gas Wallet Monitor" → Should show balance and usage

### 3. Test Navigation
- From any page, click "Back to Dashboard" → Should return to `/admin`
- From dashboard, click "Back to Roles" → Should return to `/`

### 4. Test API Endpoints
```bash
# System health
curl http://localhost:3001/api/system/health

# Gas wallet status
curl http://localhost:3001/api/gas/monitor/status

# Gas wallet usage
curl http://localhost:3001/api/gas/monitor/usage?days=7

# Gas wallet alerts
curl http://localhost:3001/api/gas/monitor/alerts?limit=10
```

---

## Future Enhancements

### Platform Analytics (Coming Soon)
- Revenue tracking
- Booking trends
- Growth metrics
- Campus performance comparison

### Fraud Detection (Coming Soon)
- AI-powered fraud alerts
- Pattern recognition
- Multi-account correlation
- Risk scoring

### Dispute Resolution (Coming Soon)
- AI-assisted recommendations
- Evidence analysis
- Resolution tracking
- Outcome reporting

---

## Notes

- **Mock Data:** Gas wallet currently uses mock data for demonstration
- **Production:** In production, gas wallet would query Aptos blockchain for real-time balance
- **Cron Jobs:** Automated balance checks should be configured via cron jobs
- **Alerts:** Email/Slack alerts should be configured for critical thresholds
- **Security:** Admin routes should be protected with authentication middleware

---

## Support

For questions or issues:
1. Check `SYSTEM_OVERVIEW.md` for architecture details
2. Check `ARCHITECTURE.md` for technical implementation
3. Check `PAYMENT_SYSTEM.md` for payment flow details

