# CampusCuts System Overview
## Complete Technical Specification for Replication

**Version:** 1.0  
**Date:** December 2024  
**Purpose:** Enable junior engineers to replicate this system for other service verticals (e.g., manicures, massages, tutoring)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Architecture](#system-architecture)
3. [Technology Stack](#technology-stack)
4. [Core Concepts](#core-concepts)
5. [User Flows](#user-flows)
6. [Database Schema](#database-schema)
7. [Backend API Reference](#backend-api-reference)
8. [Frontend Architecture](#frontend-architecture)
9. [Blockchain Integration](#blockchain-integration)
10. [Payment Processing](#payment-processing)
11. [Admin Dashboard](#admin-dashboard)
12. [Deployment Guide](#deployment-guide)
13. [Adaptation Guide](#adaptation-guide)

---

## 1. Executive Summary

### What is CampusCuts?

CampusCuts is a **campus-based service marketplace** that connects students with barbers using blockchain technology for transparent, trustless transactions. It's designed to operate across multiple universities with isolated data per campus.

### Key Value Propositions

1. **For Students:**
   - Find vetted barbers on campus
   - Pay with credit card (Stripe)
   - Transparent pricing with dynamic adjustments
   - Review system with on-chain immutability

2. **For Barbers:**
   - Get discovered by students
   - Receive payments directly to wallet
   - Withdraw earnings to bank account
   - Build reputation through blockchain reviews

3. **For Platform:**
   - 5% commission on all transactions
   - Campus-specific analytics
   - User management and moderation
   - Blockchain-backed transparency

### System Characteristics

- **Multi-tenant:** Multiple campuses, logically separated
- **Hybrid Architecture:** PostgreSQL cache + Aptos blockchain source of truth
- **Payment Flow:** Fiat (Stripe) → USDC → Escrow → Barber → Bank (Stripe Connect)
- **Real-time:** Socket.IO for live updates
- **Progressive Web App:** Works on mobile and desktop

---

## 2. System Architecture

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                        │
│  - Student Dashboard  - Barber Dashboard  - Admin Dashboard     │
│  - PWA Capabilities   - Real-time Updates  - Responsive UI      │
└────────────┬────────────────────────────────────┬───────────────┘
             │                                    │
             │ REST APIs                          │ Socket.IO
             │                                    │
┌────────────▼────────────────────────────────────▼───────────────┐
│                       BACKEND (Node.js/Express)                 │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  Auth & User │  │   Bookings   │  │   Payments   │         │
│  │  Management  │  │   & Escrow   │  │   (Stripe)   │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Reviews    │  │  Dynamic      │  │    Admin     │         │
│  │   & IPFS     │  │  Pricing      │  │  Controls    │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└────────┬─────────────────┬────────────────────┬────────────────┘
         │                 │                    │
         │                 │                    │
┌────────▼─────┐  ┌────────▼────────┐  ┌───────▼────────┐
│  PostgreSQL  │  │ Aptos Blockchain │  │     Redis      │
│   (Cache)    │  │  (Source Truth)  │  │   (Sessions)   │
└──────────────┘  └──────────────────┘  └────────────────┘
                          │
                          │
                  ┌───────▼────────┐
                  │  IPFS (Pinata) │
                  │  Media Storage │
                  └────────────────┘
```

### Data Flow: Booking a Haircut

```
1. Student browses barbers → Frontend fetches from PostgreSQL cache
2. Student books haircut → Backend validates availability
3. Student pays via Stripe → Stripe webhook receives confirmation
4. Backend converts USD to USDC → Mints on-chain tokens
5. Smart contract locks USDC in escrow → Blockchain transaction
6. Barber completes haircut → Marks booking complete on-chain
7. Smart contract releases funds → 95% to barber, 5% to platform
8. Barber withdraws → Stripe Connect payout to bank account
9. Student leaves review → Text stored on IPFS, hash on-chain
10. PostgreSQL cache updates → Real-time UI refresh via Socket.IO
```

---

## 3. Technology Stack

### Frontend

| Technology | Purpose | Why We Use It |
|------------|---------|---------------|
| **React 18** | UI Framework | Component-based, ecosystem, hiring |
| **TypeScript** | Type Safety | Catch errors early, better DX |
| **Vite** | Build Tool | Fast HMR, modern bundling |
| **React Router** | Navigation | SPA routing with nested routes |
| **TailwindCSS** | Styling | Utility-first, rapid prototyping |
| **React Query** | Data Fetching | Caching, optimistic updates |
| **Socket.IO Client** | Real-time | Live transaction feed |
| **Lucide Icons** | Icons | Lightweight, tree-shakable |
| **Aptos Wallet Adapter** | Wallet Connection | Multi-wallet support |

### Backend

| Technology | Purpose | Why We Use It |
|------------|---------|---------------|
| **Node.js 20** | Runtime | JavaScript everywhere, async I/O |
| **Express.js** | Web Framework | Minimal, flexible, ecosystem |
| **TypeScript** | Type Safety | Shared types with frontend |
| **PostgreSQL 15** | Cache DB | ACID, performance, analytics |
| **Aptos SDK** | Blockchain | Interact with Aptos smart contracts |
| **Stripe SDK** | Payments | Fiat on-ramp/off-ramp |
| **Socket.IO** | Real-time | Bidirectional event-based communication |
| **Redis** | Session Store | Fast in-memory cache |
| **Pinata SDK** | IPFS | Decentralized media storage |
| **bcrypt** | Password Hashing | Secure credential storage |
| **JWT** | Authentication | Stateless auth tokens |

### Blockchain

| Technology | Purpose | Why We Use It |
|------------|---------|---------------|
| **Aptos** | Layer 1 Blockchain | Parallel execution, low fees, Move language |
| **Move** | Smart Contract Language | Resource-oriented, safety-first |
| **USDC** | Stablecoin | Price stability for payments |

### DevOps

| Technology | Purpose |
|------------|---------|
| **Docker** | Containerization |
| **GitHub Actions** | CI/CD |
| **Vercel** | Frontend hosting |
| **AWS Lambda** | Serverless backend (optional) |
| **Nginx** | Reverse proxy |

---

## 4. Core Concepts

### 4.1 Multi-Tenancy (Campus Isolation)

**Implementation:**
- Each campus has a unique `campus_id` (e.g., `campus-1`, `campus-2`)
- All database queries filter by `campus_id`
- Blockchain addresses prefixed by campus for organization
- Admin dashboard shows per-campus analytics

**Example:**
```sql
-- All queries include campus filter
SELECT * FROM bookings WHERE campus_id = 'campus-1' AND status = 'pending';
```

### 4.2 Hybrid Architecture

**Why Hybrid?**
- **Blockchain:** Source of truth, immutable, transparent
- **PostgreSQL:** Fast queries, analytics, caching
- **Redis:** Session management, real-time data

**Sync Flow:**
```javascript
// Cron job runs hourly
async function syncBlockchainToPostgres() {
  // 1. Fetch new transactions from Aptos
  const txs = await aptos.getTransactions({ start: lastSyncedVersion });
  
  // 2. Parse and insert into PostgreSQL
  for (const tx of txs) {
    await db.query('INSERT INTO bookings (...) VALUES (...) ON CONFLICT DO UPDATE');
  }
  
  // 3. Update last synced version
  await redis.set('last_synced_version', txs[txs.length - 1].version);
}
```

### 4.3 Escrow System

**Smart Contract Flow:**
```move
// bookings.move (Aptos Move)
public entry fun create_booking(
    student: &signer,
    barber_addr: address,
    amount_total: u64,
    service_id: u64
) {
    // 1. Calculate platform fee (5%)
    let platform_fee = amount_total * 500 / 10000; // 5% in basis points
    let barber_amount = amount_total - platform_fee;
    
    // 2. Lock funds in escrow
    let escrow = Escrow {
        student: signer::address_of(student),
        barber: barber_addr,
        amount: barber_amount,
        platform_fee,
        status: PENDING,
    };
    
    // 3. Store on-chain
    move_to(student, escrow);
}

public entry fun complete_booking(
    barber: &signer,
    booking_id: u64
) acquires Escrow {
    // 1. Verify barber
    let escrow = borrow_global_mut<Escrow>(booking_addr);
    assert!(escrow.barber == signer::address_of(barber), ERROR_UNAUTHORIZED);
    
    // 2. Release funds
    coin::transfer<USDC>(escrow.student, escrow.barber, escrow.amount);
    coin::transfer<USDC>(escrow.student, @platform_admin, escrow.platform_fee);
    
    // 3. Update status
    escrow.status = COMPLETED;
}
```

### 4.4 Dynamic Pricing

**Formula:**
```javascript
finalPrice = basePrice 
  × qualityMultiplier      // (0.8 - 1.2) based on rating + completion rate
  × supplyDemandMultiplier // (0.9 - 1.3) based on barber availability + demand
  × timeOfDayMultiplier    // (0.9 - 1.1) peak hours cost more
  × marketMultiplier;      // (0.95 - 1.05) campus-specific adjustment
```

**Example:**
```javascript
// Base price: $35
// 4.9★ rating → 1.15x quality
// High demand → 1.2x supply/demand
// Off-peak (10am) → 0.95x time
// Competitive market → 1.0x market
// = $35 × 1.15 × 1.2 × 0.95 × 1.0 = $46.17
```

---

## 5. User Flows

### 5.1 Student Booking Flow

```mermaid
graph TD
    A[Student Login] --> B[Browse Barbers]
    B --> C{Filter by specialty?}
    C -->|Yes| D[Apply Filters]
    C -->|No| E[View All Barbers]
    D --> E
    E --> F[Select Barber]
    F --> G[View Barber Profile]
    G --> H[Choose Service & Time]
    H --> I[See Dynamic Price]
    I --> J{Confirm?}
    J -->|No| G
    J -->|Yes| K[Enter Payment Details]
    K --> L[Stripe Processes Payment]
    L --> M[Backend Mints USDC]
    M --> N[Smart Contract Locks Escrow]
    N --> O[Booking Confirmed]
    O --> P[Receive Confirmation Email]
    P --> Q[Wait for Appointment]
    Q --> R[Barber Completes Service]
    R --> S[Funds Released to Barber]
    S --> T[Prompt to Leave Review]
    T --> U[Write Review]
    U --> V[Upload to IPFS]
    V --> W[Store Hash On-Chain]
```

### 5.2 Barber Registration Flow

```mermaid
graph TD
    A[Barber Signup] --> B[Enter Basic Info]
    B --> C[Upload Profile Photo]
    C --> D[Add Specialties]
    D --> E[Set Base Prices]
    E --> F[Verify Educational Email]
    F --> G[Admin Reviews Application]
    G --> H{Approved?}
    H -->|No| I[Rejection Email]
    H -->|Yes| J[Stripe Connect Onboarding]
    J --> K[Link Bank Account]
    K --> L[Create Custodial Wallet]
    L --> M[Register On-Chain User]
    M --> N[Barber Dashboard Access]
    N --> O[Set Availability]
    O --> P[Start Accepting Bookings]
```

### 5.3 Payment Flow (Detailed)

```
┌─────────────┐
│   Student   │
└──────┬──────┘
       │ 1. Book haircut ($35)
       ▼
┌─────────────┐
│   Stripe    │ 2. Charge credit card
└──────┬──────┘
       │ 3. Webhook: payment_intent.succeeded
       ▼
┌─────────────┐
│   Backend   │ 4. Convert $35 → 35 USDC (simulate)
└──────┬──────┘
       │ 5. Call smart contract
       ▼
┌─────────────┐
│  Aptos SC   │ 6. Lock 35 USDC in escrow
│             │    - 33.25 USDC → Barber (95%)
│             │    - 1.75 USDC → Platform (5%)
└──────┬──────┘
       │ (Service happens in real world)
       │
       │ 7. Barber marks complete
       ▼
┌─────────────┐
│  Aptos SC   │ 8. Release escrow
│             │    - Transfer 33.25 to barber wallet
│             │    - Transfer 1.75 to platform wallet
└──────┬──────┘
       │
       │ 9. Barber withdraws
       ▼
┌─────────────┐
│   Backend   │ 10. Convert USDC → USD (simulate)
└──────┬──────┘
       │ 11. Initiate Stripe Connect payout
       ▼
┌─────────────┐
│   Stripe    │ 12. Transfer to barber's bank
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Barber    │ Money in bank account
└─────────────┘
```

---

## 6. Database Schema

### PostgreSQL Tables

#### `users`
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL, -- 'student' | 'barber' | 'admin'
  campus_id VARCHAR(100) NOT NULL,
  wallet_address VARCHAR(66), -- Custodial wallet address
  phone VARCHAR(20),
  profile_photo_url TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  stripe_customer_id VARCHAR(255), -- For students
  stripe_connect_account_id VARCHAR(255), -- For barbers
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_campus (campus_id),
  INDEX idx_email (email),
  INDEX idx_role_campus (role, campus_id)
);
```

#### `barber_profiles`
```sql
CREATE TABLE barber_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  specialties TEXT[], -- ['Fades', 'Curly Hair']
  years_experience INTEGER,
  bio TEXT,
  base_price_cents INTEGER DEFAULT 3500, -- $35.00
  average_rating DECIMAL(3,2) DEFAULT 0.0,
  total_reviews INTEGER DEFAULT 0,
  total_bookings INTEGER DEFAULT 0,
  completion_rate DECIMAL(5,2) DEFAULT 100.0,
  response_time_minutes INTEGER DEFAULT 60,
  
  INDEX idx_user (user_id),
  INDEX idx_rating (average_rating DESC)
);
```

#### `bookings`
```sql
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_id VARCHAR(100) NOT NULL,
  student_id UUID REFERENCES users(id),
  barber_id UUID REFERENCES users(id),
  service_name VARCHAR(255) NOT NULL,
  service_description TEXT,
  scheduled_at TIMESTAMP NOT NULL,
  duration_minutes INTEGER DEFAULT 30,
  
  -- Pricing
  base_price_cents INTEGER NOT NULL,
  final_price_cents INTEGER NOT NULL,
  platform_fee_cents INTEGER NOT NULL,
  barber_payout_cents INTEGER NOT NULL,
  
  -- Status
  status VARCHAR(50) DEFAULT 'pending', -- pending | confirmed | in_progress | completed | cancelled
  
  -- Blockchain
  blockchain_tx_hash VARCHAR(66),
  escrow_address VARCHAR(66),
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  confirmed_at TIMESTAMP,
  completed_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  
  INDEX idx_campus_status (campus_id, status),
  INDEX idx_student (student_id, created_at DESC),
  INDEX idx_barber (barber_id, scheduled_at),
  INDEX idx_scheduled (scheduled_at)
);
```

#### `reviews`
```sql
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id),
  student_id UUID REFERENCES users(id),
  barber_id UUID REFERENCES users(id),
  
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  
  -- IPFS
  ipfs_cid VARCHAR(255), -- Content hash on IPFS
  
  -- Blockchain
  blockchain_tx_hash VARCHAR(66),
  
  is_visible BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_barber_rating (barber_id, rating DESC),
  INDEX idx_booking (booking_id)
);
```

#### `transactions`
```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_id VARCHAR(100) NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'payment' | 'withdrawal' | 'refund'
  
  from_user_id UUID REFERENCES users(id),
  to_user_id UUID REFERENCES users(id),
  
  amount_cents INTEGER NOT NULL,
  currency VARCHAR(10) DEFAULT 'USD',
  
  -- External references
  stripe_payment_intent_id VARCHAR(255),
  blockchain_tx_hash VARCHAR(66),
  
  status VARCHAR(50) DEFAULT 'pending',
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_campus_type (campus_id, type),
  INDEX idx_user_from (from_user_id, created_at DESC),
  INDEX idx_user_to (to_user_id, created_at DESC)
);
```

### Blockchain Schema (Aptos Move)

#### `user_accounts.move`
```move
struct UserAccount has key {
    owner: address,
    email_hash: vector<u8>,
    campus_id: u64,
    role: u8, // 0 = student, 1 = barber, 2 = admin
    reputation_score: u64,
    total_transactions: u64,
    is_active: bool,
    created_at: u64,
}
```

#### `bookings.move`
```move
struct Booking has key, store {
    id: u64,
    student: address,
    barber: address,
    service_id: u64,
    amount_total: u64,
    platform_fee: u64,
    barber_payout: u64,
    status: u8, // 0 = pending, 1 = confirmed, 2 = completed, 3 = cancelled
    scheduled_at: u64,
    created_at: u64,
    completed_at: u64,
}

struct Escrow has key {
    booking_id: u64,
    amount: u64,
    locked_until: u64,
}
```

#### `reviews.move`
```move
struct Review has key, store {
    id: u64,
    booking_id: u64,
    student: address,
    barber: address,
    rating: u8, // 1-5
    ipfs_cid: vector<u8>,
    created_at: u64,
}
```

---

## 7. Backend API Reference

### Base URL: `http://localhost:3001/api`

### Authentication

#### `POST /auth/signup`
**Register new user**

Request:
```json
{
  "email": "student@calpoly.edu",
  "password": "securePassword123",
  "name": "John Doe",
  "role": "student",
  "campus_id": "campus-1"
}
```

Response:
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "student@calpoly.edu",
    "name": "John Doe",
    "role": "student"
  },
  "token": "jwt_token_here"
}
```

#### `POST /auth/login`
**Authenticate user**

Request:
```json
{
  "email": "student@calpoly.edu",
  "password": "securePassword123"
}
```

Response:
```json
{
  "success": true,
  "token": "jwt_token_here",
  "user": { /* user object */ }
}
```

### Bookings

#### `GET /bookings`
**Get user's bookings**

Headers: `Authorization: Bearer {token}`

Query Params:
- `status` (optional): Filter by status
- `limit` (optional): Number of results (default: 20)

Response:
```json
{
  "success": true,
  "bookings": [
    {
      "id": "uuid",
      "barber": {
        "name": "Marcus Thompson",
        "avatar": "url"
      },
      "service_name": "Fade Haircut",
      "scheduled_at": "2024-12-15T14:00:00Z",
      "final_price_cents": 3500,
      "status": "confirmed"
    }
  ]
}
```

#### `POST /bookings`
**Create new booking**

Headers: `Authorization: Bearer {token}`

Request:
```json
{
  "barber_id": "uuid",
  "service_name": "Fade Haircut",
  "scheduled_at": "2024-12-15T14:00:00Z",
  "payment_method_id": "pm_xxxxx" // Stripe payment method
}
```

Response:
```json
{
  "success": true,
  "booking": {
    "id": "uuid",
    "status": "pending",
    "blockchain_tx_hash": "0x..."
  },
  "payment_intent": { /* Stripe payment intent */ }
}
```

#### `PUT /bookings/:id/complete`
**Mark booking as complete (barber only)**

Headers: `Authorization: Bearer {token}`

Response:
```json
{
  "success": true,
  "booking": { /* updated booking */ },
  "transaction": {
    "hash": "0x...",
    "released_amount": 3325,
    "platform_fee": 175
  }
}
```

### Reviews

#### `POST /reviews`
**Submit review**

Headers: `Authorization: Bearer {token}`

Request:
```json
{
  "booking_id": "uuid",
  "rating": 5,
  "review_text": "Great haircut! Very professional."
}
```

Response:
```json
{
  "success": true,
  "review": {
    "id": "uuid",
    "ipfs_cid": "QmXxx...",
    "blockchain_tx_hash": "0x..."
  }
}
```

#### `GET /reviews/barber/:barberId`
**Get barber's reviews**

Response:
```json
{
  "success": true,
  "reviews": [
    {
      "id": "uuid",
      "rating": 5,
      "review_text": "Great service!",
      "student_name": "Anonymous",
      "created_at": "2024-12-10T10:00:00Z"
    }
  ],
  "average_rating": 4.8,
  "total_reviews": 156
}
```

### Barbers

#### `GET /barbers`
**Search barbers**

Query Params:
- `campus_id`: Required
- `specialty` (optional): Filter by specialty
- `min_rating` (optional): Minimum rating
- `available_at` (optional): ISO timestamp

Response:
```json
{
  "success": true,
  "barbers": [
    {
      "id": "uuid",
      "name": "Marcus Thompson",
      "specialties": ["Fades", "Curly Hair"],
      "average_rating": 4.9,
      "total_reviews": 156,
      "base_price_cents": 3500,
      "current_price_cents": 4200,
      "profile_photo_url": "url",
      "next_available": "2024-12-15T10:00:00Z"
    }
  ]
}
```

### Admin

#### `GET /admin/transactions`
**Get campus transactions (admin only)**

Headers: `Authorization: Bearer {token}`

Query Params:
- `campus`: Campus ID
- `limit`: Number of results

Response:
```json
{
  "success": true,
  "transactions": [
    {
      "id": "uuid",
      "type": "payment",
      "amount": 35.00,
      "from": "Alice Smith",
      "to": "Marcus Thompson",
      "status": "completed",
      "timestamp": "2024-12-11T10:30:00Z"
    }
  ]
}
```

#### `GET /admin/users/:userId`
**Get user details (admin only)**

Response:
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "name": "Marcus Thompson",
    "email": "marcus@calpoly.edu",
    "role": "barber",
    "status": "active",
    "total_bookings": 156,
    "total_earned": 5460.00
  },
  "activityLogs": [ /* recent activities */ ],
  "transactions": [ /* transaction history */ ]
}
```

#### `PUT /admin/users/:userId/status`
**Update user status**

Request:
```json
{
  "status": "blocked" // active | blocked | suspended | banned
}
```

---

## 8. Frontend Architecture

### Project Structure

```
web-app/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Loading.tsx
│   │   ├── AdminWalletConnect.tsx
│   │   ├── RealtimeTransactionFeed.tsx
│   │   └── ...
│   ├── pages/              # Route pages
│   │   ├── admin/
│   │   │   ├── AdminDashboard.tsx
│   │   │   ├── AdminUserView.tsx
│   │   │   └── AdminCampusDashboard.tsx
│   │   ├── student/
│   │   │   ├── StudentDashboard.tsx
│   │   │   ├── BarberDetailPage.tsx
│   │   │   └── BookingsPage.tsx
│   │   ├── barber/
│   │   │   ├── BarberDashboard.tsx
│   │   │   └── BarberEarningsPage.tsx
│   │   ├── auth/
│   │   │   ├── LoginPage.tsx
│   │   │   └── SignupPage.tsx
│   │   └── RoleSelectionPage.tsx
│   ├── services/           # API clients
│   │   ├── api.service.ts
│   │   ├── socket.service.ts
│   │   └── wallet.service.ts
│   ├── hooks/              # Custom React hooks
│   │   ├── useAuth.ts
│   │   ├── useBookings.ts
│   │   └── useSocket.ts
│   ├── types/              # TypeScript definitions
│   │   └── index.ts
│   ├── utils/              # Utility functions
│   │   └── helpers.ts
│   ├── App.tsx             # Main app component
│   └── main.tsx            # Entry point
├── public/
│   ├── manifest.json       # PWA manifest
│   └── service-worker.js   # PWA service worker
└── index.html
```

### Key Components

#### Button Component
```typescript
// components/Button.tsx
interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

export default function Button({ 
  children, 
  variant = 'primary', 
  ...props 
}: ButtonProps) {
  const baseClasses = 'px-4 py-2 rounded-lg font-semibold transition-colors';
  const variantClasses = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300',
    danger: 'bg-red-600 text-white hover:bg-red-700'
  };
  
  return (
    <button 
      className={`${baseClasses} ${variantClasses[variant]} ${props.className}`}
      {...props}
    >
      {children}
    </button>
  );
}
```

#### Real-time Transaction Feed
```typescript
// components/RealtimeTransactionFeed.tsx
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

export function RealtimeTransactionFeed({ campusId }: { campusId: string }) {
  const [transactions, setTransactions] = useState([]);
  
  useEffect(() => {
    const socket = io('http://localhost:3001');
    
    socket.on('connect', () => {
      socket.emit('join-campus', campusId);
    });
    
    socket.on('blockchain-transaction', (tx) => {
      setTransactions(prev => [tx, ...prev].slice(0, 20));
    });
    
    return () => socket.disconnect();
  }, [campusId]);
  
  return (
    <div>
      <h3>Live Transactions</h3>
      {transactions.map(tx => (
        <div key={tx.id}>
          {tx.from} → {tx.to}: ${tx.amount}
        </div>
      ))}
    </div>
  );
}
```

### Routing Structure

```typescript
// App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RoleSelectionPage />} />
        
        {/* Student Routes */}
        <Route path="/student" element={<StudentDashboard />} />
        <Route path="/student/barbers/:id" element={<BarberDetailPage />} />
        <Route path="/student/bookings" element={<BookingsPage />} />
        
        {/* Barber Routes */}
        <Route path="/barber" element={<BarberDashboard />} />
        <Route path="/barber/earnings" element={<EarningsPage />} />
        
        {/* Admin Routes */}
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/user/:userId" element={<AdminUserView />} />
        <Route path="/admin/campus/:campusId" element={<CampusDashboard />} />
        
        {/* Auth Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
      </Routes>
    </BrowserRouter>
  );
}
```

---

## 9. Blockchain Integration

### Smart Contract Deployment

#### Deploy to Aptos Testnet

```bash
# 1. Install Aptos CLI
curl -fsSL "https://aptos.dev/scripts/install_cli.py" | python3

# 2. Initialize account
aptos init

# 3. Compile contracts
cd contracts
aptos move compile

# 4. Deploy
aptos move publish --named-addresses campuscuts=YOUR_ADDRESS
```

#### Smart Contract Functions

**Create Booking:**
```typescript
// backend/src/services/blockchain.service.ts
async function createBookingOnChain(
  studentWallet: string,
  barberAddress: string,
  amount: number,
  serviceId: number
) {
  const payload = {
    function: `${MODULE_ADDRESS}::bookings::create_booking`,
    type_arguments: [],
    arguments: [
      barberAddress,
      amount * 100, // Convert to cents
      serviceId
    ]
  };
  
  const txn = await aptos.generateTransaction(studentWallet, payload);
  const signedTxn = await signTransaction(txn, studentPrivateKey);
  const result = await aptos.submitTransaction(signedTxn);
  
  return result.hash;
}
```

**Complete Booking:**
```typescript
async function completeBookingOnChain(
  barberWallet: string,
  bookingId: number
) {
  const payload = {
    function: `${MODULE_ADDRESS}::bookings::complete_booking`,
    type_arguments: [],
    arguments: [bookingId]
  };
  
  const txn = await aptos.generateTransaction(barberWallet, payload);
  const signedTxn = await signTransaction(txn, barberPrivateKey);
  const result = await aptos.submitTransaction(signedTxn);
  
  return result.hash;
}
```

### IPFS Integration

```typescript
// backend/src/services/ipfs.service.ts
import pinataSDK from '@pinata/sdk';

const pinata = new pinataSDK(process.env.PINATA_API_KEY, process.env.PINATA_SECRET);

async function uploadReviewToIPFS(review: {
  rating: number;
  text: string;
  bookingId: string;
}) {
  const result = await pinata.pinJSONToIPFS({
    rating: review.rating,
    review: review.text,
    booking: review.bookingId,
    timestamp: Date.now()
  });
  
  return result.IpfsHash; // QmXxx...
}

async function getReviewFromIPFS(cid: string) {
  const response = await fetch(`https://gateway.pinata.cloud/ipfs/${cid}`);
  return response.json();
}
```

---

## 10. Payment Processing

### Stripe Integration

#### Customer Payments (Student)

```typescript
// backend/src/services/stripe.service.ts
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function createPaymentIntent(
  studentId: string,
  amount: number,
  bookingId: string
) {
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amount * 100, // Convert to cents
    currency: 'usd',
    customer: student.stripe_customer_id,
    metadata: {
      booking_id: bookingId,
      student_id: studentId
    }
  });
  
  return paymentIntent;
}
```

#### Stripe Connect (Barber Payouts)

```typescript
async function onboardBarber(barberId: string) {
  // 1. Create Connected Account
  const account = await stripe.accounts.create({
    type: 'express',
    country: 'US',
    email: barber.email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true }
    }
  });
  
  // 2. Create onboarding link
  const accountLink = await stripe.accountLinks.create({
    account: account.id,
    refresh_url: 'https://campuscuts.com/barber/onboarding/refresh',
    return_url: 'https://campuscuts.com/barber/dashboard',
    type: 'account_onboarding'
  });
  
  // 3. Save account ID
  await db.query(
    'UPDATE users SET stripe_connect_account_id = $1 WHERE id = $2',
    [account.id, barberId]
  );
  
  return accountLink.url;
}

async function payoutToBarber(
  barberId: string,
  amount: number
) {
  const transfer = await stripe.transfers.create({
    amount: amount * 100,
    currency: 'usd',
    destination: barber.stripe_connect_account_id,
    metadata: {
      barber_id: barberId
    }
  });
  
  return transfer;
}
```

#### Webhook Handling

```typescript
// backend/src/routes/webhook.routes.ts
app.post('/api/webhooks/stripe', 
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];
    
    try {
      const event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
      
      switch (event.type) {
        case 'payment_intent.succeeded':
          await handlePaymentSuccess(event.data.object);
          break;
        
        case 'payment_intent.payment_failed':
          await handlePaymentFailed(event.data.object);
          break;
        
        case 'account.updated':
          await handleAccountUpdated(event.data.object);
          break;
      }
      
      res.json({ received: true });
    } catch (err) {
      res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }
);
```

---

## 11. Admin Dashboard

### Features

1. **Campus Overview**
   - Select campus from list
   - View aggregate stats
   - Transaction volume charts

2. **Real-time Transaction Feed**
   - Live Socket.IO updates
   - Filter by campus
   - Clickable user names

3. **User Management**
   - View all barbers and students
   - Click name → Admin User View
   - Modify user status (active, blocked, banned)
   - Add admin notes
   - Reset passwords

4. **Analytics**
   - Revenue per campus
   - Top performing barbers
   - Student engagement metrics
   - Booking completion rates

### Admin Controls

```typescript
// Admin User View Actions
const adminActions = {
  // Status Management
  setActive: (userId) => PUT /admin/users/:userId/status { status: 'active' },
  blockUser: (userId) => PUT /admin/users/:userId/status { status: 'blocked' },
  suspendUser: (userId) => PUT /admin/users/:userId/status { status: 'suspended' },
  banUser: (userId) => PUT /admin/users/:userId/status { status: 'banned' },
  
  // Verification
  toggleVerification: (userId) => PUT /admin/users/:userId/verification,
  
  // Notes
  addNote: (userId, note) => POST /admin/users/:userId/notes { note },
  
  // Account Actions
  resetPassword: (userId) => POST /admin/users/:userId/reset-password,
  deleteAccount: (userId) => DELETE /admin/users/:userId
};
```

---

## 12. Deployment Guide

### Environment Variables

#### Backend `.env`
```bash
# Server
NODE_ENV=production
PORT=3001

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/campuscuts
REDIS_URL=redis://localhost:6379

# Blockchain
APTOS_NODE_URL=https://fullnode.mainnet.aptoslabs.com/v1
MODULE_ADDRESS=0x1234...
GAS_WALLET_PRIVATE_KEY=0xabcd...

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# IPFS
PINATA_API_KEY=your_key
PINATA_SECRET=your_secret

# JWT
JWT_SECRET=your_very_long_random_secret_key_here

# Email (optional)
SMTP_HOST=smtp.gmail.com
SMTP_USER=noreply@campuscuts.com
SMTP_PASS=your_password
```

#### Frontend `.env`
```bash
VITE_API_URL=https://api.campuscuts.com
VITE_APTOS_NODE_URL=https://fullnode.mainnet.aptoslabs.com/v1
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

### Docker Deployment

#### `docker-compose.yml`
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: campuscuts
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
  
  redis:
    image: redis:7
    ports:
      - "6379:6379"
  
  backend:
    build: ./backend
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://postgres:password@postgres:5432/campuscuts
      REDIS_URL: redis://redis:6379
    ports:
      - "3001:3001"
    depends_on:
      - postgres
      - redis
  
  frontend:
    build: ./web-app
    ports:
      - "3000:80"
    depends_on:
      - backend

volumes:
  postgres_data:
```

### CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Build Backend
        run: |
          cd backend
          npm install
          npm run build
      
      - name: Build Frontend
        run: |
          cd web-app
          npm install
          npm run build
      
      - name: Deploy to AWS
        run: |
          # Your deployment commands
          aws s3 sync web-app/dist s3://campuscuts-frontend
          aws lambda update-function-code --function-name campuscuts-api
```

---

## 13. Adaptation Guide

### How to Create "CampusNails" (Manicure Version)

#### Step 1: Rename Core Entities

| CampusCuts | CampusNails |
|------------|-------------|
| Barber | Nail Technician |
| Haircut | Manicure/Pedicure |
| Specialties: Fades, Curly Hair | Specialties: Gel, Acrylic, Nail Art |
| Service Duration: 30 min | Service Duration: 60 min |

#### Step 2: Update Database Schema

```sql
-- Change table/column names
ALTER TABLE barber_profiles RENAME TO technician_profiles;
ALTER TABLE bookings RENAME COLUMN barber_id TO technician_id;

-- Add nail-specific fields
ALTER TABLE technician_profiles ADD COLUMN nail_art_portfolio TEXT[];
ALTER TABLE bookings ADD COLUMN service_type VARCHAR(50); -- manicure | pedicure | both
ALTER TABLE bookings ADD COLUMN nail_length VARCHAR(20); -- short | medium | long
```

#### Step 3: Update Smart Contracts

```move
// Change module names
module campusnails::bookings {
    struct Booking has key {
        id: u64,
        student: address,
        technician: address, // Changed from barber
        service_type: u8, // 0=manicure, 1=pedicure, 2=both
        // ... rest same
    }
}
```

#### Step 4: Update Frontend

```typescript
// Update terminology throughout
const ROLE_NAMES = {
  student: 'Student',
  technician: 'Nail Technician', // Changed from barber
  admin: 'Admin'
};

const SPECIALTIES = [
  'Gel Nails',
  'Acrylic',
  'Nail Art',
  'French Tips',
  'Pedicure'
  // Removed: Fades, Line-ups, etc.
];
```

#### Step 5: Adjust Business Logic

```typescript
// Update pricing
const BASE_PRICES = {
  manicure: 25, // Was haircut: 35
  pedicure: 40,
  both: 60
};

// Update service duration
const SERVICE_DURATIONS = {
  manicure: 45, // Was 30
  pedicure: 60,
  both: 90
};

// Update specialties
const TECHNICIAN_SPECIALTIES = [
  'Gel Nails',
  'Acrylic Extensions',
  'Nail Art',
  'French Manicure',
  'Spa Pedicure'
];
```

#### Step 6: Update UI Components

```typescript
// BarberCard.tsx → TechnicianCard.tsx
export function TechnicianCard({ technician }) {
  return (
    <Card>
      <h3>{technician.name}</h3>
      <div>Specialties: {technician.specialties.join(', ')}</div>
      <div>Starting at ${technician.base_price}</div>
      {/* Add nail art portfolio images */}
      <Gallery images={technician.portfolio} />
    </Card>
  );
}
```

#### Step 7: Keep Core Architecture

**Don't change:**
- Multi-campus isolation
- Blockchain escrow system
- 5% platform fee
- Stripe payment flow
- Admin dashboard structure
- Review system
- Real-time transaction feed

**These work for ANY service marketplace!**

#### Step 8: Customize Service Flow

```typescript
// Add nail-specific booking questions
const NailBookingForm = () => (
  <form>
    <Select label="Service Type">
      <option>Manicure Only</option>
      <option>Pedicure Only</option>
      <option>Both</option>
    </Select>
    
    <Select label="Nail Length">
      <option>Short</option>
      <option>Medium</option>
      <option>Long</option>
    </Select>
    
    <Select label="Polish Type">
      <option>Regular</option>
      <option>Gel</option>
      <option>Acrylic</option>
    </Select>
    
    {/* Keep existing: date, time, technician selection */}
  </form>
);
```

---

## Key Takeaways for Replication

### What to Keep Unchanged

1. **Architecture**
   - Multi-tenant campus isolation
   - Hybrid blockchain + PostgreSQL
   - Custodial wallet system
   - Stripe payment integration

2. **Core Features**
   - User authentication (students + providers)
   - Booking system with escrow
   - Review system with IPFS
   - Admin dashboard
   - Real-time updates
   - Dynamic pricing engine

3. **Technical Stack**
   - React + TypeScript frontend
   - Node.js + Express backend
   - PostgreSQL + Redis
   - Aptos blockchain
   - Socket.IO for real-time

### What to Customize

1. **Business Logic**
   - Service types and names
   - Pricing structure
   - Service duration
   - Provider specialties
   - Booking questions

2. **UI/UX**
   - Branding and colors
   - Service-specific forms
   - Portfolio/gallery displays
   - Terminology (barber → technician, etc.)

3. **Domain Models**
   - Database column names
   - Smart contract structs
   - Frontend type definitions

### Estimated Timeline for Replication

- **Junior Engineer:** 4-6 weeks
- **Senior Engineer:** 2-3 weeks

**Breakdown:**
1. Setup & Configuration: 2 days
2. Database Migration: 3 days
3. Smart Contract Updates: 3 days
4. Backend API Updates: 5 days
5. Frontend Updates: 10 days
6. Testing: 5 days
7. Deployment: 2 days

---

## Support & Resources

### Documentation Links
- Aptos: https://aptos.dev
- Stripe: https://stripe.com/docs
- React: https://react.dev
- PostgreSQL: https://www.postgresql.org/docs

### Common Pitfalls

1. **Forgetting Multi-Tenancy**
   - Always filter by `campus_id`
   - Test with multiple campuses

2. **Stripe Webhook Security**
   - Always verify webhook signatures
   - Use raw body parser

3. **Blockchain Gas Fees**
   - Platform pays gas for user transactions
   - Keep gas wallet funded

4. **IPFS Pinning**
   - Content must be pinned or it will disappear
   - Use Pinata for reliable pinning

---

## Conclusion

CampusCuts is a **production-ready, blockchain-powered service marketplace** designed for multi-campus deployment. Its architecture is flexible enough to support any service vertical (haircuts, nails, tutoring, etc.) while maintaining the core benefits of transparency, escrow safety, and decentralization.

**For Questions:** Review this document, then consult the codebase for implementation details.

**Good luck building your version!** 🚀

