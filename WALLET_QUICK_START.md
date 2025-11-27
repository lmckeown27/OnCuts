# Custodial Wallet Quick Start

**TL;DR:** CampusCuts now has a Coinbase-style wallet. All payments happen internally with zero fees. Money only touches Stripe when entering or leaving the platform.

---

## 🚀 For Developers

### Check User Balance
```typescript
import ledgerService from '@services/ledger.service';

const balance = await ledgerService.getUserBalance(userId);
console.log(`Available: $${balance.balance_available / 100}`);
console.log(`Pending: $${balance.balance_pending / 100}`);
```

### Process Booking Payment
```typescript
import paymentService from '@services/payment.service';

await paymentService.processBookingPayment({
  bookingId: 'booking_123',
  customerId: 'user_456',
  barberId: 'barber_789',
  totalAmountCents: 3000,    // $30
  tipAmountCents: 500,        // $5
});
// Customer: -$35 (available)
// Barber: +$33.25 (pending), +$5 (available tip), -$1.75 (platform fee)
```

### Release Funds After Service
```typescript
await paymentService.releaseBookingFunds({
  bookingId: 'booking_123',
  barberId: 'barber_789',
  amountCents: 3325,  // Move from pending → available
});
```

### Send Tip
```typescript
await paymentService.processTip({
  fromUserId: 'customer_123',
  toUserId: 'barber_789',
  amountCents: 500,  // $5
  bookingId: 'booking_123',
});
// Instant transfer, $0 fee
```

---

## 🌐 API Endpoints

```bash
# Check balance
GET /api/wallet/balance

# Add funds
POST /api/wallet/deposit/intent
{ "amount": 100 }

# View history
GET /api/wallet/transactions?limit=20

# Request withdrawal
POST /api/wallet/withdraw
{ "amount": 50 }

# Send tip
POST /api/wallet/tip
{ "toUserId": "barber_789", "amount": 5 }
```

---

## 💰 How Money Flows

### Deposit
```
Card → Stripe → Platform Account
               ↓
         user.balance += $100
```

### Booking
```
customer.available -= $30
       ↓
barber.pending += $28.50 (minus 5% fee)
```

### Completion
```
barber.pending -= $28.50
       ↓
barber.available += $28.50
```

### Withdrawal
```
barber.available -= $100
       ↓
Stripe Connect → Barber's Bank
```

---

## 🧪 Test with Mock Data

All mock users have balances:
- **Students:** $100 available
- **Barbers:** $125 available + $50 pending

Sample transactions already in ledger:
- Deposits, tips, bookings, withdrawals, promos

Test API:
```bash
# Using mock data
curl http://localhost:3001/api/dev/barbers
# Shows barbers with balance data
```

---

## 📖 Full Documentation

- **User Guide:** `CUSTODIAL_WALLET_GUIDE.md`
- **Architecture:** `WALLET_ARCHITECTURE.md`
- **Backend Status:** `BACKEND_STATUS.md` (section 3)

---

**Status: ✅ Fully Operational**

