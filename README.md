# CampusCuts

**A blockchain-powered campus barber marketplace that prioritizes barber earnings and student savings.**

![Status](https://img.shields.io/badge/status-active-success.svg)
![Platform](https://img.shields.io/badge/platform-web%20%7C%20ios-blue.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

---

## 🎯 Overview

CampusCuts is a decentralized marketplace connecting student barbers with customers on college campuses. By eliminating expensive intermediaries, barbers earn **95% of every transaction** (vs. 40-60% at traditional platforms) while students get quality haircuts at **20% lower prices**.

### Core Value Proposition

**For Barbers:**
- Keep 95% of earnings (only 5% platform fee)
- Minimum earnings exceed traditional platforms' maximum
- Full control over services and pricing
- Direct customer relationships

**For Students:**  
- Save 20% compared to traditional barbershops
- Book verified, rated barbers on campus
- Convenient mobile-first experience
- Secure escrow-based payments

**Platform Economics:**
- Barber keeps: $19 of every $20 cut
- Student pays: $18-22 (vs. $25-30 traditional)
- Platform fee: 5% (vs. 40-60% typical marketplaces)

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- OpenAI API Key (for AI features)
- Stripe Account (for payments)

### Installation

```bash
# Clone repository
git clone https://github.com/yourusername/CampusCuts.git
cd CampusCuts

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../web-app
npm install

# Configure environment
cp backend/.env.example backend/.env
# Add your API keys to backend/.env

# Start PostgreSQL & Redis (Docker)
docker-compose up -d postgres redis

# Initialize database
cd backend
psql -U postgres -d campuscuts < src/database/schema.sql

# Start backend
npm run dev

# Start frontend (new terminal)
cd web-app
npm run dev
```

Visit `http://localhost:3000` to see the app!

---

## 🏗️ Architecture

### Hybrid Blockchain + PostgreSQL

```
┌─────────────────────────────────────────────┐
│           FRONTEND (React + Vite)           │
│     Progressive Web App (PWA) + iOS App     │
└──────────────────┬──────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────┐
│         BACKEND (Node.js + Express)         │
│  • Custodial wallet service                 │
│  • Stripe fiat gateway                      │
│  • AI-powered marketplace engine            │
│  • PostgreSQL cache layer                   │
└─────┬─────────┬──────────┬──────────────────┘
      │         │          │
      ↓         ↓          ↓
┌─────────┐ ┌────────┐ ┌───────────────┐
│ Stripe  │ │  IPFS  │ │     Aptos     │
│ Payment │ │ Media  │ │  Blockchain   │
│ Gateway │ │Storage │ │  (Devnet)     │
└─────────┘ └────────┘ └───────────────┘
```

**Data Storage Strategy:**
- **Blockchain** (Aptos): User accounts, bookings, reviews (source of truth)
- **PostgreSQL**: Performance cache, analytics, marketplace data
- **IPFS** (Pinata): Profile images, portfolio photos
- **Redis**: Session cache, job queues

---

## ✨ Key Features

### Marketplace Engine
- **Dynamic Pricing**: AI-powered price multipliers based on barber quality (1.0x-1.5x)
- **Quality Scoring**: Continuous barber performance evaluation (BQS: 0-100)
- **Smart Ranking**: Barbers ranked by quality, availability, and proximity
- **Surge Pricing**: Real-time demand-based pricing adjustments
- **Market Calibration**: City-specific pricing and competition factors

### Booking System
- **Request-Based**: Barbers approve/reject bookings (AirBnb-style)
- **Escrow Payments**: Funds held until service completion
- **Real-Time Messaging**: Pre- and post-booking communication
- **Review System**: Verified reviews with sentiment analysis

### User Experience
- **Consumer Discovery**: Swipeable barber profiles (dating app UX)
- **Progressive Filters**: Sequential filtering by service → time → location
- **Barber Dashboard**: Schedule management, earnings tracking, performance metrics
- **Admin Tools**: Campus management, fraud detection, system health monitoring

### AI-Powered Features
- **Location Enrichment**: Auto-verifies and categorizes campus locations
- **Fraud Detection**: Pattern recognition for suspicious accounts
- **Dispute Resolution**: AI-assisted conflict analysis
- **Market Intelligence**: Campus-level supply-demand insights
- **Weekly Summaries**: Automated admin reports

### Scoring Systems
- **Barber Quality Score (BQS)**: `0.45*Reviews + 0.25*Demand + 0.15*PriceJustification + 0.15*Loyalty`
- **Consumer Reliability**: Booking history, cancellations, payment timeliness
- **Mutual Visibility**: Users see opposing party's score (not their own)

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS (olive green theme)
- **State**: Zustand
- **API**: Axios + React Query
- **Real-time**: Socket.IO Client
- **Payments**: Stripe React
- **PWA**: Service Workers + Manifest

### Backend
- **Runtime**: Node.js 18
- **Framework**: Express.js + TypeScript
- **Database**: PostgreSQL 15
- **Cache**: Redis 7
- **Queue**: BullMQ
- **Blockchain**: Aptos SDK
- **Storage**: Pinata (IPFS)
- **Payments**: Stripe API
- **AI**: OpenAI GPT-4
- **Auth**: JWT
- **Logging**: Winston

### Blockchain
- **Platform**: Aptos (Move language)
- **Network**: Devnet
- **Smart Contracts**:
  - `user_accounts.move` - User registration
  - `bookings.move` - Booking escrow
  - `reviews.move` - Review system
  - `platform_admin.move` - Admin controls

### Infrastructure
- **Containerization**: Docker + Docker Compose
- **CI/CD**: GitHub Actions
- **Deployment**: AWS Lambda (backend) + Vercel (frontend)
- **Monitoring**: Winston logs + PostgreSQL analytics

---

## ⚙️ Configuration

### Environment Variables

Create `backend/.env`:

```env
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/campuscuts

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Blockchain (Aptos)
APTOS_NODE_URL=https://fullnode.devnet.aptoslabs.com/v1
APTOS_PLATFORM_PRIVATE_KEY=0x...
APTOS_PLATFORM_ADDRESS=0x...
APTOS_NETWORK=devnet

# Payments (Stripe)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PLATFORM_ACCOUNT_ID=acct_...

# Storage (IPFS via Pinata)
PINATA_API_KEY=...
PINATA_SECRET_KEY=...

# AI (OpenAI)
OPENAI_API_KEY=sk-proj-...  # Single key for all AI services
OPENAI_MODEL=gpt-4-turbo-preview
OPENAI_MINI_MODEL=gpt-4o-mini

# Security
JWT_SECRET=your-secret-key-here

# Email (SendGrid - optional)
SENDGRID_API_KEY=SG...
ADMIN_EMAIL=admin@campuscuts.com

# Server
PORT=3001
NODE_ENV=development
```

### AI Services Configuration

All AI services (location enrichment, dynamic pricing, fraud detection, etc.) use the **single `OPENAI_API_KEY`** configured in `backend/.env`. The ai-worker code is imported as a library and runs in the backend process, sharing the same environment.

**AI Features:**
- ✅ Location enrichment (GPT-4o-mini)
- ✅ Dynamic pricing (GPT-4-turbo)
- ✅ Quality scoring (GPT-4-turbo)
- ✅ Fraud detection (GPT-4-turbo)
- ✅ Dispute resolution (GPT-4-turbo)
- ✅ Market analysis (GPT-4-turbo)

**Estimated Cost**: $51-205/month for 1,000 active users

---

## 💻 Development

### Backend Development

```bash
cd backend

# Start in development mode (auto-reload)
npm run dev

# Run tests
npm test

# Lint code
npm run lint

# Build for production
npm run build

# Start production server
npm start
```

### Frontend Development

```bash
cd web-app

# Start development server
npm run dev

# Run tests
npm run test

# Build for production
npm run build

# Preview production build
npm run preview
```

### Database Migrations

```bash
cd backend

# Apply migrations
psql -U postgres -d campuscuts < src/database/migrations/001_initial.sql
psql -U postgres -d campuscuts < src/database/migrations/002_user_grading.sql
# ... apply each migration in order

# Seed mock data
psql -U postgres -d campuscuts < database/seed-mock-data.sql
```

### Docker Development

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f backend

# Stop all services
docker-compose down

# Reset database
docker-compose down -v
docker-compose up -d postgres
```

---

## 📱 Platform-Specific Features

### Web App (`/web-app`)
- Responsive design (mobile-first)
- PWA capabilities (offline, install prompt)
- Optimized for desktop and mobile browsers
- Landing page with web/app routing

### iOS App (`/ios-app`)
- Native Swift/SwiftUI
- Push notifications (APNs)
- Wallet adapter integration
- Biometric authentication
- Native camera integration for portfolio uploads

---

## 🎨 Design System

### Color Palette
- **Primary**: Olive Green (`#708d81`) - Brand color
- **Background**: Grey (`#525252`) - Main app background
- **Accent**: Blue (`#0ea5e9`) - Info/links
- **Semantic**: Green (success), Red (error), Amber (warning)

### Typography
- **Headings**: Bold, 2xl-5xl
- **Body**: Regular, base-lg
- **Buttons**: Semibold, uppercase

### Components
- Rounded corners (lg, xl)
- Subtle shadows
- Hover animations
- Click-outside-to-close modals

---

## 🗄️ Database Schema

### Core Tables
- `users` - User accounts (students, barbers, admins)
- `barbers` - Barber profiles & pricing
- `barber_quality_scores` - BQS metrics
- `bookings` - Booking records
- `booking_requests` - Pending approval bookings
- `reviews` - Customer reviews
- `campus_locations` - Crowd-sourced location registry
- `market_stats` - Campus market data

### AI Tables
- `barber_pricing_multipliers` - Dynamic pricing data
- `fraud_flags` - Suspicious activity alerts
- `dispute_recommendations` - AI dispute analysis
- `location_enrichment_log` - AI location verification audit

### Cron Tables
- `cron_history` - Job execution log
- `gas_wallet_usage_tracking` - Blockchain gas monitoring

---

## 🚢 Deployment

### Backend Deployment (AWS Lambda)

```bash
cd backend

# Build
npm run build

# Deploy
serverless deploy --stage production
```

### Frontend Deployment (Vercel)

```bash
cd web-app

# Build
npm run build

# Deploy
vercel --prod
```

### Smart Contract Deployment (Aptos)

```bash
cd contracts

# Compile
aptos move compile

# Deploy to devnet
aptos move publish --profile devnet

# Deploy to mainnet
aptos move publish --profile mainnet
```

---

## 📊 Key Systems

### 1. Campus Location System
- **Crowd-sourced**: Barbers submit locations, system auto-deduplicates
- **AI-enriched**: OpenAI verifies and classifies locations
- **Fuzzy matching**: 88% similarity threshold prevents duplicates
- **Auto-promotion**: High-usage locations automatically verified

### 2. Dynamic Pricing Engine
- **BQS-based multipliers**: 1.0x (new) to 1.5x (top-tier)
- **Market calibration**: City-specific pricing factors
- **Surge pricing**: Real-time demand adjustments (1.2x-1.4x)
- **Server-enforced**: Barbers can't override calculated ranges

### 3. Booking Request System
- **Barber approval**: All bookings require barber acceptance
- **Customer profiles**: Barbers view customer reliability before accepting
- **Pre-booking chat**: AirBnb-style messaging
- **Escrow**: Funds locked until service completion

### 4. Payment Flow
- **Customer**: Stripe → Backend → Escrow
- **Barber**: Escrow → Stripe Connect → Barber bank
- **Platform**: 5% fee deducted at payout
- **Webhook-driven**: Event-based state management

### 5. Gas Wallet Monitoring
- **Automated monitoring**: Cron jobs check balance every hour
- **Low balance alerts**: Email/Slack when balance < threshold
- **One-click refill**: Admin can transfer APT via Petra wallet
- **Usage tracking**: Historical gas consumption analytics

---

## 🔐 Security

- **Authentication**: JWT tokens (7-day expiration)
- **Authorization**: Role-based access control (student, barber, admin)
- **API Security**: Rate limiting, CORS, Helmet headers
- **Payment Security**: Stripe PCI compliance, webhook signature verification
- **Blockchain Security**: Custodial wallet with AES-256 encryption
- **Data Privacy**: GDPR-compliant data handling

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run backend tests
cd backend && npm test

# Run frontend tests
cd web-app && npm test

# E2E tests (Playwright)
cd e2e && npx playwright test

# Coverage report
npm run test:coverage
```

---

## 📈 Monitoring & Analytics

### Backend Logs
- **Location**: `backend/logs/`
- **Format**: JSON structured logging (Winston)
- **Levels**: error, warn, info, debug

### System Health
- **Endpoint**: `GET /api/system/health`
- **Monitors**: PostgreSQL, blockchain, Redis
- **Meter**: Hybrid (cache) vs. blockchain-only mode

### Admin Dashboard
- Real-time transaction feed
- Campus performance metrics
- Fraud detection alerts
- Gas wallet status
- Market summaries

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing feature`)
5. Open Pull Request

### Development Guidelines
- Follow TypeScript strict mode
- Write tests for new features
- Update documentation
- Follow existing code style
- Add comments for complex logic

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👥 Team

Built for campus entrepreneurs by campus entrepreneurs.

---

## 📧 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/CampusCuts/issues)
- **Email**: support@campuscuts.com
- **Documentation**: This README

---

## 🎯 Project Status

- ✅ Core marketplace functionality
- ✅ Booking request system
- ✅ Payment integration (Stripe)
- ✅ AI-powered features
- ✅ Campus location system
- ✅ Dynamic pricing engine
- ✅ Web app (PWA)
- ✅ iOS app
- ✅ Admin dashboard
- ⏳ Mainnet deployment (coming soon)
- ⏳ Multi-university rollout

---

**CampusCuts** - Empowering campus barbers, one cut at a time. ✂️
