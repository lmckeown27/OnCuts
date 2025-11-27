# Frontend V2 Integration Status

**Started:** November 27, 2025  
**Current Status:** Services & Core Components Complete

---

## ✅ Completed (Part 1)

### Services Layer (3/3)
- ✅ `wallet-v2.service.ts` - V2 wallet operations
- ✅ `admin.service.ts` - Platform management (10 endpoints)
- ✅ `booking-v2.service.ts` - Escrow-based bookings (5 endpoints)

### Components (3/3)
- ✅ `EscrowStatusBadge.tsx` - Visual escrow status indicator
- ✅ `BalanceDisplay.tsx` - Available/Pending balance split
- ✅ `WithdrawalOptions.tsx` - Bank vs On-chain withdrawal UI

### Pages (1/4)
- ✅ `WalletPage.tsx` - Complete wallet management (4 tabs)

---

## 🔄 Remaining Work

### Pages to Update/Create

#### 1. ConsumerPage.tsx Updates
**Current:** Uses old V1 booking flow  
**Needed:** V2 escrow-based booking flow

**Changes Required:**
```typescript
// OLD (V1):
const createBooking = async () => {
  await bookingService.createBooking({ barberId, price, ... });
  // Funds immediately debited
};

// NEW (V2):
const createBooking = async () => {
  const { booking, escrow } = await bookingV2Service.createBooking({
    barberId,
    priceCents,
    requestedSlot,
    serviceId,
  });
  
  // Show escrow status
  toast.success(`Booking created! Funds held in escrow (expires in ${escrow.expires_hours}h)`);
};
```

**UI Updates:**
- Show escrow status on booking cards
- Display "Funds held in escrow" message
- Show expiry countdown for pending bookings

#### 2. BarberPage.tsx Updates
**Current:** No completion flow  
**Needed:** Escrow release + tip functionality

**Changes Required:**
```typescript
const completeBooking = async (bookingId: string, tipCents?: number) => {
  const result = await bookingV2Service.completeBooking(bookingId, tipCents);
  
  toast.success(
    `Booking completed! You received $${result.net_to_barber_dollars} 
    (after $${result.platform_fee_dollars} platform fee)`
  );
  
  // Refresh balance
  await loadBalance();
};
```

**UI Updates:**
- "Complete Booking" button on pending bookings
- Optional tip input field
- Show pending balance in dashboard
- Display net amount after fees

#### 3. AdminPage.tsx (NEW)
**Current:** Doesn't exist  
**Needed:** Platform management dashboard

**Required Sections:**

**A. Platform Treasury**
```typescript
const TreasurySection = () => {
  const [stats, setStats] = useState<TreasuryStats | null>(null);
  
  useEffect(() => {
    adminService.getTreasuryStats().then(setStats);
  }, []);
  
  return (
    <Card>
      <h3>Platform Treasury</h3>
      <div>Total User Balances: ${stats?.total_user_balances_dollars}</div>
      <div>Total Escrow: ${stats?.total_escrow_dollars}</div>
      <div>Total Fees: ${stats?.total_fees_dollars}</div>
    </Card>
  );
};
```

**B. Platform Fees Management**
```typescript
const FeesSection = () => {
  const [fees, setFees] = useState<PlatformFees | null>(null);
  
  const withdrawFees = async (amount: number) => {
    await adminService.withdrawPlatformFees(amount, 'bank', 'stripe_account_id');
    toast.success('Fees withdrawn successfully');
    loadFees();
  };
  
  return (
    <Card>
      <h3>Platform Fees</h3>
      <div>Available: ${fees?.available_fees_dollars}</div>
      <div>Count: {fees?.available_count} fees</div>
      <Button onClick={() => withdrawFees(100)}>Withdraw Fees</Button>
    </Card>
  );
};
```

**C. Reconciliation Reports**
```typescript
const ReconciliationSection = () => {
  const [reports, setReports] = useState<ReconciliationReport[]>([]);
  
  const runReconciliation = async () => {
    const report = await adminService.runReconciliation();
    if (report.status === 'discrepancies') {
      toast.error(`Discrepancies found: $${report.discrepancy_cents / 100}`);
    } else {
      toast.success('Reconciliation completed - no discrepancies');
    }
  };
  
  return (
    <Card>
      <Button onClick={runReconciliation}>Run Daily Reconciliation</Button>
      {/* List reports */}
    </Card>
  );
};
```

**D. Withdrawal Batch Monitoring**
```typescript
const BatchMonitoringSection = () => {
  const [batches, setBatches] = useState<WithdrawalBatchStats | null>(null);
  
  const processBatch = async () => {
    await adminService.processBatch('aptos');
    toast.success('Batch processing triggered');
  };
  
  return (
    <Card>
      <h3>Withdrawal Batches</h3>
      <div>Queued: {batches?.queued_count}</div>
      <div>Amount: ${batches?.queued_total_dollars}</div>
      <Button onClick={processBatch}>Process Batch Now</Button>
    </Card>
  );
};
```

**E. User Management**
```typescript
const UserManagementSection = () => {
  const [userId, setUserId] = useState('');
  const [balance, setBalance] = useState<any>(null);
  
  const checkBalance = async () => {
    const bal = await adminService.getUserBalance(userId);
    setBalance(bal);
  };
  
  const issueCredit = async (amount: number) => {
    await adminService.issueCredit(userId, amount, 'Promotional credit');
    toast.success('Credit issued');
  };
  
  return (
    <Card>
      <input value={userId} onChange={(e) => setUserId(e.target.value)} />
      <Button onClick={checkBalance}>Check Balance</Button>
      <Button onClick={() => issueCredit(10)}>Issue $10 Credit</Button>
    </Card>
  );
};
```

**F. Audit Logs**
```typescript
const AuditLogsSection = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  
  useEffect(() => {
    adminService.getAuditLogs(100).then(data => setLogs(data.logs));
  }, []);
  
  return (
    <Card>
      <h3>Recent Audit Logs</h3>
      <div className="space-y-2">
        {logs.map(log => (
          <div key={log.id}>
            <strong>{log.action}</strong> by {log.actor_user_id}
            <div className="text-sm text-gray-500">{log.created_at}</div>
          </div>
        ))}
      </div>
    </Card>
  );
};
```

---

## 📋 Implementation Checklist

### Consumer Flow
- [ ] Update `ConsumerPage.tsx` to use `bookingV2Service`
- [ ] Add `EscrowStatusBadge` to booking cards
- [ ] Show "Funds held in escrow" message
- [ ] Display escrow expiry countdown

### Barber Flow
- [ ] Update `BarberPage.tsx` to use `bookingV2Service`
- [ ] Add "Complete Booking" button
- [ ] Add optional tip input
- [ ] Show pending balance separately
- [ ] Display net earnings after fees
- [ ] Integrate `BalanceDisplay` component

### Admin Dashboard
- [ ] Create `AdminPage.tsx`
- [ ] Add Platform Treasury section
- [ ] Add Platform Fees section with withdrawal
- [ ] Add Reconciliation section
- [ ] Add Batch Monitoring section
- [ ] Add User Management section
- [ ] Add Audit Logs section

### Routes
- [ ] Add `/wallet` route → `WalletPage`
- [ ] Add `/admin` route → `AdminPage`
- [ ] Update existing routes to use V2 services

---

## 🎯 Quick Implementation Guide

### Step 1: Update ConsumerPage
```typescript
// web-app/src/pages/ConsumerPage.tsx

import bookingV2Service from '../services/booking-v2.service';
import EscrowStatusBadge from '../components/EscrowStatusBadge';

// In booking creation:
const handleBooking = async () => {
  const { booking, escrow } = await bookingV2Service.createBooking({
    barberId: selectedBarber.id,
    priceCents: selectedService.price * 100,
    requestedSlot: selectedTime,
    serviceId: selectedService.id,
  });
  
  // Show success with escrow info
  toast.success(
    <>
      Booking created!
      <EscrowStatusBadge status={escrow.status} expiresAt={escrow.expires_at} />
    </>
  );
};
```

### Step 2: Update BarberPage
```typescript
// web-app/src/pages/BarberPage.tsx

import bookingV2Service from '../services/booking-v2.service';
import BalanceDisplay from '../components/BalanceDisplay';
import walletV2Service from '../services/wallet-v2.service';

const BarberDashboard = () => {
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [bookings, setBookings] = useState<BookingV2[]>([]);
  
  const completeBooking = async (bookingId: string, tipCents: number = 0) => {
    const result = await bookingV2Service.completeBooking(bookingId, tipCents);
    toast.success(`Earned $${result.net_to_barber_dollars}`);
    loadBalance(); // Refresh balance
    loadBookings(); // Refresh bookings
  };
  
  return (
    <>
      <BalanceDisplay balance={balance} />
      
      {/* Pending bookings */}
      {bookings.filter(b => b.status === 'pending').map(booking => (
        <Card key={booking.id}>
          <h3>{booking.consumer_first_name}</h3>
          <p>${booking.price_cents / 100}</p>
          <EscrowStatusBadge status={booking.escrow_status!} />
          
          {/* Complete button */}
          <Button onClick={() => completeBooking(booking.id, 500)}>
            Complete Booking
          </Button>
          
          {/* Optional tip */}
          <input type="number" placeholder="Tip amount" />
        </Card>
      ))}
    </>
  );
};
```

### Step 3: Create AdminPage
```typescript
// web-app/src/pages/AdminPage.tsx

import React, { useState, useEffect } from 'react';
import adminService from '../services/admin.service';
import Card from '../components/Card';
import Button from '../components/Button';

const AdminPage = () => {
  const [activeTab, setActiveTab] = useState('treasury');
  
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>
        
        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {['treasury', 'fees', 'reconciliation', 'batches', 'users', 'audit'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-1 border-b-2 font-medium ${
                  activeTab === tab ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </nav>
        </div>
        
        {/* Tab Content */}
        {activeTab === 'treasury' && <TreasurySection />}
        {activeTab === 'fees' && <FeesSection />}
        {activeTab === 'reconciliation' && <ReconciliationSection />}
        {activeTab === 'batches' && <BatchMonitoringSection />}
        {activeTab === 'users' && <UserManagementSection />}
        {activeTab === 'audit' && <AuditLogsSection />}
      </div>
    </div>
  );
};
```

---

## 🚀 Testing Checklist

### Consumer Flow Test
1. [ ] Create booking → Check escrow created
2. [ ] View booking → See escrow status badge
3. [ ] Wait for barber to complete
4. [ ] Check funds returned if cancelled

### Barber Flow Test
1. [ ] View pending bookings
2. [ ] See pending balance
3. [ ] Complete booking with tip
4. [ ] Check balance updated
5. [ ] Withdraw to bank
6. [ ] Try on-chain withdrawal (queued)

### Admin Flow Test
1. [ ] View platform treasury
2. [ ] Check platform fees
3. [ ] Withdraw fees
4. [ ] Run reconciliation
5. [ ] Process withdrawal batch
6. [ ] Issue promotional credit
7. [ ] View audit logs

---

## 📊 Migration Strategy

### Phase 1: Add V2 Routes (Week 1)
- Add `/wallet` route with new `WalletPage`
- Keep existing routes using V1
- Test wallet functionality

### Phase 2: Update User Flows (Week 2)
- Update `ConsumerPage` to V2
- Update `BarberPage` to V2
- A/B test with 10% of users

### Phase 3: Add Admin Dashboard (Week 3)
- Deploy `AdminPage`
- Train admin staff
- Monitor for issues

### Phase 4: Full Rollout (Week 4)
- 100% of users on V2
- Deprecate V1 services
- Remove old code

---

## 💡 Pro Tips

### Error Handling
```typescript
try {
  await bookingV2Service.createBooking(...);
} catch (error: any) {
  if (error.response?.status === 400) {
    toast.error(error.response.data.message); // "Insufficient balance"
  } else {
    toast.error('Booking failed. Please try again.');
  }
}
```

### Real-time Balance Updates
```typescript
// After any wallet operation
const refreshBalance = async () => {
  const balance = await walletV2Service.getBalance();
  setBalance(balance);
};

// Call after:
// - Booking creation
// - Booking completion
// - Deposit
// - Withdrawal
```

### Optimistic UI Updates
```typescript
const completeBooking = async (bookingId: string) => {
  // Optimistically update UI
  setBookings(prev => prev.filter(b => b.id !== bookingId));
  setBalance(prev => ({
    ...prev,
    pending_dollars: prev.pending_dollars - bookingPrice,
    available_dollars: prev.available_dollars + (bookingPrice * 0.95),
  }));
  
  try {
    await bookingV2Service.completeBooking(bookingId);
  } catch (error) {
    // Revert on error
    loadBookings();
    loadBalance();
    toast.error('Failed to complete booking');
  }
};
```

---

## 🎨 UI/UX Best Practices

### Escrow Communication
- ✅ "Your funds are safely held in escrow"
- ✅ "Payment secured until service completion"
- ✅ "Full refund if cancelled"
- ❌ Don't use technical jargon

### Balance Display
- ✅ Show available prominently
- ✅ Explain pending balance clearly
- ✅ Use color coding (green=available, yellow=pending)
- ❌ Don't hide important details

### Withdrawal Options
- ✅ Compare bank vs on-chain clearly
- ✅ Show estimated time (instant vs 15min)
- ✅ Explain fee differences
- ❌ Don't overwhelm with technical details

---

**Status:** Services & Components Complete  
**Next:** Update Consumer/Barber pages, Create Admin dashboard  
**Estimated Time:** 8-12 hours for remaining work

