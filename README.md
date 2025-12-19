# CampusCuts

**Decentralized barber marketplace platform connecting students with campus barbers**

CampusCuts enables students to discover and book haircuts from qualified barbers on their campus, while barbers earn 95% of their service fees through blockchain-based payments. The platform leverages Aptos blockchain for secure, transparent transactions and smart contract-based escrow.

---

## 🎯 **Core Value Proposition**

### **For Barbers**
- **Earn More**: Keep 95% of earnings (vs. 50-70% at traditional shops)
- **Flexible Schedule**: Work when and where you want
- **Campus Integration**: Built-in customer base
- **Automated Payments**: Instant payouts via blockchain

### **For Students**  
- **Lower Prices**: Save 20-40% compared to off-campus barbershops
- **Convenient**: On-campus service at dorms, common areas, etc.
- **Quality-Driven**: Algorithmic ranking ensures top performers are visible
- **Reliable**: Built-in review and reliability scoring system

---

## 🏗️ **System Architecture**

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (React + TypeScript)            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Consumer   │  │    Barber    │  │    Admin     │      │
│  │     Page     │  │     Page     │  │     Page     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND (Node.js + NestJS)               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Business Logic Layer                                │   │
│  │  - Booking Management    - Review System            │   │
│  │  - Marketplace Engine    - Location Ingestion       │   │
│  │  - AI Worker Integration - Gas Wallet Monitoring    │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
    │  PostgreSQL  │ │ Aptos Chain  │ │  AI Worker   │
    │   Database   │ │   (Devnet)   │ │  (OpenAI)    │
    └──────────────┘ └──────────────┘ └──────────────┘
```

### **Tech Stack**

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, TypeScript, Vite, TailwindCSS |
| **Backend** | Node.js, NestJS, TypeScript |
| **Database** | PostgreSQL 15+, Prisma ORM |
| **Blockchain** | Aptos (Devnet), Petra Wallet |
| **AI** | OpenAI GPT-4, BullMQ job queue |
| **Payments** | Stripe (fiat gateway), Blockchain escrow |
| **Real-time** | Socket.io |

---

## 📂 **Project Structure**

```
CampusCuts/
├── web-app/              # Frontend React application
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── pages/        # Route-level page components
│   │   ├── contexts/     # React contexts (wallet, auth)
│   │   ├── services/     # API service layer
│   │   ├── utils/        # Helper utilities
│   │   └── assets/       # Static assets (logos, icons)
│   └── public/           # Public assets
│
├── backend/              # Backend NestJS API
│   ├── src/
│   │   ├── modules/      # Feature modules
│   │   ├── services/     # Business logic services
│   │   ├── controllers/  # API route controllers
│   │   ├── entities/     # Database entities
│   │   └── config/       # Configuration
│   └── prisma/           # Database schema & migrations
│
└── ai-worker/            # AI automation microservice
    ├── src/
    │   ├── queues/       # BullMQ job queues
    │   ├── processors/   # Job processors
    │   ├── prompts/      # AI prompt templates
    │   └── services/     # AI business logic
    └── config/           # Worker configuration
```

---

## 🚀 **Quick Start**

### **Prerequisites**

- Node.js 18+
- PostgreSQL 15+
- Petra Wallet (Chrome extension)
- OpenAI API key

### **1. Install Dependencies**

```bash
# Clone repository
git clone <repository-url>
cd CampusCuts

# Install frontend dependencies
cd web-app
npm install

# Install backend dependencies
cd ../backend
npm install

# Install AI worker dependencies (optional)
cd ../ai-worker
npm install
```

### **2. Environment Setup**

#### **Frontend** (`/web-app/.env`)
```env
VITE_APTOS_NETWORK=devnet
VITE_API_URL=http://localhost:3001
```

#### **Backend** (`/backend/.env`)
```env
DATABASE_URL=postgresql://user:password@localhost:5432/campuscuts
APTOS_NETWORK=devnet
GAS_WALLET_ADDRESS=0x...
GAS_WALLET_PRIVATE_KEY=0x...
STRIPE_SECRET_KEY=sk_test_...
OPENAI_API_KEY=sk-...
JWT_SECRET=your-secret-key
```

#### **AI Worker** (`/ai-worker/.env`)
```env
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql://user:password@localhost:5432/campuscuts
REDIS_URL=redis://localhost:6379
```

### **3. Database Setup**

```bash
cd backend

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Seed database (optional)
npx prisma db seed
```

### **4. Start Services**

```bash
# Terminal 1: Frontend
cd web-app
npm run dev
# → http://localhost:5173

# Terminal 2: Backend
cd backend
npm run start:dev
# → http://localhost:3001

# Terminal 3: AI Worker (optional)
cd ai-worker
npm run dev
```

### **5. Access Application**

1. **Landing Page**: `http://localhost:5173`
2. **Web Version**: `http://localhost:5173/web`
3. **Role Selection**: Choose Admin, Barber, or Consumer

---

## 👥 **User Roles**

### **Consumer (Student)**
- Discover barbers by haircut type, availability, location
- View barber profiles with ratings, pricing, Instagram
- Book appointments with preferred barbers
- Track booking status and history
- Rate and review completed services
- View personal reliability score

### **Barber**
- Manage schedule (daily/weekly/monthly views)
- Accept/decline booking requests
- View customer profiles before accepting
- Set service specialties (pricing is algorithmic)
- Track performance metrics and earnings
- Receive automated gas wallet refills

### **Campus Manager** (Barber Role Extension)
- Approve new barber applications
- Monitor campus metrics (bookings, ratings, disputes)
- Manage campus content (Instagram integration)
- Escalate issues to platform admin

### **Platform Admin**
- Manage multiple campuses
- Monitor system health (blockchain/hybrid mode)
- View live transaction feeds
- Access gas wallet management
- Configure dynamic pricing parameters
- Review marketplace statistics

---

## 💰 **Marketplace Engine**

### **Barber Quality Score (BQS)**

**Formula:**
```
BQS = 0.45×ReviewScore + 0.25×DemandScore + 0.15×PriceJustification + 0.15×LoyaltyScore
```

- **ReviewScoreWeighted**: Exponentially weighted recent reviews
- **DemandScore**: Based on booking frequency and completion rate
- **PriceJustificationScore**: Value for money (quality vs. price)
- **LoyaltyScore**: Repeat customer rate

**Recomputed**: Nightly via cron job

### **Dynamic Pricing**

- **Base Price Range**: Set per market (campus/city)
- **BQS Multiplier**: 1.0x to 1.5x based on barber quality
- **Surge Pricing**: 1.2x to 1.4x during peak demand
- **Server-Side Enforcement**: Cannot be manipulated by barbers

### **Ranking Algorithm**

**Formula:**
```
RankScore = 0.5×BQS + 0.3×AvailabilityFit + 0.2×Proximity
```

Ensures consumers see the best barbers first, weighted by:
- Quality (50%)
- Availability match (30%)
- Location convenience (20%)

---

## 🤖 **AI Automation Worker**

### **Automated Tasks**

| Event Trigger | AI Task | Output |
|---------------|---------|--------|
| **Barber Onboarded** | Quality assessment from profile | Initial quality score |
| **Review Created** | Sentiment analysis | Adjusted BQS, fraud detection |
| **Booking Disputed** | Dispute resolution recommendation | Admin action suggestions |
| **Weekly** | Market summary report | Trends, pricing changes, anomalies |
| **Cancellation Pattern** | Fraud detection | Risk flags for accounts |
| **Market Update** | Demand estimation | Surge pricing triggers |

### **Fraud Detection**

- Pattern analysis across bookings
- Multi-account correlation detection
- Behavioral anomaly identification
- AI-powered risk scoring

### **Quality Scoring**

- Review sentiment analysis
- Performance trend detection
- Bonus/penalty adjustments
- Campus-level normalization

---

## 🗺️ **Location Ingestion System**

### **Crowd-Sourced Locations**

- **No Hardcoding**: All locations user-submitted
- **AI Normalization**: Standardizes similar location names
- **Automatic Aliasing**: "North Hall" = "North Dormitory" = "N Hall"
- **Confidence Scoring**: Increases with usage
- **Campus Scoping**: All data isolated per university

### **How It Works**

1. **Barber submits location**: Free-text input (e.g., "my dorm room 204")
2. **Backend normalizes**: Lowercasing, punctuation removal
3. **Fuzzy matching**: Checks similarity to existing locations
4. **AI enrichment**: Suggests canonical name and aliases
5. **Promotion**: Verified after 5+ uses with 80%+ confidence

---

## 💳 **Payment Flow**

### **Fiat → Blockchain Bridge**

```
Student pays $25 via Stripe
        ↓
Backend receives webhook
        ↓
Backend mints equivalent APT from custodial wallet
        ↓
APT locked in smart contract escrow
        ↓
Upon service completion:
        ↓
95% to barber wallet
5% to platform fee wallet
```

### **Gas Wallet System**

- **Automated Monitoring**: Checks balance every 15 minutes
- **Low Balance Alerts**: Warning at <5 APT, critical at <2 APT
- **One-Click Refill**: Admin can refill directly from Petra wallet
- **Transaction History**: Full audit log of all gas usage

---

## 🔗 **Blockchain Integration**

### **Aptos Wallet Connection**

**Current Status**: Uses Aptos Wallet Adapter Standard v7+

1. **Wallet Provider**: Auto-detects installed Aptos wallets
2. **Connection**: Click "Connect Wallet" → Approve in Petra
3. **Persistence**: Auto-reconnects on page reload
4. **Network**: Devnet (configurable to Testnet/Mainnet)

### **Setup Petra Wallet**

1. Install from https://petra.app/
2. Create new wallet or import existing
3. Switch network to **Devnet**
4. Get free devnet APT from faucet: https://aptoslabs.com/testnet-faucet

### **Smart Contracts** (Planned)

- **Escrow Module**: Holds funds until service completion
- **Review Module**: Immutable review records
- **Payment Module**: Automated distribution (95/5 split)

---

## 📊 **Database Schema (Key Tables)**

### **Users**
- Wallet-first authentication
- Roles: consumer, barber, admin, campus_manager
- Linked to Aptos addresses

### **Campuses**
- University/college records
- Market configuration (base prices, surge rules)

### **Barbers**
- 1-to-1 with users
- Campus-scoped profiles
- Dynamic pricing, cached BQS
- Service specialties

### **Locations**
- Campus-scoped service locations
- Canonical names + aliases
- Verification status, confidence scores

### **Availability**
- Barber-defined time slots
- Location, price, status (available/booked/completed)

### **Bookings**
- References availability + consumer
- Lifecycle states (pending → accepted → completed)
- Blockchain transaction hash
- Review linkage

### **Reviews**
- Ratings, text feedback
- Linked to completed bookings
- Feeds into BQS calculation

### **Barber Quality Scores**
- Historical snapshots
- Nightly recomputation results

---

## 🎨 **UI/UX Highlights**

### **Color System**
- **Primary**: Olive green (`#6B7E3F`, `#8FAF47`)
- **Greys**: `#F8F9FA`, `#E9ECEF`, `#6C757D`
- **Success**: Green (`#28A745`)
- **Warning**: Yellow (`#FFC107`)
- **Error**: Red (`#DC3545`)

### **Key Features**
- **Progressive Filter Questionnaire**: Haircut type → Date/Time → Location
- **Dynamic Barber Cards**: Quality-ranked, equal heights, Instagram handles
- **Smooth Animations**: Fade-in, scale-in on modals
- **Mobile-First**: Responsive design for all devices
- **Click-Outside-to-Close**: All popups/modals

### **Barber Discovery Flow**

1. Consumer sees filter questionnaire
2. Selects haircut type (horizontally scrollable tags)
3. Selects date/time (custom calendar picker with confirm)
4. Selects location (AI-powered auto-complete)
5. Barbers filter in real-time, top-ranked appear first
6. Click entire card to view profile
7. Schedule directly from profile

---

## 🔐 **Security Features**

### **Authentication**
- JWT-based sessions
- Wallet signature verification
- Role-based access control (RBAC)

### **Blockchain**
- Non-custodial user wallets (users control keys)
- Custodial platform wallet (for gas fees)
- Multi-sig wallet support (future)

### **Database**
- PostgreSQL RLS (Row-Level Security)
- Foreign key constraints
- Indexed queries for performance
- Audit logging on critical operations

### **API**
- Rate limiting
- Input validation (Zod schemas)
- CORS configuration
- HTTPS required (production)

---

## 🧪 **Testing**

### **Frontend**
```bash
cd web-app
npm run test        # Unit tests (Vitest)
npm run test:ui     # Test UI
npm run test:coverage
```

### **Backend**
```bash
cd backend
npm run test        # Unit tests (Jest)
npm run test:e2e    # End-to-end tests
npm run test:cov    # Coverage report
```

### **Database**
```bash
cd backend
npx prisma studio   # Visual database browser
```

---

## 📈 **Performance Monitoring**

### **System Health Meter**

Visual indicator on admin dashboard:
- **🟢 Hybrid Mode**: PostgreSQL + Blockchain (optimal)
- **🟡 Blockchain Only**: PostgreSQL down, fallback active
- **🔴 System Error**: Both systems unavailable

### **Cron Jobs**

| Job | Frequency | Purpose |
|-----|-----------|---------|
| **BQS Recomputation** | Nightly (2 AM) | Update barber quality scores |
| **Dynamic Pricing** | Nightly (2:30 AM) | Adjust price ranges |
| **Surge Detection** | Every 15 min | Monitor demand/supply ratio |
| **Gas Monitoring** | Every 15 min | Check custodial wallet balance |

---

## 🚢 **Deployment**

### **Production Checklist**

#### **Frontend**
- [ ] Set `VITE_APTOS_NETWORK=mainnet`
- [ ] Update API URL to production backend
- [ ] Enable HTTPS
- [ ] Configure CDN for assets
- [ ] Build: `npm run build`

#### **Backend**
- [ ] Migrate to production database
- [ ] Set secure `JWT_SECRET`
- [ ] Configure Stripe production keys
- [ ] Set Aptos mainnet node URL
- [ ] Fund gas wallet with APT
- [ ] Enable rate limiting
- [ ] Configure CORS for production domain

#### **Database**
- [ ] Run production migrations
- [ ] Enable backups (daily)
- [ ] Set up read replicas (optional)
- [ ] Configure connection pooling

#### **Blockchain**
- [ ] Deploy smart contracts to mainnet
- [ ] Verify contract code on Aptos Explorer
- [ ] Fund platform gas wallet
- [ ] Set up wallet monitoring alerts

---

## 🐛 **Troubleshooting**

### **Wallet Won't Connect**

**Problem**: "No wallets detected by adapter after 15 seconds"

**Solutions**:
1. Ensure Petra extension is installed and enabled
2. Check Petra is on correct network (Devnet)
3. Refresh page (Cmd/Ctrl + Shift + R)
4. Try different browser (Chrome recommended)
5. Reinstall Petra extension if corrupted

### **Database Connection Failed**

**Problem**: `ECONNREFUSED ::1:5432`

**Solutions**:
1. Start PostgreSQL: `brew services start postgresql`
2. Check `DATABASE_URL` in `.env`
3. Verify database exists: `psql -l`
4. Create database: `createdb campuscuts`

### **Backend API 500 Errors**

**Problem**: Internal server errors

**Solutions**:
1. Check backend logs: `npm run start:dev`
2. Verify all `.env` variables are set
3. Check database migrations: `npx prisma migrate status`
4. Restart backend service

### **Blockchain Transactions Failing**

**Problem**: "Insufficient APT for gas fees"

**Solutions**:
1. Check gas wallet balance in admin dashboard
2. Refill wallet from devnet faucet (devnet only)
3. Verify wallet has >0.001 APT minimum
4. Check Aptos network status

---

## 📝 **Environment Variables Reference**

### **Frontend**

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_APTOS_NETWORK` | Blockchain network | `devnet` |
| `VITE_API_URL` | Backend API base URL | `http://localhost:3001` |

### **Backend**

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | ✅ |
| `JWT_SECRET` | Secret for JWT tokens | ✅ |
| `APTOS_NETWORK` | Blockchain network | ✅ |
| `GAS_WALLET_ADDRESS` | Platform custodial wallet address | ✅ |
| `GAS_WALLET_PRIVATE_KEY` | Private key for gas wallet | ✅ |
| `STRIPE_SECRET_KEY` | Stripe API secret key | ✅ |
| `OPENAI_API_KEY` | OpenAI API key for AI worker | ⚠️ Optional |
| `REDIS_URL` | Redis connection for jobs | ⚠️ Optional |

---

## 🗺️ **Roadmap**

### **Phase 1: MVP** (Current)
- ✅ Basic marketplace functionality
- ✅ Wallet connection (Petra)
- ✅ Dynamic pricing engine
- ✅ AI worker integration
- ✅ Campus manager roles
- ✅ Location ingestion system

### **Phase 2: Blockchain** (In Progress)
- ⏳ Smart contract deployment (Aptos mainnet)
- ⏳ Full escrow implementation
- ⏳ On-chain review system
- ⏳ Multi-sig admin wallet

### **Phase 3: Scale** (Planned)
- 📅 Multi-campus expansion
- 📅 Mobile app (React Native)
- 📅 Advanced AI features (image recognition)
- 📅 Loyalty rewards program
- 📅 Barber training/certification

### **Phase 4: Enterprise** (Future)
- 📅 White-label solution for other campuses
- 📅 API for third-party integrations
- 📅 DAO governance model
- 📅 Token economics ($CUTS token)

---

## 🤝 **Contributing**

We welcome contributions! Please follow these guidelines:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/your-feature`
3. **Commit changes**: `git commit -m 'Add your feature'`
4. **Push to branch**: `git push origin feature/your-feature`
5. **Open a Pull Request**

### **Code Style**
- TypeScript for all new code
- Follow existing patterns
- Add comments for complex logic
- Write tests for new features

---

## 📄 **License**

This project is proprietary and confidential.

---

## 📧 **Contact**

For questions or support:
- **Platform**: CampusCuts
- **Purpose**: Campus barber marketplace
- **Tech**: React + NestJS + Aptos + AI

---

## 🙏 **Acknowledgments**

- **Aptos Labs**: Blockchain infrastructure
- **Petra Wallet**: Wallet adapter integration
- **OpenAI**: AI automation capabilities
- **Campus Communities**: Beta testing and feedback

---

**Built with ❤️ for campus communities**
