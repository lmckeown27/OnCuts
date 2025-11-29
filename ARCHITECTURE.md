# 🏗️ CampusCuts Platform Architecture

**Complete Technical Architecture Documentation**

> **Architecture Type:** Decentralized-First Hybrid (Blockchain + Web2 UX)  
> **Deployment Model:** Serverless Backend + IPFS Frontend + Aptos Blockchain  
> **User Experience:** Web2 (Traditional) + Web3 (Blockchain) Backend

---

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Principles](#architecture-principles)
3. [System Components](#system-components)
4. [Technology Stack](#technology-stack)
5. [Data Architecture](#data-architecture)
6. [Smart Contracts](#smart-contracts)
7. [Backend Services](#backend-services)
8. [Frontend Application](#frontend-application)
9. [Infrastructure Layers](#infrastructure-layers)
10. [Security Architecture](#security-architecture)
11. [Deployment Architecture](#deployment-architecture)
12. [Integration Points](#integration-points)
13. [Scalability & Performance](#scalability--performance)

---

## 🎯 System Overview

### **What is CampusCuts?**

CampusCuts is a **decentralized barber booking platform** that uses blockchain technology for transparency and security while providing a familiar Web2 user experience.

**Core Innovation:**
```
Traditional Platform: Web2 UX + Centralized Database + High Costs
CampusCuts:          Web2 UX + Blockchain Database + 92% Lower Costs
```

### **High-Level Architecture**

```
┌─────────────────────────────────────────────────────────────┐
│                    USER INTERFACE                           │
│  React PWA (IPFS Hosted) - Web2 UX, Web3 Backend           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ HTTPS/WSS
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              BACKEND API LAYER (Node.js)                    │
│  Custodial Wallet Manager + Fiat Bridge + Signing Service  │
└─────┬────────────────┬───────────────┬──────────────────────┘
      │                │               │
      │ Web3           │ IPFS          │ Stripe
      ▼                ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│   Aptos      │ │    IPFS      │ │   Stripe     │
│  Blockchain  │ │  (Pinata)    │ │  Payments    │
│              │ │              │ │              │
│ • Balances   │ │ • Images     │ │ • CC Payments│
│ • Escrow     │ │ • Reviews    │ │ • Payouts    │
│ • Reviews    │ │ • Profiles   │ │ • Webhooks   │
└──────────────┘ └──────────────┘ └──────────────┘
```

### **Key Architecture Decisions**

| Decision | Rationale |
|----------|-----------|
| **Aptos Blockchain** | Primary database for all transactional data |
| **IPFS** | Decentralized storage for media and large text |
| **Custodial Wallets** | Users never need crypto knowledge |
| **Stripe Integration** | Fiat on/off-ramps for traditional payments |
| **Serverless Backend** | Minimal infrastructure costs |
| **React PWA** | Native app-like experience, installable |

---

## 🧭 Architecture Principles

### **1. Decentralization Without Complexity**

**Problem:** Blockchain is powerful but intimidating for average users  
**Solution:** Abstract all crypto complexity behind familiar UX

```typescript
// User sees:
"Click to book → Enter card → Confirmed!"

// System does:
stripe.charge() → custodialSigner.sign() → aptos.submitTransaction()
  → escrow.lock() → notification.send()
```

### **2. Blockchain as Database**

**Traditional:**
```
Application → PostgreSQL → Backups → Replication → Monitoring
Cost: $200-500/month
```

**CampusCuts:**
```
Application → Aptos Blockchain → Automatic replication & consensus
Cost: $15/month (gas fees only)
```

### **3. Optimistic UI**

**User Perception:**
```
Action → Instant feedback (200ms)
```

**Reality:**
```
Action → Optimistic update → Blockchain tx (2-3s) → Confirmation
```

### **4. Hybrid Data Strategy**

| Data Type | Storage | Reason |
|-----------|---------|--------|
| **Balances** | Aptos | Need consensus, immutability |
| **Bookings** | Aptos | Need escrow, auditability |
| **Reviews** | Aptos + IPFS | Ratings on-chain, text on IPFS |
| **Images** | IPFS | Too large for blockchain |
| **Cache** | Redis | Query performance |
| **Temp Data** | Memory | No persistence needed |

### **5. Cost Minimization**

```
Every architectural decision optimizes for:
1. User experience (instant, familiar)
2. Minimal costs (serverless, blockchain)
3. Security (custodial + blockchain)
4. Scalability (stateless, decentralized)
```

---

## 🔧 System Components

### **Component Diagram**

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND LAYER                           │
├─────────────────────────────────────────────────────────────┤
│ React Components                                            │
│  ├─ Auth Pages (Login, Signup)                             │
│  ├─ Student Pages (Browse, Book, History)                  │
│  ├─ Barber Pages (Calendar, Earnings, Profile)             │
│  └─ Shared (Navigation, Modals, Toasts)                    │
│                                                             │
│ State Management                                            │
│  ├─ React Query (Data fetching, caching, optimistic UI)   │
│  ├─ Context API (Auth, Theme)                              │
│  └─ Local Storage (Cached data, preferences)               │
│                                                             │
│ UI/UX Layer                                                 │
│  ├─ Tailwind CSS (Styling)                                 │
│  ├─ Skeleton Loaders (Loading states)                      │
│  ├─ Error Boundaries (Error handling)                      │
│  └─ Toast Notifications (User feedback)                    │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ REST API / WebSocket
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND LAYER                            │
├─────────────────────────────────────────────────────────────┤
│ API Routes (Express.js)                                     │
│  ├─ /api/auth-blockchain (Signup, Login, Profile)          │
│  ├─ /api/bookings-blockchain (Create, Complete, Cancel)    │
│  ├─ /api/reviews-blockchain (Create, List)                 │
│  ├─ /api/fiat-bridge (Deposit, Withdraw)                   │
│  └─ /api/webhooks (Stripe events)                          │
│                                                             │
│ Core Services                                               │
│  ├─ Custodial Signer (Key management, tx signing)          │
│  ├─ Blockchain Query (Read on-chain data)                  │
│  ├─ IPFS Service (Upload/retrieve media)                   │
│  ├─ Fiat Bridge (Stripe integration)                       │
│  └─ Stripe Monitor (Webhook processing)                    │
│                                                             │
│ Middleware                                                  │
│  ├─ Authentication (JWT validation)                         │
│  ├─ Rate Limiting (DDoS protection)                        │
│  ├─ Error Handling (Centralized errors)                    │
│  └─ Logging (Winston)                                       │
└─────────────────────────────────────────────────────────────┘
          │                   │                    │
          │ Aptos SDK         │ IPFS Client        │ Stripe SDK
          ▼                   ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ BLOCKCHAIN      │  │ DECENTRALIZED   │  │ PAYMENT         │
│ LAYER           │  │ STORAGE         │  │ PROCESSING      │
├─────────────────┤  ├─────────────────┤  ├─────────────────┤
│ Aptos Devnet    │  │ IPFS Network    │  │ Stripe API      │
│                 │  │ (Pinata Gateway)│  │                 │
│ Smart Contracts:│  │                 │  │ - Payments      │
│ • user_accounts │  │ - Profile pics  │  │ - Payouts       │
│ • bookings      │  │ - Portfolio     │  │ - Connect       │
│ • reviews       │  │ - Review text   │  │ - Webhooks      │
│                 │  │ - Service imgs  │  │                 │
│ Gas Wallet:     │  │                 │  │ Bank Accounts   │
│ • Pays all fees │  │ Pinning Service │  │ • Deposits      │
│ • Auto top-up   │  │ • 1GB free      │  │ • Withdrawals   │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

### **Component Interactions**

**Example: Student Books a Barber**

```
1. Frontend
   └─ StudentBookingPage.tsx
      ├─ useBlockchainBookings hook (React Query)
      ├─ Optimistic update (UI shows "Booking...")
      └─ POST /api/bookings-blockchain/create

2. Backend API
   └─ booking-blockchain.controller.ts
      ├─ Authenticate user (JWT middleware)
      ├─ Validate request body
      ├─ Query student balance (blockchain-query.service)
      ├─ Generate transaction payload
      └─ Sign & submit (custodial-signer.service)

3. Custodial Signer
   └─ custodial-signer.service.ts
      ├─ Derive student address from email
      ├─ Decrypt private key from KMS
      ├─ Sign transaction with Move entry function
      └─ Submit to Aptos via SDK

4. Aptos Blockchain
   └─ bookings.move smart contract
      ├─ Verify student has sufficient balance
      ├─ Lock funds in escrow
      ├─ Create booking record
      ├─ Emit BookingCreatedEvent
      └─ Return transaction hash

5. Backend Response
   └─ Return to frontend
      ├─ { success: true, booking_id, tx_hash }
      └─ WebSocket broadcast to barber

6. Frontend Update
   └─ React Query cache invalidation
      ├─ Remove optimistic update
      ├─ Fetch fresh data from blockchain
      └─ Show success toast
```

---

## 💻 Technology Stack

### **Frontend**

| Technology | Purpose | Version |
|------------|---------|---------|
| **React** | UI framework | 18.x |
| **TypeScript** | Type safety | 5.x |
| **Vite** | Build tool, dev server | 5.x |
| **Tailwind CSS** | Utility-first styling | 3.x |
| **React Query** | Data fetching, caching | 5.x |
| **React Router** | Client-side routing | 6.x |
| **Axios** | HTTP client | 1.x |
| **Socket.IO Client** | Real-time updates | 4.x |
| **Zustand** (optional) | Global state | 4.x |
| **Vite PWA Plugin** | Progressive Web App | 0.x |

**Build Output:**
```
Static files → IPFS → Accessible via ipfs.io gateway or custom domain
```

### **Backend**

| Technology | Purpose | Version |
|------------|---------|---------|
| **Node.js** | Runtime | 20.x |
| **TypeScript** | Type safety | 5.x |
| **Express.js** | HTTP server | 4.x |
| **@aptos-labs/ts-sdk** | Blockchain interaction | Latest |
| **Stripe** | Payment processing | Latest |
| **ipfs-http-client** | IPFS uploads | 60.x |
| **Socket.IO** | WebSocket server | 4.x |
| **Winston** | Logging | 3.x |
| **Redis** | Caching | 7.x |
| **node-cron** | Scheduled tasks | 3.x |
| **crypto** (Node.js built-in) | Encryption | N/A |

**Runtime:**
```
Vercel Serverless Functions (or AWS Lambda, Railway, Render)
```

### **Blockchain**

| Technology | Purpose |
|------------|---------|
| **Aptos Blockchain** | Layer-1 blockchain (Devnet for testing, Mainnet for production) |
| **Move Language** | Smart contract programming language |
| **Aptos CLI** | Contract deployment and testing |
| **Aptos Explorer** | Transaction and account inspection |
| **Aptos Indexer** | Fast data queries (GraphQL) |

### **Storage**

| Technology | Purpose |
|------------|---------|
| **IPFS** | Decentralized file storage |
| **Pinata** | IPFS pinning service (keeps files available) |
| **Redis (Upstash)** | Serverless cache for blockchain queries |

### **External Services**

| Service | Purpose | Cost |
|---------|---------|------|
| **Stripe** | Credit card payments, bank payouts | 2.9% + $0.30 per transaction |
| **Pinata (IPFS)** | File storage and pinning | $0-20/month |
| **Vercel** | Backend hosting | $0-20/month |
| **Upstash Redis** | Serverless caching | $0-10/month |
| **SendGrid** (optional) | Email notifications | $0-15/month |
| **Sentry** (optional) | Error monitoring | $0-26/month |

---

## 📊 Data Architecture

### **Data Storage Strategy**

```
┌─────────────────────────────────────────────────────────────┐
│ DATA TYPE CLASSIFICATION                                    │
└─────────────────────────────────────────────────────────────┘

TIER 1: Critical Transactional Data (Aptos Blockchain)
├─ User balances (USDC amounts)
├─ Booking records (escrow state, amounts)
├─ Review ratings (stars, verified status)
├─ IPFS Content IDs (pointers to media)
└─ Platform fees collected

TIER 2: Large Media & Text (IPFS)
├─ Profile pictures (students, barbers)
├─ Portfolio images (barber work samples)
├─ Review text (detailed comments)
├─ Service descriptions
└─ Chat history (future feature)

TIER 3: Cached Query Results (Redis)
├─ User balance queries (5-minute TTL)
├─ Booking lists (1-minute TTL)
├─ Barber profiles (10-minute TTL)
└─ Review aggregations (30-minute TTL)

TIER 4: Ephemeral Session Data (Memory/JWT)
├─ JWT tokens (user sessions)
├─ WebSocket connections
├─ Rate limit counters
└─ Temporary processing data
```

### **Data Flow Diagram**

**Write Path (Student Creates Booking):**

```
Frontend Form
    ↓ POST /api/bookings-blockchain/create
Backend Controller
    ↓ Validate & prepare transaction
Custodial Signer
    ↓ Sign transaction with user's private key
Aptos Blockchain
    ↓ Execute bookings::create_booking
Smart Contract
    ├─ Lock USDC in escrow (on-chain)
    ├─ Store booking record (on-chain)
    └─ Emit BookingCreatedEvent
       ↓
Backend Event Listener
    ├─ Invalidate relevant Redis cache
    └─ Broadcast via WebSocket to barber
       ↓
Frontend (Barber Dashboard)
    └─ Show new booking notification (real-time)
```

**Read Path (Student Views Bookings):**

```
Frontend Request
    ↓ GET /api/bookings-blockchain/list?student=john@...
Backend Controller
    ↓ Check Redis cache
Redis Cache
    ├─ HIT → Return cached data (200ms)
    └─ MISS → Query blockchain
       ↓
Blockchain Query Service
    ↓ Query Aptos Indexer (GraphQL)
Aptos Indexer
    ├─ Return booking records (1-2 seconds)
    └─ For each booking with image_cid
       ↓
IPFS Service
    └─ Fetch image URLs from Pinata gateway
       ↓
Backend Controller
    ├─ Cache result in Redis (5 min TTL)
    └─ Return to frontend
       ↓
Frontend
    └─ Render booking cards with images
```

### **Smart Contract Data Structures**

**User Account (user_accounts.move):**

```move
struct UserAccount has key {
    addr: address,              // User's Aptos address
    balance: u64,               // Available USDC (in micro-units)
    reserved: u64,              // USDC locked in escrow
    total_spent: u64,           // Lifetime spending
    total_earned: u64,          // Lifetime earnings (barbers)
    profile_cid: String,        // IPFS CID for profile data
    created_at: u64,            // Unix timestamp
    is_barber: bool             // User type flag
}
```

**Booking (bookings.move):**

```move
struct Booking has key {
    id: address,                // Unique booking ID
    student_addr: address,      // Student's address
    barber_addr: address,       // Barber's address
    amount: u64,                // Service price (USDC)
    platform_fee: u64,          // Platform cut (5%)
    status: u8,                 // 0=pending, 1=completed, 2=cancelled
    scheduled_time: u64,        // Unix timestamp
    created_at: u64,            // Unix timestamp
    completed_at: u64,          // Unix timestamp (0 if not completed)
    escrow_locked: bool         // Is escrow active?
}
```

**Review (reviews.move):**

```move
struct Review has key {
    id: address,                // Unique review ID
    booking_id: address,        // Associated booking
    student_addr: address,      // Reviewer
    barber_addr: address,       // Reviewed barber
    rating: u8,                 // 1-5 stars
    comment_cid: String,        // IPFS CID for review text
    created_at: u64,            // Unix timestamp
    verified: bool              // From completed booking?
}
```

### **IPFS Data Structures**

**Profile Metadata (JSON):**

```json
{
  "name": "John Doe",
  "bio": "Professional barber specializing in fades",
  "university": "UCLA",
  "phone": "+1-555-0100",
  "services": [
    {
      "id": "haircut_basic",
      "name": "Basic Haircut",
      "price": 30,
      "duration": 30,
      "description": "Classic cut, any style"
    }
  ],
  "portfolio": [
    "QmPortfolioImage1...",
    "QmPortfolioImage2..."
  ],
  "availability": {
    "monday": ["09:00", "17:00"],
    "tuesday": ["09:00", "17:00"]
  }
}
```

Stored at: `ipfs://Qm.../profile.json`  
Referenced on-chain: `user_account.profile_cid = "Qm..."`

---

## 🔐 Smart Contracts

### **Contract Architecture**

```
┌─────────────────────────────────────────────────────────────┐
│ APTOS SMART CONTRACTS (Move Language)                      │
└─────────────────────────────────────────────────────────────┘

Module: user_accounts
├─ init_account(user_addr, is_barber)
├─ deposit(user_addr, amount)
├─ withdraw(user_addr, amount)
├─ update_profile_cid(user_addr, cid)
└─ get_balance(user_addr) -> (balance, reserved)

Module: bookings
├─ create_booking(student, barber, amount, fee, time)
│  └─ Locks funds in escrow
├─ complete_booking(booking_id)
│  └─ Releases escrow to barber + platform
├─ cancel_booking(booking_id)
│  └─ Refunds student based on cancellation policy
├─ resolve_dispute(booking_id, student_refund, barber_payment)
│  └─ Admin function for manual resolution
└─ get_booking(booking_id) -> Booking

Module: reviews
├─ create_review(booking_id, rating, comment_cid)
│  └─ Only student who completed booking
├─ get_reviews_for_barber(barber_addr) -> Vec<Review>
└─ get_average_rating(barber_addr) -> u8
```

### **Security Features**

**1. Access Control:**

```move
// Only the student who created a booking can cancel it
public entry fun cancel_booking(
    student: &signer,
    booking_id: address
) acquires Booking {
    let booking = borrow_global_mut<Booking>(booking_id);
    assert!(
        signer::address_of(student) == booking.student_addr,
        ERROR_NOT_AUTHORIZED
    );
    // ... cancel logic
}
```

**2. Escrow Protection:**

```move
// Funds are locked in escrow until completion
public entry fun create_booking(...) {
    // Deduct from student balance
    student_account.balance = student_account.balance - total_amount;
    student_account.reserved = student_account.reserved + total_amount;
    
    // Create booking with escrow flag
    let booking = Booking {
        escrow_locked: true,
        // ...
    };
}
```

**3. Immutability:**

```move
// Reviews cannot be edited once created
public entry fun create_review(...) acquires Review {
    let review_addr = create_new_address();
    assert!(!exists<Review>(review_addr), ERROR_REVIEW_EXISTS);
    
    move_to(review_addr, Review {
        // ... immutable data
    });
}
```

### **Events**

Smart contracts emit events for real-time monitoring:

```move
struct BookingCreatedEvent has drop, store {
    booking_id: address,
    student_addr: address,
    barber_addr: address,
    amount: u64,
    timestamp: u64
}

struct BookingCompletedEvent has drop, store {
    booking_id: address,
    barber_earned: u64,
    platform_fee: u64,
    timestamp: u64
}

// Emit event
event::emit(BookingCreatedEvent {
    booking_id: booking_addr,
    student_addr: student,
    barber_addr: barber,
    amount: amount,
    timestamp: timestamp::now_seconds()
});
```

**Backend listens for events:**

```typescript
// backend/src/services/event-listener.service.ts
aptos.addEventListener('BookingCreatedEvent', async (event) => {
  // Invalidate cache
  await redis.del(`bookings:student:${event.student_addr}`);
  
  // Notify barber via WebSocket
  io.to(event.barber_addr).emit('new_booking', {
    booking_id: event.booking_id,
    student: event.student_addr,
    amount: event.amount
  });
});
```

---

## ⚙️ Backend Services

### **Service Layer Architecture**

```
┌─────────────────────────────────────────────────────────────┐
│ BACKEND SERVICES (Node.js/TypeScript)                      │
└─────────────────────────────────────────────────────────────┘

1. Custodial Signer Service
   ├─ deriveAddress(email) -> Aptos address
   ├─ signTransaction(email, payload) -> Signed tx
   ├─ submitTransaction(signedTx) -> Tx hash
   └─ Uses: KMS for key storage, deterministic derivation

2. Blockchain Query Service
   ├─ getBalance(address) -> { balance, reserved }
   ├─ getBookings(address, role) -> Booking[]
   ├─ getReviews(barberAddress) -> Review[]
   └─ Uses: Aptos Indexer API, Redis cache

3. IPFS Service
   ├─ uploadFile(buffer, filename) -> CID
   ├─ uploadJSON(object) -> CID
   ├─ getFile(cid) -> Buffer
   └─ Uses: Pinata API, image compression (sharp)

4. Fiat-Blockchain Bridge Service
   ├─ depositFiat(email, amount) -> Tx hash
   ├─ withdrawToBank(email, amount) -> Payout ID
   ├─ handleStripeWebhook(event) -> void
   └─ Uses: Stripe API, liquidity pool management

5. Stripe Monitor Service
   ├─ trackEvent(type, data) -> void
   ├─ getRecentEvents() -> Event[]
   ├─ getPaymentStats() -> Stats
   └─ Uses: WebSocket broadcasting, logging
```

### **Custodial Signer Implementation**

**How it works:**

```typescript
// backend/src/services/custodial-signer.service.ts

class CustodialSignerService {
  // Deterministic key derivation
  deriveAddress(email: string): string {
    const seed = this.generateSeed(email);
    const privateKey = new Ed25519PrivateKey(seed);
    const account = Account.fromPrivateKey(privateKey);
    return account.accountAddress.toString();
  }

  // Secure key storage
  async getPrivateKey(email: string): Promise<Ed25519PrivateKey> {
    const encrypted = await kms.decrypt(email); // From KMS
    const seed = this.decrypt(encrypted);
    return new Ed25519PrivateKey(seed);
  }

  // Transaction signing
  async signAndSubmit(
    email: string,
    payload: EntryFunctionPayload
  ): Promise<string> {
    const privateKey = await this.getPrivateKey(email);
    const account = Account.fromPrivateKey(privateKey);
    
    const rawTxn = await aptos.transaction.build.simple({
      sender: account.accountAddress,
      data: payload
    });
    
    const signedTxn = aptos.transaction.sign({
      signer: account,
      transaction: rawTxn
    });
    
    const txnHash = await aptos.transaction.submit.simple({
      transaction: rawTxn,
      senderAuthenticator: signedTxn
    });
    
    return txnHash;
  }
}
```

**Security considerations:**
- Private keys never leave KMS
- Keys encrypted at rest
- Derivation uses HKDF (cryptographically secure)
- Each user has unique address

---

## 🎨 Frontend Application

### **React Architecture**

```
web-app/src/
├─ components/          # Reusable UI components
│  ├─ Skeleton.tsx      # Loading placeholders
│  ├─ Toast.tsx         # Notifications
│  ├─ ErrorBoundary.tsx # Error handling
│  └─ shared/           # Buttons, cards, modals
│
├─ pages/               # Route components
│  ├─ auth/             # Login, Signup
│  ├─ student/          # Browse, Book, History
│  └─ barber/           # Dashboard, Calendar, Earnings
│
├─ hooks/               # Custom React hooks
│  ├─ useBlockchainAuth.ts        # Auth with optimistic UI
│  ├─ useBlockchainBookings.ts    # Booking operations
│  └─ useWebSocket.ts             # Real-time updates
│
├─ services/            # API clients
│  ├─ blockchain-auth.service.ts
│  ├─ blockchain-booking.service.ts
│  └─ api.ts            # Axios instance
│
├─ providers/           # Context providers
│  ├─ QueryProvider.tsx # React Query setup
│  ├─ AuthProvider.tsx  # Auth context
│  └─ ThemeProvider.tsx # Dark mode
│
├─ routes/              # Route configuration
│  └─ LazyRoutes.tsx    # Code splitting
│
└─ utils/               # Helper functions
   ├─ format.ts         # Date, currency formatting
   └─ validation.ts     # Form validation
```

### **Optimistic UI Pattern**

```typescript
// hooks/useBlockchainBookings.ts

export const useCreateBooking = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (booking: BookingInput) => {
      return await blockchainBookingService.create(booking);
    },
    
    // Optimistic update (instant UI feedback)
    onMutate: async (newBooking) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries(['bookings']);
      
      // Snapshot current state
      const previous = queryClient.getQueryData(['bookings']);
      
      // Optimistically update
      queryClient.setQueryData(['bookings'], (old: Booking[]) => [
        ...old,
        { ...newBooking, status: 'pending', id: 'temp-id' }
      ]);
      
      return { previous };
    },
    
    // On error, rollback
    onError: (err, variables, context) => {
      queryClient.setQueryData(['bookings'], context.previous);
      toast.error('Booking failed. Please try again.');
    },
    
    // Always refetch after mutation
    onSettled: () => {
      queryClient.invalidateQueries(['bookings']);
    }
  });
};
```

**User sees:**
```
Click "Book Now" → Card appears immediately → Loading spinner on card
→ 2-3 seconds → Spinner disappears, booking confirmed
```

### **PWA Configuration**

```typescript
// vite.config.ts

import { VitePWA } from 'vite-plugin-pwa';

export default {
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'CampusCuts',
        short_name: 'CampusCuts',
        description: 'Campus barber booking platform',
        theme_color: '#3B82F6',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.campuscuts\.com/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 300 // 5 minutes
              }
            }
          }
        ]
      }
    })
  ]
};
```

---

## 🏢 Infrastructure Layers

### **Layer 1: Blockchain (Aptos)**

**Purpose:** Immutable database for all critical data

**Components:**
- Smart contracts (user_accounts, bookings, reviews)
- Validator nodes (consensus)
- Indexer (GraphQL API for fast queries)

**Interaction:**
```typescript
// Via Aptos SDK
const balance = await aptos.view({
  function: `${MODULE_ADDRESS}::user_accounts::get_balance`,
  type_arguments: [],
  arguments: [userAddress]
});
```

**Cost:** $15/month (5,000 transactions at $0.003 each)

### **Layer 2: Decentralized Storage (IPFS)**

**Purpose:** Store media and large text files

**Components:**
- IPFS network (distributed storage)
- Pinata (pinning service, ensures availability)
- Public gateways (https://ipfs.io/ipfs/[CID])

**Interaction:**
```typescript
// Upload to IPFS
const file = Buffer.from(imageData);
const result = await ipfsClient.add(file);
const cid = result.path; // "Qm..."

// Store CID on-chain
await aptos.submitTransaction({
  function: `${MODULE}::user_accounts::update_profile_cid`,
  arguments: [cid]
});

// Retrieve from IPFS
const imageUrl = `https://ipfs.io/ipfs/${cid}`;
```

**Cost:** $0-20/month

### **Layer 3: Caching (Redis)**

**Purpose:** Cache blockchain queries for performance

**Components:**
- Upstash Redis (serverless)
- TTL-based invalidation
- Key patterns: `balance:0xabc123`, `bookings:student:0xdef456`

**Interaction:**
```typescript
// Check cache first
const cached = await redis.get(`balance:${address}`);
if (cached) return JSON.parse(cached);

// Query blockchain
const balance = await queryBlockchain(address);

// Cache for 5 minutes
await redis.setex(`balance:${address}`, 300, JSON.stringify(balance));
```

**Cost:** $0-10/month

### **Layer 4: Application (Node.js Backend)**

**Purpose:** Signing service, fiat bridge, API gateway

**Hosting Options:**
1. **Vercel Serverless** (recommended for MVP)
2. **AWS Lambda + API Gateway**
3. **Railway** (simple deployment)
4. **Render** (Docker-based)

**Deployment:**
```bash
# Vercel
vercel deploy

# Or Docker
docker build -t campus-cuts-backend .
docker run -p 3001:3001 campus-cuts-backend
```

**Cost:** $0-20/month (serverless free tier + pro if needed)

### **Layer 5: Presentation (React Frontend)**

**Purpose:** User interface

**Hosting:**
- **IPFS** (fully decentralized, via Fleek or manual upload)
- **Vercel** (traditional CDN, faster than IPFS gateways)
- **Cloudflare Pages** (alternative CDN)

**Build & Deploy:**
```bash
# Build
cd web-app && npm run build

# Deploy to IPFS (via Fleek)
fleek deploy

# Or deploy to Vercel
vercel deploy
```

**Cost:** $0/month (free tier sufficient)

---

## 🔐 Security Architecture

### **Security Layers**

```
┌─────────────────────────────────────────────────────────────┐
│ SECURITY ARCHITECTURE                                       │
└─────────────────────────────────────────────────────────────┘

Layer 1: Transport Security
├─ HTTPS/TLS 1.3 (all API traffic)
├─ WSS (WebSocket over TLS)
└─ Certificate pinning (production)

Layer 2: Authentication
├─ JWT tokens (RS256, 1-hour expiry)
├─ Refresh tokens (30-day expiry)
├─ Email verification
└─ Password hashing (bcrypt, 12 rounds)

Layer 3: Authorization
├─ Role-based access (student, barber, admin)
├─ Smart contract access control (Move asserts)
├─ API endpoint guards (middleware)
└─ Resource ownership validation

Layer 4: Data Protection
├─ Private keys in KMS (encrypted at rest)
├─ Deterministic key derivation (HKDF)
├─ Sensitive data encryption (AES-256)
└─ No PII on blockchain (only addresses)

Layer 5: Input Validation
├─ Request body validation (Zod schemas)
├─ SQL injection N/A (no SQL database)
├─ XSS protection (React auto-escaping)
└─ CSRF tokens (state tokens)

Layer 6: Rate Limiting
├─ API: 100 requests/minute per IP
├─ Auth: 5 failed logins = 15-min lockout
├─ Blockchain: Platform pays gas (no user DDoS)
└─ Redis-based tracking

Layer 7: Monitoring
├─ Sentry (error tracking)
├─ Winston logs (audit trail)
├─ Aptos Explorer (transaction monitoring)
└─ Stripe Radar (fraud detection)
```

### **Threat Model & Mitigations**

| Threat | Mitigation |
|--------|------------|
| **Private key theft** | Keys encrypted in KMS, never logged, derived per-user |
| **Account takeover** | Email verification, JWT expiry, password strength requirements |
| **Payment fraud** | Stripe Radar, velocity checks, escrow system |
| **Smart contract exploit** | Audit before mainnet, access control, formal verification |
| **DDoS** | Rate limiting, Cloudflare, serverless auto-scaling |
| **Man-in-the-middle** | TLS 1.3, certificate pinning, HSTS headers |
| **Data breach** | No PII on-chain, encrypted backups, minimal data retention |

### **Compliance**

- **PCI DSS:** Stripe handles all card data (platform is compliant)
- **GDPR:** Right to erasure (delete account, but blockchain data immutable)
- **KYC/AML:** Required for barbers withdrawing >$600/month
- **Tax Reporting:** 1099 forms for US barbers earning >$600/year

---

## 🚀 Deployment Architecture

### **Development Environment**

```
Developer Machine
├─ Frontend: npm run dev (Vite dev server, port 3000)
├─ Backend: npm run dev (Nodemon, port 3001)
├─ Blockchain: Aptos Devnet
├─ IPFS: Local node or Pinata
└─ Database: Redis (local or Upstash free tier)
```

### **Staging Environment**

```
Vercel Staging
├─ Frontend: staging-campuscuts.vercel.app
├─ Backend: staging-api-campuscuts.vercel.app
├─ Blockchain: Aptos Devnet (faucet for testing)
├─ IPFS: Pinata (free tier)
└─ Payments: Stripe Test Mode
```

### **Production Environment**

```
Production Infrastructure
├─ Frontend
│  ├─ Hosting: Vercel (or IPFS via Fleek)
│  ├─ Domain: app.campuscuts.com
│  └─ CDN: Cloudflare (DDoS protection)
│
├─ Backend
│  ├─ Hosting: Vercel Serverless
│  ├─ Domain: api.campuscuts.com
│  ├─ Redis: Upstash (serverless)
│  └─ KMS: AWS KMS or Vercel Secrets
│
├─ Blockchain
│  ├─ Network: Aptos Mainnet
│  ├─ Contracts: Deployed & verified
│  └─ Indexer: Aptos Indexer API
│
├─ Storage
│  ├─ IPFS: Pinata (Picnic plan, $20/month)
│  └─ Gateway: Custom domain (ipfs.campuscuts.com)
│
└─ External Services
   ├─ Payments: Stripe (production mode)
   ├─ Email: SendGrid
   └─ Monitoring: Sentry
```

### **CI/CD Pipeline**

```yaml
# .github/workflows/deploy.yml

name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm install
      - run: npm test
      
  deploy-backend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - run: cd backend && vercel deploy --prod
      
  deploy-frontend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - run: cd web-app && npm run build
      - run: vercel deploy --prod
      
  deploy-contracts:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - run: cd contracts && aptos move publish
```

---

## 🔗 Integration Points

### **External API Integrations**

**1. Stripe API**

```typescript
// Payment Intent (deposit)
const intent = await stripe.paymentIntents.create({
  amount: 5000, // $50
  currency: 'usd',
  payment_method_types: ['card'],
  metadata: { email: 'student@university.edu' }
});

// Payout (withdrawal)
const payout = await stripe.payouts.create({
  amount: 3000,
  currency: 'usd',
  destination: barber.stripe_account_id
});

// Webhook handling
app.post('/api/webhooks/stripe', (req, res) => {
  const sig = req.headers['stripe-signature'];
  const event = stripe.webhooks.constructEvent(req.body, sig, secret);
  
  if (event.type === 'payment_intent.succeeded') {
    // Credit user's on-chain balance
  }
});
```

**2. Aptos SDK**

```typescript
import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';

const config = new AptosConfig({ network: Network.DEVNET });
const aptos = new Aptos(config);

// Submit transaction
const txn = await aptos.transaction.build.simple({
  sender: account.accountAddress,
  data: {
    function: `${MODULE}::bookings::create_booking`,
    typeArguments: [],
    functionArguments: [barberAddr, amount, fee, timestamp]
  }
});

const committedTxn = await aptos.signAndSubmitTransaction({
  signer: account,
  transaction: txn
});
```

**3. IPFS (Pinata)**

```typescript
import { PinataSDK } from 'pinata-web3';

const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT
});

// Upload file
const upload = await pinata.upload.file(file);
const cid = upload.IpfsHash; // "Qm..."

// Retrieve file URL
const url = await pinata.gateways.createSignedURL({
  cid: cid,
  expires: 3600 // 1 hour
});
```

---

## 📈 Scalability & Performance

### **Scalability Strategy**

**Current (MVP): 100-1,000 users**
```
Frontend: Static (infinite scale via CDN)
Backend: Serverless (auto-scales)
Blockchain: Aptos (5,000 TPS capacity)
IPFS: Pinata (99.9% uptime)
```

**Growth (1,000-10,000 users)**
```
Frontend: Same (no change needed)
Backend: Add more serverless functions
Blockchain: Same (< 1% of Aptos capacity)
IPFS: Upgrade to Growth plan ($40/month)
Cache: Upgrade Redis ($20/month)
```

**Scale (10,000-100,000 users)**
```
Frontend: Same
Backend: Consider dedicated servers or Kubernetes
Blockchain: Consider running own Aptos full node
IPFS: Dedicated IPFS cluster
Cache: Redis cluster (managed service)
CDN: Multi-region (Cloudflare Enterprise)
```

### **Performance Optimizations**

**1. Frontend**

```typescript
// Code splitting
const StudentDashboard = lazy(() => import('./pages/student/Dashboard'));

// Image optimization
<img 
  src={`https://ipfs.io/ipfs/${cid}`} 
  loading="lazy" 
  decoding="async" 
/>

// Service worker caching
workbox.routing.registerRoute(
  /^https:\/\/api\.campuscuts\.com/,
  new workbox.strategies.NetworkFirst({
    cacheName: 'api-cache',
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 5 * 60
      })
    ]
  })
);
```

**2. Backend**

```typescript
// Redis caching
const cacheMiddleware = async (req, res, next) => {
  const key = `cache:${req.path}:${JSON.stringify(req.query)}`;
  const cached = await redis.get(key);
  
  if (cached) {
    return res.json(JSON.parse(cached));
  }
  
  // Store original res.json
  const originalJson = res.json;
  res.json = function(data) {
    redis.setex(key, 300, JSON.stringify(data)); // 5 min TTL
    originalJson.call(this, data);
  };
  
  next();
};

// Use on expensive routes
app.get('/api/bookings-blockchain/list', cacheMiddleware, handler);
```

**3. Blockchain**

```typescript
// Batch queries
const [balances, bookings, reviews] = await Promise.all([
  aptos.view({ function: 'get_balance', arguments: [addr] }),
  aptos.view({ function: 'get_bookings', arguments: [addr] }),
  aptos.view({ function: 'get_reviews', arguments: [addr] })
]);

// Use indexer for complex queries
const result = await fetch('https://indexer.mainnet.aptoslabs.com/v1/graphql', {
  method: 'POST',
  body: JSON.stringify({
    query: `
      query GetBookings($address: String!) {
        bookings(where: {student_addr: {_eq: $address}}) {
          id
          amount
          status
          scheduled_time
        }
      }
    `,
    variables: { address: userAddr }
  })
});
```

---

## 🎯 Summary

### **Key Architecture Highlights**

```
✅ Blockchain as Database
   - No PostgreSQL, no MongoDB
   - Aptos stores all critical data
   - 92% cheaper than traditional stack

✅ Custodial Wallet Abstraction
   - Users never see crypto
   - Platform manages keys securely
   - Fiat in, fiat out (USD only)

✅ Optimistic UI
   - Instant user feedback
   - Blockchain confirmations hidden
   - Web2 UX, Web3 backend

✅ Serverless Architecture
   - Minimal infrastructure costs
   - Auto-scaling
   - Pay-per-use

✅ Decentralized Storage
   - IPFS for all media
   - Permanent, censorship-resistant
   - No S3, no cloud storage bills

✅ Security First
   - KMS-encrypted keys
   - PCI-compliant payments
   - Smart contract access control
   - Comprehensive monitoring
```

### **Technology Summary**

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Database** | Aptos Blockchain | Balances, bookings, reviews |
| **Storage** | IPFS (Pinata) | Images, text, media |
| **Cache** | Redis (Upstash) | Query performance |
| **Backend** | Node.js + Express | API, signing, bridge |
| **Frontend** | React + Vite | User interface |
| **Payments** | Stripe | Fiat on/off-ramp |
| **Hosting** | Vercel (serverless) | Application layer |

### **Cost Summary (Monthly)**

```
MVP Configuration:
├─ Aptos gas: $15/month
├─ IPFS: $0/month (free tier)
├─ Backend: $0/month (free tier)
├─ Frontend: $0/month (free tier)
├─ Redis: $0/month (free tier)
└─ Total: $15/month

Production Configuration:
├─ Aptos gas: $15/month
├─ IPFS: $20/month
├─ Backend: $20/month
├─ Frontend: $0/month
├─ Redis: $10/month
├─ Monitoring: $26/month
├─ Email: $15/month
└─ Total: $106/month

vs Traditional Stack: $700/month
Savings: 85% ($594/month)
```

---

**CampusCuts: Web2 simplicity, Web3 power, 92% cost savings.** 🚀

