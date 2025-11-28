# CampusCuts Frontend Documentation

**Version:** 2.0  
**Tech Stack:** React, TypeScript, Vite, Tailwind CSS  
**Architecture:** V2 Custodial Wallet Integration

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Services Layer](#services-layer)
5. [Components](#components)
6. [Pages](#pages)
7. [State Management](#state-management)
8. [API Integration](#api-integration)
9. [Deployment](#deployment)
10. [Development Guide](#development-guide)

---

## Architecture Overview

### Component Hierarchy

```
App.tsx (Router)
├── RoleSelectionPage (/)
├── ConsumerPage (/consumer)
│   ├── BarberCard[]
│   ├── SearchBar
│   └── FilterPanel
├── BarberPage (/barber)
│   ├── BalanceDisplay
│   ├── BookingsList
│   └── AnalyticsDashboard
├── WalletPage (/wallet)
│   ├── BalanceDisplay
│   ├── TransactionList
│   ├── EscrowList
│   └── WithdrawalOptions
└── AdminPage (/admin)
    ├── TreasurySection
    ├── FeesSection
    ├── ReconciliationSection
    ├── BatchesSection
    ├── UsersSection
    └── AuditSection
```

### Data Flow

```
User Action → Component → Service → API → Backend
            ↓
          State Update (Zustand/useState)
            ↓
          UI Re-render
```

---

## Tech Stack

### Core Technologies
- **React 18.3+** - UI library
- **TypeScript 5+** - Type safety
- **Vite 5** - Build tool & dev server
- **Tailwind CSS 3** - Styling framework

### Key Libraries
- **react-router-dom** - Client-side routing
- **zustand** - State management (lightweight)
- **axios** - HTTP client
- **react-hot-toast** - Toast notifications
- **lucide-react** - Icon library
- **date-fns** - Date manipulation

### Development Tools
- **ESLint** - Code linting
- **PostCSS** - CSS processing
- **Autoprefixer** - CSS vendor prefixes

---

## Project Structure

```
web-app/
├── public/
│   ├── manifest.json         # PWA manifest
│   ├── sw.js                 # Service worker
│   ├── icon-192x192.png      # PWA icon
│   └── icon-512x512.png      # PWA icon
├── src/
│   ├── assets/              # Static assets
│   │   ├── logos/           # Brand logos
│   │   ├── icons/           # Custom icons
│   │   └── index.ts         # Asset exports
│   ├── components/          # Reusable components
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Loading.tsx
│   │   ├── Navbar.tsx
│   │   ├── BalanceDisplay.tsx       # V2
│   │   ├── EscrowStatusBadge.tsx    # V2
│   │   └── WithdrawalOptions.tsx    # V2
│   ├── pages/               # Page components
│   │   ├── RoleSelectionPage.tsx
│   │   ├── ConsumerPage.tsx
│   │   ├── BarberPage.tsx
│   │   ├── WalletPage.tsx           # V2
│   │   └── AdminPage.tsx            # V2
│   ├── services/            # API client services
│   │   ├── api.service.ts           # Base API client
│   │   ├── barber.service.ts        # Barber operations
│   │   ├── wallet-v2.service.ts     # V2 Wallet
│   │   ├── booking-v2.service.ts    # V2 Bookings
│   │   └── admin.service.ts         # V2 Admin
│   ├── store/               # State management
│   │   ├── useAuthStore.ts
│   │   └── useMessageStore.ts
│   ├── types/               # TypeScript types
│   │   └── index.ts
│   ├── config/              # Configuration
│   │   └── constants.ts
│   ├── App.tsx              # Root component
│   ├── main.tsx             # Entry point
│   └── index.css            # Global styles
├── vite.config.ts           # Vite configuration
├── tsconfig.json            # TypeScript config
├── tailwind.config.cjs      # Tailwind config
└── package.json
```

---

## Services Layer

### 1. API Service (`api.service.ts`)

**Purpose:** Base HTTP client with interceptors

```typescript
class APIService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: 'http://localhost:3001/api',
      timeout: 10000,
    });

    // Request interceptor (add auth token)
    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Response interceptor (handle errors)
    this.client.interceptors.response.use(
      (response) => response.data,
      (error) => {
        if (error.response?.status === 401) {
          // Redirect to login
          window.location.href = '/';
        }
        return Promise.reject(error);
      }
    );
  }

  async get(url: string, config?) { ... }
  async post(url: string, data?, config?) { ... }
  async put(url: string, data?, config?) { ... }
  async delete(url: string, config?) { ... }
}
```

**Features:**
- Automatic auth token injection
- Error handling & retries
- Response unwrapping
- 401 redirect

### 2. Wallet V2 Service (`wallet-v2.service.ts`)

**Purpose:** V2 custodial wallet operations

```typescript
class WalletV2Service {
  // Get balance (available/pending/escrows)
  async getBalance(): Promise<WalletBalance>

  // Create deposit intent (Stripe Elements)
  async createDepositIntent(amountDollars: number): Promise<{
    clientSecret: string;
    paymentIntentId: string;
  }>

  // Get transaction history
  async getTransactionHistory(limit, offset): Promise<{
    transactions: Transaction[];
    total: number;
  }>

  // Withdraw to bank (instant)
  async withdrawToBank(amountDollars: number): Promise<{
    payout_id: string;
  }>

  // Withdraw on-chain (batched, 99.8% cheaper)
  async withdrawOnChain(
    amountDollars: number,
    destinationAddress: string,
    chain: string
  ): Promise<{
    queue_id: number;
    status: 'queued';
  }>

  // Send tip
  async sendTip(toUserId, amountDollars, bookingId?): Promise<void>

  // Get active escrows
  async getEscrows(status?): Promise<Escrow[]>

  // Get withdrawal history
  async getWithdrawalHistory(): Promise<WithdrawalRequest[]>
}
```

**Usage Example:**
```typescript
import walletV2Service from '@services/wallet-v2.service';

const WalletComponent = () => {
  const [balance, setBalance] = useState(null);

  useEffect(() => {
    walletV2Service.getBalance().then(setBalance);
  }, []);

  const handleWithdraw = async (amount: number) => {
    await walletV2Service.withdrawToBank(amount);
    toast.success('Withdrawal processed!');
    // Refresh balance
    const newBalance = await walletV2Service.getBalance();
    setBalance(newBalance);
  };

  return (
    <div>
      <p>Available: ${balance?.available_dollars}</p>
      <p>Pending: ${balance?.pending_dollars}</p>
      <button onClick={() => handleWithdraw(100)}>Withdraw $100</button>
    </div>
  );
};
```

### 3. Booking V2 Service (`booking-v2.service.ts`)

**Purpose:** Escrow-based booking flow

```typescript
class BookingV2Service {
  // Create booking (creates escrow hold)
  async createBooking(params: {
    barberId: string;
    serviceId?: string;
    priceCents: number;
    requestedSlot: string;
  }): Promise<{
    booking: BookingV2;
    escrow: EscrowDetails;
  }>

  // Get bookings
  async getBookings(status?: string): Promise<BookingV2[]>

  // Get booking by ID
  async getBookingById(bookingId: string): Promise<BookingV2>

  // Complete booking (release escrow to barber)
  async completeBooking(bookingId: string, tipCents?: number): Promise<{
    net_to_barber_dollars: number;
    platform_fee_dollars: number;
  }>

  // Cancel booking (refund escrow to consumer)
  async cancelBooking(bookingId: string, reason: string): Promise<{
    refund_amount_dollars: number;
  }>
}
```

**Usage Example:**
```typescript
import bookingV2Service from '@services/booking-v2.service';

const BookingFlow = () => {
  const handleBooking = async () => {
    const { booking, escrow } = await bookingV2Service.createBooking({
      barberId: selectedBarber.id,
      priceCents: 3000, // $30
      requestedSlot: '2025-12-01T10:00:00Z',
    });

    toast.success(
      `Booking created! Funds held in escrow (expires in 48 hours)`
    );
  };

  const handleComplete = async (bookingId: string) => {
    const result = await bookingV2Service.completeBooking(bookingId, 500); // $5 tip
    toast.success(`You earned $${result.net_to_barber_dollars}`);
  };

  return (
    <div>
      <button onClick={handleBooking}>Book Now</button>
      <button onClick={() => handleComplete('booking_id')}>Complete</button>
    </div>
  );
};
```

### 4. Admin Service (`admin.service.ts`)

**Purpose:** Platform management (admin-only)

```typescript
class AdminService {
  // Platform treasury
  async getTreasuryStats(): Promise<TreasuryStats>

  // Platform fees
  async getPlatformFees(): Promise<PlatformFees>
  async withdrawPlatformFees(amountDollars, destinationType, destinationId)

  // Reconciliation
  async runReconciliation(date?): Promise<ReconciliationReport>
  async getReconciliationReports(limit): Promise<ReconciliationReport[]>

  // Withdrawal batches
  async getWithdrawalBatches(): Promise<WithdrawalBatchStats>
  async processBatch(chain): Promise<any>

  // User management
  async getUserBalance(userId): Promise<UserBalance>
  async issueCredit(userId, amount, description): Promise<void>

  // Audit logs
  async getAuditLogs(limit, offset): Promise<{ logs: AuditLog[]; total: number }>
}
```

---

## Components

### 1. BalanceDisplay (`BalanceDisplay.tsx`)

**Purpose:** Show wallet balance with available/pending split

**Props:**
```typescript
interface BalanceDisplayProps {
  balance: WalletBalance;
  showDetails?: boolean;  // Show breakdown
  className?: string;
}
```

**Usage:**
```typescript
<BalanceDisplay
  balance={{
    available_dollars: 100,
    pending_dollars: 50,
    total_dollars: 150,
    active_escrows: 2,
  }}
  showDetails={true}
/>
```

**Features:**
- Visual breakdown (available/pending/escrows)
- Color-coded sections (green=available, yellow=pending)
- Active escrow count
- Info notes explaining pending funds

### 2. EscrowStatusBadge (`EscrowStatusBadge.tsx`)

**Purpose:** Visual escrow status indicator

**Props:**
```typescript
interface EscrowStatusBadgeProps {
  status: 'held' | 'released' | 'refunded' | 'expired';
  expiresAt?: string;
  className?: string;
}
```

**Usage:**
```typescript
<EscrowStatusBadge
  status="held"
  expiresAt="2025-12-01T10:00:00Z"
/>
```

**Features:**
- Color-coded badges
- Countdown timer for 'held' status
- Status descriptions
- Responsive design

### 3. WithdrawalOptions (`WithdrawalOptions.tsx`)

**Purpose:** Bank vs On-chain withdrawal interface

**Props:**
```typescript
interface WithdrawalOptionsProps {
  availableBalance: number;
  onSuccess?: () => void;
}
```

**Usage:**
```typescript
<WithdrawalOptions
  availableBalance={balance.available_dollars}
  onSuccess={() => {
    toast.success('Withdrawal processed!');
    loadBalance();
  }}
/>
```

**Features:**
- Two withdrawal methods (bank instant vs on-chain batched)
- Amount validation (min $10)
- Destination address input (on-chain)
- Visual comparison of methods
- Processing states

### Core Components (Existing)

**Button.tsx:**
```typescript
<Button variant="primary" onClick={handleClick}>
  Click Me
</Button>

// Variants: primary, secondary, danger
// Sizes: sm, md, lg
```

**Card.tsx:**
```typescript
<Card className="p-6">
  <h3>Card Title</h3>
  <p>Card content</p>
</Card>
```

**Loading.tsx:**
```typescript
<Loading />
// Centered spinner
```

**Navbar.tsx:**
```typescript
<Navbar />
// Site navigation with logo
```

---

## Pages

### 1. WalletPage (`WalletPage.tsx`)

**Route:** `/wallet`

**Purpose:** Complete wallet management

**Features:**
- **Overview Tab:** Balance summary + recent transactions
- **Transactions Tab:** Complete transaction history with filtering
- **Escrows Tab:** Active/past escrow holds management
- **Withdraw Tab:** Bank vs On-chain withdrawal interface

**State Management:**
```typescript
const [balance, setBalance] = useState<WalletBalance | null>(null);
const [transactions, setTransactions] = useState<Transaction[]>([]);
const [escrows, setEscrows] = useState<Escrow[]>([]);
const [activeTab, setActiveTab] = useState('overview');
```

**Data Loading:**
```typescript
useEffect(() => {
  loadWalletData();
}, []);

const loadWalletData = async () => {
  const [balanceData, transactionsData, escrowsData] = await Promise.all([
    walletV2Service.getBalance(),
    walletV2Service.getTransactionHistory(20),
    walletV2Service.getEscrows(),
  ]);
  setBalance(balanceData);
  setTransactions(transactionsData.transactions);
  setEscrows(escrowsData);
};
```

**Components Used:**
- BalanceDisplay
- EscrowStatusBadge
- WithdrawalOptions
- Card
- Button
- Loading

### 2. AdminPage (`AdminPage.tsx`)

**Route:** `/admin`

**Purpose:** Platform management dashboard (admin-only)

**Sections (6 Tabs):**

#### A. Treasury Section
- Total user balances
- Total escrow holdings
- Platform fees accumulated
- Assets under management

#### B. Fees Section
- Available fees for withdrawal
- Withdrawn fees history
- Bulk withdrawal interface
- Real-time fee tracking

#### C. Reconciliation Section
- Manual reconciliation trigger
- Daily report history
- Discrepancy highlighting
- Balance breakdowns (platform, user, escrow)

#### D. Batches Section
- Queued withdrawal count & total
- Processing status
- Completed today count
- Manual batch trigger button

#### E. Users Section
- User balance lookup (by UUID)
- Promotional credit issuance
- Balance verification tool

#### F. Audit Logs Section
- Recent activity log (last 50 actions)
- Actor identification
- Timestamp & details
- Action filtering

**State Management:**
```typescript
const [activeTab, setActiveTab] = useState('treasury');
const [treasuryStats, setTreasuryStats] = useState<TreasuryStats | null>(null);
const [platformFees, setPlatformFees] = useState<PlatformFees | null>(null);
const [reconciliationReports, setReconciliationReports] = useState([]);
const [batchStats, setBatchStats] = useState<WithdrawalBatchStats | null>(null);
const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
```

**Admin Features:**
- Platform health monitoring
- Fee management
- Reconciliation reports
- Batch processing controls
- User management tools
- Complete audit trail

### 3. ConsumerPage (`ConsumerPage.tsx`)

**Route:** `/consumer`

**Purpose:** Student booking discovery & management

**Current Features:**
- Pinterest-style barber discovery feed
- Algorithmic ranking (capitalistic-but-fair)
- Search & advanced filters
- Barber profile cards
- "Book Appointment" button

**V2 Integration (Recommended Updates):**

```typescript
import bookingV2Service from '@services/booking-v2.service';
import EscrowStatusBadge from '@components/EscrowStatusBadge';

const handleBooking = async (barber: Barber, service: Service) => {
  const { booking, escrow } = await bookingV2Service.createBooking({
    barberId: barber.id,
    priceCents: service.price * 100,
    requestedSlot: selectedTime,
    serviceId: service.id,
  });

  toast.success(
    <div>
      Booking created!
      <EscrowStatusBadge status="held" expiresAt={escrow.expires_at} />
    </div>
  );
};
```

**Algorithmic Ranking:**
```typescript
function rankBarbers(barbers: Barber[]): Barber[] {
  return barbers
    .map((barber) => {
      let score = barber.average_rating * 100;
      score += Math.log(barber.total_bookings + 1) * 10;
      score += barber.years_of_experience * 5;
      
      // Newcomer boost
      if (barber.total_bookings < 20 && barber.average_rating >= 4.5) {
        score += 20;
      }
      
      // Instant book bonus
      if (barber.instant_book_enabled) {
        score += 15;
      }
      
      return { barber, score };
    })
    .sort((a, b) => b.score - a.score)
    .map(({ barber }) => barber);
}
```

### 4. BarberPage (`BarberPage.tsx`)

**Route:** `/barber`

**Purpose:** Barber dashboard & business management

**Current Features:**
- Analytics dashboard
- Revenue tracking
- Pending booking requests
- Today's schedule
- Performance metrics

**V2 Integration (Recommended Updates):**

```typescript
import walletV2Service from '@services/wallet-v2.service';
import bookingV2Service from '@services/booking-v2.service';
import BalanceDisplay from '@components/BalanceDisplay';

const BarberDashboard = () => {
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [bookings, setBookings] = useState<BookingV2[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [balanceData, bookingsData] = await Promise.all([
      walletV2Service.getBalance(),
      bookingV2Service.getBookings('pending'),
    ]);
    setBalance(balanceData);
    setBookings(bookingsData);
  };

  const completeBooking = async (bookingId: string, tipCents: number = 0) => {
    const result = await bookingV2Service.completeBooking(bookingId, tipCents);
    
    toast.success(
      `Booking completed! You earned $${result.net_to_barber_dollars} 
      (after $${result.platform_fee_dollars} platform fee)`
    );
    
    loadData(); // Refresh balance & bookings
  };

  return (
    <div>
      <BalanceDisplay balance={balance} showDetails />
      
      {/* Pending bookings */}
      {bookings.map(booking => (
        <Card key={booking.id}>
          <h3>{booking.consumer_first_name}</h3>
          <p>${booking.price_cents / 100}</p>
          <EscrowStatusBadge status={booking.escrow_status!} />
          
          {/* Tip input */}
          <input type="number" placeholder="Tip amount ($)" />
          
          {/* Complete button */}
          <Button onClick={() => completeBooking(booking.id, 500)}>
            Complete & Release Funds
          </Button>
        </Card>
      ))}
    </div>
  );
};
```

**New Features to Add:**
- Pending balance display (funds awaiting completion)
- Escrow status on booking cards
- Tip input field
- Net earnings calculation (after 5% platform fee)
- Withdrawal button linking to `/wallet`

### 5. RoleSelectionPage (`RoleSelectionPage.tsx`)

**Route:** `/`

**Purpose:** Entry point for different user roles

**Features:**
- Three role buttons (Admin, Consumer, Barber)
- Logo display
- Simple navigation

**Current Implementation:** ✅ Complete

---

## State Management

### Zustand Stores

#### Auth Store (`useAuthStore.ts`)

```typescript
interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
}

const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('auth_token'),
  isAuthenticated: !!localStorage.getItem('auth_token'),

  login: async (email, password) => {
    const response = await authService.login(email, password);
    localStorage.setItem('auth_token', response.token);
    set({ user: response.user, token: response.token, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('auth_token');
    set({ user: null, token: null, isAuthenticated: false });
  },

  setUser: (user) => set({ user }),
}));
```

**Usage:**
```typescript
const { user, login, logout } = useAuthStore();

// In login form
await login(email, password);

// In navbar
<button onClick={logout}>Logout</button>
```

#### Message Store (`useMessageStore.ts`)

```typescript
interface MessageState {
  conversations: Conversation[];
  activeConversation: Conversation | null;
  messages: Message[];
  setActiveConversation: (conv: Conversation) => void;
  addMessage: (message: Message) => void;
}
```

---

## API Integration

### Making Requests

**GET Request:**
```typescript
const barbers = await api.get('/barbers', {
  params: { campus_id: 'uuid', limit: 20 }
});
```

**POST Request:**
```typescript
const booking = await api.post('/v2/bookings', {
  barberId: 'uuid',
  priceCents: 3000,
  requestedSlot: '2025-12-01T10:00:00Z',
});
```

### Error Handling

**Try-Catch Pattern:**
```typescript
const createBooking = async () => {
  try {
    const { booking, escrow } = await bookingV2Service.createBooking({...});
    toast.success('Booking created!');
  } catch (error: any) {
    if (error.response?.status === 400) {
      toast.error(error.response.data.message); // "Insufficient balance"
    } else {
      toast.error('Booking failed. Please try again.');
    }
  }
};
```

**Global Error Handler (in api.service.ts):**
```typescript
this.client.interceptors.response.use(
  (response) => response.data,
  (error) => {
    // 401 Unauthorized → Redirect to login
    if (error.response?.status === 401) {
      window.location.href = '/';
    }
    
    // 403 Forbidden → Show error
    if (error.response?.status === 403) {
      toast.error('You do not have permission to perform this action');
    }
    
    return Promise.reject(error);
  }
);
```

### Loading States

**Component Pattern:**
```typescript
const MyComponent = () => {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await service.getData();
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) return <Loading />;
  if (error) return <div>Error: {error}</div>;
  if (!data) return <div>No data</div>;

  return <div>{/* Render data */}</div>;
};
```

---

## Styling with Tailwind CSS

### Theme Configuration (`tailwind.config.cjs`)

```javascript
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#4F46E5',    // Indigo
        secondary: '#10B981',  // Green
        danger: '#EF4444',     // Red
      },
    },
  },
  plugins: [],
};
```

### Common Patterns

**Button Styles:**
```typescript
// Primary button
className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"

// Secondary button
className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300"

// Danger button
className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
```

**Card Styles:**
```typescript
className="bg-white rounded-lg shadow-md p-6"
```

**Input Styles:**
```typescript
className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
```

---

## Deployment

### Build for Production

```bash
cd web-app
npm run build
# Output: dist/ directory
```

### Environment Variables

**Development (`.env.development`):**
```bash
VITE_API_URL=http://localhost:3001/api
VITE_WS_URL=http://localhost:3001
```

**Production (`.env.production`):**
```bash
VITE_API_URL=https://api.campuscuts.com/api
VITE_WS_URL=https://api.campuscuts.com
```

### Deployment Options

#### Option 1: Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd web-app
vercel --prod
```

#### Option 2: Netlify
```bash
# Install Netlify CLI
npm i -g netlify-cli

# Deploy
cd web-app
netlify deploy --prod --dir=dist
```

#### Option 3: IPFS (Decentralized)
```bash
# Build
npm run build

# Deploy to IPFS
ipfs add -r dist/

# Or use Fleek, Pinata, etc.
```

### PWA Configuration

**Manifest (`public/manifest.json`):**
```json
{
  "name": "CampusCuts",
  "short_name": "CampusCuts",
  "description": "Decentralized barber booking for college campuses",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#4F46E5",
  "background_color": "#ffffff",
  "icons": [
    {
      "src": "/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

**Service Worker (`public/sw.js`):**
```javascript
// Cache assets for offline access
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('campuscuts-v1').then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/assets/index.js',
        '/assets/index.css',
      ]);
    })
  );
});
```

---

## Development Guide

### Running Locally

```bash
# Install dependencies
cd web-app
npm install

# Start dev server
npm run dev
# Runs on http://localhost:3000
```

### Environment Setup

1. **Create `.env.development`:**
```bash
VITE_API_URL=http://localhost:3001/api
VITE_WS_URL=http://localhost:3001
```

2. **Start backend first:**
```bash
cd backend
npm run dev
# Backend must be running on port 3001
```

3. **Start frontend:**
```bash
cd web-app
npm run dev
```

### Code Style

**ESLint Configuration:**
```javascript
// eslint.config.js
import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

export default [
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react': reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
    },
  },
];
```

**Linting:**
```bash
npm run lint
```

### TypeScript Configuration

**Path Aliases (`tsconfig.app.json`):**
```json
{
  "compilerOptions": {
    "paths": {
      "@assets": ["./src/assets"],
      "@components/*": ["./src/components/*"],
      "@pages/*": ["./src/pages/*"],
      "@services/*": ["./src/services/*"],
      "@store/*": ["./src/store/*"],
      "@types/*": ["./src/types/*"],
      "@config/*": ["./src/config/*"]
    }
  }
}
```

**Usage:**
```typescript
import { CampusCutsLogo } from '@assets';
import Button from '@components/Button';
import walletV2Service from '@services/wallet-v2.service';
```

### Vite Configuration

**vite.config.ts:**
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      '@assets': path.resolve(__dirname, './src/assets'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@services': path.resolve(__dirname, './src/services'),
      '@store': path.resolve(__dirname, './src/store'),
      '@types': path.resolve(__dirname, './src/types'),
      '@config': path.resolve(__dirname, './src/config'),
    },
  },
});
```

---

## Testing

### Component Testing (Recommended)

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom
```

**Example Test:**
```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import BalanceDisplay from './BalanceDisplay';

describe('BalanceDisplay', () => {
  it('renders balance correctly', () => {
    render(<BalanceDisplay balance={{
      available_dollars: 100,
      pending_dollars: 50,
      total_dollars: 150,
      active_escrows: 2,
    }} />);

    expect(screen.getByText('$150.00')).toBeInTheDocument();
    expect(screen.getByText('$100.00')).toBeInTheDocument(); // Available
  });
});
```

### E2E Testing (Recommended)

```bash
npm install -D playwright
```

**Example E2E Test:**
```typescript
import { test, expect } from '@playwright/test';

test('complete booking flow', async ({ page }) => {
  await page.goto('http://localhost:3000/consumer');
  
  // Find barber
  await page.click('text=Book Appointment');
  
  // Select service
  await page.click('text=Haircut - $30');
  
  // Confirm booking
  await page.click('text=Confirm Booking');
  
  // Verify escrow created
  await expect(page.locator('text=Funds held in escrow')).toBeVisible();
});
```

---

## Performance Optimization

### Code Splitting

```typescript
// Lazy load pages
const AdminPage = lazy(() => import('./pages/AdminPage'));
const WalletPage = lazy(() => import('./pages/WalletPage'));

// In App.tsx
<Suspense fallback={<Loading />}>
  <Route path="/admin" element={<AdminPage />} />
</Suspense>
```

### Image Optimization

```typescript
// Use lazy loading
<img src={barber.profile_image_url} loading="lazy" />

// Or react-lazy-load-image-component
import { LazyLoadImage } from 'react-lazy-load-image-component';

<LazyLoadImage src={barber.profile_image_url} />
```

### Memoization

```typescript
import { useMemo } from 'react';

const rankedBarbers = useMemo(() => {
  return rankBarbers(barbers);
}, [barbers]);
```

---

## TypeScript Types

### Core Types (`types/index.ts`)

```typescript
export interface WalletBalance {
  available_dollars: number;
  pending_dollars: number;
  total_dollars: number;
  available_cents: number;
  pending_cents: number;
  total_cents: number;
  active_escrows: number;
}

export interface Transaction {
  id: number;
  tx_ref: string;
  user_id: string;
  type: string;
  amount: number;
  amount_dollars: number;
  currency: string;
  status: string;
  created_at: string;
  completed_at?: string;
}

export interface Escrow {
  id: string;
  booking_id: string;
  consumer_id: string;
  barber_id: string;
  amount: number;
  amount_dollars: number;
  status: 'held' | 'released' | 'refunded' | 'expired';
  created_at: string;
  expires_at: string;
  released_at?: string;
  refunded_at?: string;
}

export interface BookingV2 {
  id: string;
  consumer_id: string;
  barber_id: string;
  price_cents: number;
  tip_cents?: number;
  requested_slot: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  escrow_status?: 'held' | 'released' | 'refunded' | 'expired';
  escrow_expires_at?: string;
  created_at: string;
}
```

---

## Troubleshooting

### Common Issues

**1. "Cannot find module '@assets'"**
```bash
# Check tsconfig.app.json has path aliases
# Check vite.config.ts has resolve.alias
```

**2. "Failed to load resource: ERR_CONNECTION_REFUSED"**
```bash
# Backend not running
cd backend
npm run dev
# Must run on port 3001
```

**3. White page on load**
```bash
# Check console for errors
# Verify all imports are correct
# Check API base URL in config/constants.ts
```

**4. Balance not updating**
```typescript
// Always refresh balance after wallet operations
const handleWithdraw = async () => {
  await walletV2Service.withdrawToBank(100);
  // Refresh balance
  const newBalance = await walletV2Service.getBalance();
  setBalance(newBalance);
};
```

---

## Best Practices

### Component Organization
```typescript
// 1. Imports (group by type)
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '@components/Button';
import walletV2Service from '@services/wallet-v2.service';
import type { WalletBalance } from '@services/wallet-v2.service';

// 2. Types/Interfaces
interface Props { ... }

// 3. Component
const MyComponent: React.FC<Props> = ({ prop1 }) => {
  // State
  const [data, setData] = useState(null);
  
  // Effects
  useEffect(() => { ... }, []);
  
  // Handlers
  const handleClick = () => { ... };
  
  // Render
  return <div>...</div>;
};

// 4. Export
export default MyComponent;
```

### Error Handling
- Always use try-catch for async operations
- Show user-friendly error messages
- Log errors to console for debugging
- Provide fallback UI for errors

### Performance
- Use React.memo for expensive components
- Use useMemo for expensive calculations
- Use useCallback for event handlers passed to children
- Lazy load pages and heavy components
- Optimize images (lazy loading, proper sizing)

---

**For more information:**
- README.md - Project overview
- BACKEND.md - Backend documentation
- Live demo: http://localhost:3000

**Support:** Create an issue on GitHub or contact support@campuscuts.com

