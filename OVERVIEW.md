# CampusCuts - Comprehensive Overview

## 🎯 What is CampusCuts?

**CampusCuts** is a decentralized barber booking platform for college campuses that combines blockchain technology with traditional payments to create a sustainable, low-cost marketplace for student grooming services.

### Core Value Proposition

- **For Students:** Book trusted campus barbers with credit/debit cards - no crypto knowledge needed
- **For Barbers:** Run a micro-business with 5% platform fees, instant payouts, and full control
- **For Platform:** Sustainable economics through blockchain efficiency + fiat payments

---

## 🏗️ Architecture

### Hybrid Decentralized Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          Frontend (Multi-Platform)                        │
│  ┌─────────────────────────┐     ┌─────────────────────────────────────┐│
│  │  iOS App (SwiftUI)       │     │  Web App (React + PWA)              ││
│  │  • Native iOS            │     │  • Progressive Web App              ││
│  │  • Push Notifications    │     │  • Responsive Design                ││
│  │  • Keychain Security     │     │  • Offline Support                  ││
│  └─────────────────────────┘     │  • IPFS Deployable                  ││
│                                   └─────────────────────────────────────┘│
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
            ┌───────▼────────┐       ┌───────▼────────┐
            │  Node.js API   │       │ Aptos Blockchain│
            │   (Hybrid)     │       │   (Move Lang)   │
            ├────────────────┤       ├─────────────────┤
            │ • Auth         │       │ • Bookings      │
            │ • Chat         │       │ • Payments      │
            │ • Images       │       │ • Reviews       │
            │ • Push Notifs  │       │ • Barber Data   │
            │ • Stripe       │       │ • Campus Links  │
            └────────┬───────┘       └─────────────────┘
                     │
            ┌────────▼────────┐
            │   PostgreSQL    │
            │   • Users       │
            │   • Messages    │
            │   • Media URLs  │
            └─────────────────┘
```

### Data Distribution

**On-Chain (Aptos Blockchain):**
- Booking creation & completion hashes
- Payment transaction hashes
- Reviews (ratings + text)
- Barber metadata (bio, specialties, pricing)
- Campus marketplace assignments

**Off-Chain (PostgreSQL + S3):**
- User authentication data
- Profile pictures & portfolio images
- Chat messages (real-time)
- Push notification logs
- Analytics & reports

---

## 💻 Technology Stack

### Frontend

**iOS App:**
- **Framework:** SwiftUI, Swift 5.9+
- **Authentication:** Keychain (secure token storage)
- **Networking:** URLSession with async/await
- **Real-time:** Socket.IO client
- **Notifications:** UserNotifications framework (APN)

**Web App (Decentralized):**
- **Framework:** React 19 + TypeScript
- **Build Tool:** Vite 7.2+
- **Styling:** Tailwind CSS 4.1+
- **State Management:** Zustand
- **Routing:** React Router v6
- **HTTP Client:** Axios with interceptors
- **Real-time:** Socket.IO client
- **Payments:** Stripe React
- **PWA:** Service Worker + Web Manifest
- **Deployment:** IPFS (decentralized) or traditional hosting

### Backend
- **Framework:** Node.js 18+, Express.js, TypeScript
- **Database:** PostgreSQL 14+ with PostGIS
- **Caching:** Redis 7+
- **Real-time:** Socket.IO 4.8
- **Email:** Nodemailer with Gmail SMTP
- **Image Processing:** Sharp, Multer
- **Blockchain:** Aptos SDK
- **Payments:** Stripe Connect

### Blockchain
- **Network:** Aptos (devnet/testnet/mainnet)
- **Language:** Move
- **Smart Contracts:**
  - `barber_registry.move` - Barber profiles
  - `booking_system.move` - Booking records
  - `payment_system.move` - Payment hashes
  - `review_system.move` - Reviews & ratings

### Infrastructure
- **Containerization:** Docker, Docker Compose
- **Process Manager:** PM2 (optional)
- **CI/CD:** GitHub Actions
- **Storage:** AWS S3
- **Push Notifications:** APN (iOS) + FCM (Android)

---

## 📁 Project Structure

```
CampusCuts/
├── backend/                    # Node.js/TypeScript API
│   ├── src/
│   │   ├── config/
│   │   │   └── redis.ts              # Redis caching config
│   │   ├── controllers/              # Business logic
│   │   │   ├── auth.controller.ts
│   │   │   ├── barber.controller.ts
│   │   │   ├── booking.controller.ts
│   │   │   ├── payment.controller.ts
│   │   │   └── review.controller.ts
│   │   ├── database/
│   │   │   ├── connection.ts         # PostgreSQL connection
│   │   │   ├── schema.sql            # Database schema
│   │   │   ├── migrate.ts            # Migration runner
│   │   │   └── seed.ts               # Seed data
│   │   ├── middleware/
│   │   │   ├── auth.ts               # JWT authentication
│   │   │   ├── errorHandler.ts       # Global error handling
│   │   │   ├── validator.ts          # Request validation
│   │   │   └── upload.ts             # File upload handling
│   │   ├── routes/
│   │   │   ├── auth.routes.ts
│   │   │   ├── barber.routes.ts
│   │   │   ├── booking.routes.ts
│   │   │   ├── payment.routes.ts
│   │   │   ├── review.routes.ts
│   │   │   ├── message.routes.ts     # Real-time messaging
│   │   │   ├── notification.routes.ts # Push notifications
│   │   │   └── upload.routes.ts      # Image uploads
│   │   ├── services/
│   │   │   ├── aptos.service.ts      # Blockchain integration
│   │   │   ├── stripe.service.ts     # Payment processing
│   │   │   ├── s3.service.ts         # Media storage
│   │   │   ├── notification.service.ts
│   │   │   ├── email.service.ts      # Email notifications
│   │   │   ├── image.service.ts      # Image processing
│   │   │   ├── message.service.ts    # Messaging logic
│   │   │   ├── pushNotification.service.ts
│   │   │   └── educationalDomain.service.ts
│   │   ├── types/
│   │   │   └── index.ts              # TypeScript types
│   │   └── index.ts                  # Express app + Socket.IO
│   ├── package.json
│   ├── tsconfig.json
│   ├── Dockerfile
│   └── env.example                   # Environment variables template
│
├── contracts/                  # Aptos Move Smart Contracts
│   ├── Move.toml                     # Package manifest
│   └── sources/
│       ├── barber_registry.move      # Barber profiles on-chain
│       ├── booking_system.move       # Booking records
│       ├── payment_system.move       # Payment hashes
│       └── review_system.move        # Reviews & ratings
│
├── ios-app/                    # iOS SwiftUI Application
│   ├── CampusCuts.xcodeproj/
│   ├── CampusCuts/
│   │   ├── CampusCutsApp.swift       # App entry point
│   │   ├── ContentView.swift         # Root view
│   │   ├── Models/                   # Data models
│   │   │   ├── User.swift
│   │   │   ├── Barber.swift
│   │   │   ├── Booking.swift
│   │   │   ├── Review.swift
│   │   │   └── Campus.swift
│   │   ├── ViewModels/               # MVVM ViewModels
│   │   │   ├── AuthViewModel.swift
│   │   │   ├── BarberViewModel.swift
│   │   │   └── BookingViewModel.swift
│   │   ├── Views/
│   │   │   ├── Shared/               # Common views
│   │   │   │   ├── LoginView.swift
│   │   │   │   ├── SignUpView.swift
│   │   │   │   ├── CampusSelectionView.swift
│   │   │   │   └── ReviewListView.swift
│   │   │   ├── Student/              # Student-specific views
│   │   │   │   ├── DiscoveryView.swift
│   │   │   │   ├── BarberDetailView.swift
│   │   │   │   ├── BookingFlowView.swift
│   │   │   │   ├── BookingsListView.swift
│   │   │   │   └── StudentProfileView.swift
│   │   │   └── Barber/               # Barber-specific views
│   │   │       ├── BarberDashboardView.swift
│   │   │       ├── BarberCalendarView.swift
│   │   │       ├── EarningsView.swift
│   │   │       └── BarberProfileView.swift
│   │   ├── Services/
│   │   │   ├── NetworkManager.swift  # API communication
│   │   │   ├── KeychainManager.swift # Secure token storage
│   │   │   └── PushNotificationManager.swift
│   │   └── Utilities/
│   │       ├── Constants.swift
│   │       └── Extensions.swift
│   └── Podfile
│
├── web-app/                    # React Web Application (PWA)
│   ├── public/
│   │   ├── manifest.json             # PWA manifest
│   │   ├── sw.js                     # Service worker
│   │   └── icons/                    # App icons
│   ├── src/
│   │   ├── components/               # Reusable UI components
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Loading.tsx
│   │   │   └── Navbar.tsx
│   │   ├── pages/                    # Route pages
│   │   │   ├── auth/                 # Authentication pages
│   │   │   ├── student/              # Student views
│   │   │   └── barber/               # Barber views
│   │   ├── services/                 # API services
│   │   │   ├── api.service.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── barber.service.ts
│   │   │   ├── booking.service.ts
│   │   │   ├── message.service.ts
│   │   │   └── socket.service.ts
│   │   ├── store/                    # Zustand state management
│   │   │   ├── useAuthStore.ts
│   │   │   └── useMessageStore.ts
│   │   ├── types/                    # TypeScript types
│   │   ├── config/                   # Configuration
│   │   │   └── constants.ts
│   │   ├── App.tsx                   # Main app component
│   │   ├── main.tsx                  # Entry point
│   │   └── index.css                 # Global styles
│   ├── Dockerfile                    # Docker configuration
│   ├── nginx.conf                    # Nginx configuration
│   ├── deploy-ipfs.sh                # IPFS deployment script
│   ├── package.json
│   └── README.md
│
├── scripts/                    # Automation scripts
│   ├── setup.sh                      # Project setup
│   ├── deploy-contracts.sh           # Deploy Aptos contracts
│   ├── init-aptos-profile.sh         # Aptos CLI setup
│   ├── start-dev.sh                  # Start dev environment
│   └── test-all.sh                   # Run all tests
│
├── .github/
│   ├── workflows/
│   │   └── ci.yml                    # CI/CD pipeline
│   ├── ISSUE_TEMPLATE/
│   └── pull_request_template.md
│
├── docker-compose.yml          # Local development environment
├── Makefile                    # Common tasks automation
├── README.md                   # Quick start guide
├── OVERVIEW.md                 # This file
└── LICENSE                     # MIT License
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- Aptos CLI
- PostgreSQL 14+
- Redis 7+
- Xcode 15+ (for iOS development)

### Setup

```bash
# 1. Clone repository
git clone https://github.com/lmckeown27/CampusCuts.git
cd CampusCuts

# 2. Install backend dependencies
cd backend
npm install

# 3. Configure environment
cp env.example .env
# Edit .env with your credentials

# 4. Start infrastructure with Docker
docker-compose up -d

# 5. Run database migrations
npm run migrate

# 6. Start development server
npm run dev

# 7. Deploy Aptos contracts (optional)
cd ../scripts
./deploy-contracts.sh
```

### iOS App Setup

```bash
cd ios-app
pod install
open CampusCuts.xcworkspace
```

---

## 🔑 Environment Variables

### Required Configuration

**Database:**
```bash
DATABASE_URL=postgresql://postgres:password@localhost:5432/campuscuts
```

**Redis:**
```bash
REDIS_URL=redis://localhost:6379
```

**Email (Gmail SMTP for .edu verification):**
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-app-email@gmail.com
SMTP_PASS=your-gmail-app-password
```

**Aptos Blockchain:**
```bash
APTOS_NETWORK=devnet
APTOS_NODE_URL=https://fullnode.devnet.aptoslabs.com/v1
APTOS_PRIVATE_KEY=0x...
APTOS_MODULE_ADDRESS=0x...
```

**Stripe Payments:**
```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
PLATFORM_FEE_PERCENTAGE=5
```

**Push Notifications (iOS):**
```bash
APN_KEY_ID=ABC123XYZ
APN_TEAM_ID=YOUR_TEAM_ID
APN_PRIVATE_KEY=./path/to/AuthKey.p8
APN_BUNDLE_ID=com.campuscuts.ios
```

**AWS S3:**
```bash
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
AWS_S3_BUCKET=campuscuts-media
```

See `backend/env.example` for complete list.

---

## 📱 User Flows

### Student Flow

1. **Sign Up**
   - Enter .edu email address
   - Receive verification code
   - Upload student ID for verification
   - Select campus

2. **Discover Barbers**
   - Pinterest-style grid of barber portfolios
   - Filter by: price, rating, hair type, distance, availability
   - View barber profiles with reviews and pricing

3. **Book Appointment**
   - Select service from barber's menu
   - Choose available time slot
   - Confirm location (dorm, campus center, etc.)
   - Pay with credit/debit card (Stripe)
   - Receive confirmation email + push notification

4. **Day of Appointment**
   - Receive reminder notification (1-2 hours before)
   - Chat with barber if needed
   - Check-in at location

5. **After Service**
   - Payment processed automatically
   - Rate and review barber (stored on-chain)
   - Booking recorded on Aptos blockchain

---

### Barber Flow

1. **Onboarding**
   - Sign up with .edu email
   - Upload student ID for campus verification
   - Create profile (bio, specialties, years of experience)
   - Upload portfolio photos (up to 8 images)
   - Set pricing for services
   - Define availability schedule

2. **Receive Bookings**
   - Get push notification for new booking request
   - Accept or decline (if request-book mode)
   - Automatic acceptance (if instant-book mode)
   - Confirmation sent to student

3. **Manage Schedule**
   - View calendar with all appointments
   - Set weekly availability templates
   - Toggle vacation mode
   - Block specific time slots

4. **Complete Service**
   - Mark appointment as completed
   - Payment automatically transferred via Stripe
   - Receive instant payout (platform absorbs gas fees)

5. **Business Analytics**
   - View daily/weekly/monthly earnings
   - Track tips and total bookings
   - See review averages and trends
   - Growth metrics and leaderboard ranking

---

## 🔗 Blockchain Integration (Aptos)

### Smart Contracts

**1. Barber Registry** (`contracts/sources/barber_registry.move`)
```rust
struct BarberProfile {
    barber_address: address,
    bio_hash: vector<u8>,
    specialties: vector<String>,
    pricing_hash: vector<u8>,
    campus_id: u64,
    total_bookings: u64,
    is_active: bool
}
```

**2. Booking System** (`contracts/sources/booking_system.move`)
```rust
struct Booking {
    booking_id: u64,
    barber_address: address,
    client_address: address,
    service_hash: vector<u8>,
    timestamp: u64,
    status: u8, // 0=created, 1=completed, 2=cancelled
}
```

**3. Payment System** (`contracts/sources/payment_system.move`)
```rust
struct PaymentRecord {
    payment_id: u64,
    booking_id: u64,
    transaction_hash: vector<u8>, // Stripe transaction hash
    amount: u64,
    timestamp: u64
}
```

**4. Review System** (`contracts/sources/review_system.move`)
```rust
struct Review {
    review_id: u64,
    booking_id: u64,
    barber_address: address,
    rating: u8, // 1-5
    review_hash: vector<u8>, // Hash of review text
    timestamp: u64
}
```

### Why Blockchain?

- **Transparency:** All bookings and reviews are tamper-proof
- **Low Cost:** Aptos gas fees are minimal (~$0.0001 per transaction)
- **Decentralization:** No single point of failure
- **Sustainability:** Enables 5% commission (vs 20-30% on Web2 platforms)

---

## 💳 Payment Flow

```
Student pays $25 → Stripe custodial wallet → Platform logs hash on Aptos
                                           ↓
                           Barber receives $23.75 instant payout
                           Platform keeps $1.25 (5% fee)
                           Platform pays Aptos gas fees (~$0.0001)
```

**Key Features:**
- Students never see crypto
- Barbers receive fiat (USD) payouts
- Platform absorbs all gas fees
- Transaction hash stored on-chain for transparency
- Instant payouts via Stripe Connect

---

## 📡 Real-Time Features (Transferred from CampusKinect)

### Socket.IO Integration

**Rooms:**
- `user-{userId}` - Personal room for direct messages
- `campus-{campusId}` - Campus-wide updates

**Events:**
- `join-personal` - Join user's message room
- `join-campus` - Join campus room
- `new-message` - Receive real-time chat messages
- `booking-update` - Live booking status changes

### Push Notifications

**iOS (APN):**
- Booking confirmations
- Appointment reminders (1-2 hours before)
- New chat messages
- Payment received (for barbers)
- New reviews (for barbers)

**Android (FCM):**
- Same notification types as iOS

**Features:**
- Badge count management
- Notification preferences
- Quiet hours (22:00 - 08:00 default)
- Interactive categories (reply, mark as read, view booking)

---

## 🖼️ Image Handling

### Image Types & Specifications

| Type | Dimensions | Quality | Quantity | Purpose |
|------|-----------|---------|----------|---------|
| **Barber Portfolio** | 1200x1200 | 90% | Up to 8 | Showcase work |
| **Profile Picture** | 600x600 | 85% | 1 | User identity |
| **Chat Images** | 800x800 | 80% | Unlimited | Messaging |
| **Thumbnails** | 300x300 | 70% | Auto-generated | Fast loading |

### Processing Pipeline

```
Upload → Validation → Sharp Processing → Resize + Compress → Generate Thumbnail → Save → S3 Upload → Return URLs
```

**Features:**
- Automatic aspect ratio maintenance
- Progressive JPEG for gradual loading
- WebP support for modern clients
- Orphaned image cleanup (24h)
- Max file size: 10MB per image

---

## 📧 Email System

### Email Types

**1. Verification Email**
- Sent on account creation
- Contains 6-digit code or verification link
- Expires in 10 minutes (code) or 24 hours (link)
- Validates .edu domain

**2. Booking Confirmation**
- Sent when barber confirms appointment
- Includes: barber name, service, date/time, location, price
- Branded HTML template

**3. Appointment Reminder**
- Sent 1-2 hours before appointment
- Includes all booking details
- Reduces no-shows

**4. Password Reset**
- Secure token link
- Expires in 1 hour

### .edu Validation

**Multi-Country Support:**
- 🇺🇸 `.edu` (USA)
- 🇬🇧 `.ac.uk` (United Kingdom)
- 🇨🇦 `.ca` (Canada)
- 🇦🇺 `.edu.au` (Australia)
- 🇩🇪 `.de` (Germany)
- 🇫🇷 `.fr` (France)

**Three-Tier Validation:**
1. **Database** - Check known universities (fastest)
2. **External API** - WHOIS/DNS lookup (optional)
3. **Pattern Matching** - Regex fallback

---

## 🔐 Security

### Authentication
- **JWT Tokens:** Access token (7 days) + Refresh token (30 days)
- **iOS Keychain:** Secure storage with `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`
- **Password Hashing:** bcrypt with salt rounds
- **.edu Verification:** Required for students
- **Student ID Check:** Manual verification for barbers

### Data Protection
- **HTTPS Only:** All API communication encrypted
- **CORS:** Restricted to allowed origins
- **Rate Limiting:** Prevent abuse (750 requests / 10 minutes)
- **Input Validation:** Joi + express-validator
- **SQL Injection:** Parameterized queries
- **XSS Prevention:** Content sanitization

### Payment Security
- **PCI Compliance:** Stripe handles card data (never touches our servers)
- **Webhook Verification:** Stripe signature validation
- **Refund Protection:** Blockchain-recorded transactions

---

## 🌐 API Endpoints

### Authentication
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - User login
- `POST /api/auth/verify-email` - Verify .edu email
- `POST /api/auth/refresh-token` - Refresh access token
- `GET /api/auth/me` - Get current user

### Barbers
- `GET /api/barbers` - List barbers (with filters)
- `GET /api/barbers/:id` - Get barber profile
- `POST /api/barbers` - Create barber profile
- `PUT /api/barbers/:id` - Update profile
- `GET /api/barbers/:id/reviews` - Get reviews
- `GET /api/barbers/:id/availability` - Get schedule

### Bookings
- `POST /api/bookings` - Create booking
- `GET /api/bookings/:id` - Get booking details
- `PUT /api/bookings/:id` - Update booking
- `DELETE /api/bookings/:id` - Cancel booking
- `GET /api/bookings/student/:studentId` - Student's bookings
- `GET /api/bookings/barber/:barberId` - Barber's bookings

### Payments
- `POST /api/payments/create-intent` - Create payment intent
- `POST /api/payments/confirm` - Confirm payment
- `POST /api/payments/refund` - Process refund
- `GET /api/payments/barber/:barberId/earnings` - Earnings report
- `POST /api/payments/webhook` - Stripe webhook handler

### Reviews
- `POST /api/reviews` - Create review
- `GET /api/reviews/booking/:bookingId` - Get booking review
- `GET /api/reviews/barber/:barberId` - Get barber reviews

### Messages (Real-time Chat)
- `GET /api/messages/conversations` - List conversations
- `POST /api/messages/conversations` - Start conversation
- `GET /api/messages/conversations/:id/messages` - Get messages
- `POST /api/messages/conversations/:id/messages` - Send message
- `PUT /api/messages/conversations/:id/read` - Mark as read
- `DELETE /api/messages/conversations/:id` - Delete conversation
- `GET /api/messages/unread-count` - Badge count

### Notifications
- `POST /api/notifications/register-device` - Register device token
- `DELETE /api/notifications/unregister-device` - Unregister device
- `GET /api/notifications/preferences` - Get preferences
- `PUT /api/notifications/preferences` - Update preferences

### Upload
- `POST /api/upload/portfolio` - Upload portfolio images (max 8)
- `POST /api/upload/profile-picture` - Upload profile picture
- `POST /api/upload/chat-image` - Upload chat image

### Campus
- `GET /api/campus` - List campuses
- `GET /api/campus/:id` - Get campus details
- `GET /api/campus/:id/barbers` - Campus barbers

---

## 🎨 UI/UX Features

### Student App

**Discovery View** (Pinterest-style)
- Grid of barber portfolio images
- Quick filters: price, rating, distance
- Infinite scroll loading
- Tap to view full profile

**Barber Detail View**
- Portfolio carousel (8 images)
- Bio & specialties
- Pricing menu
- Reviews with ratings
- Availability calendar
- "Book Now" CTA

**Booking Flow**
- Service selection
- Time slot picker
- Location input
- Payment (Stripe Elements)
- Confirmation screen

### Barber App

**Dashboard**
- Today's appointments
- Pending requests
- Weekly schedule overview
- Quick stats (earnings, bookings, rating)

**Calendar View**
- Monthly/weekly view
- Color-coded appointments
- Availability editing
- Vacation mode toggle

**Earnings View**
- Daily/weekly/monthly reports
- Tips tracking
- Payout history
- Tax summary (export CSV)

---

## 🔄 Technologies Transferred from CampusKinect

CampusKinect is a **live student community app** with 1,179+ commits. These proven technologies were transferred:

### Backend Services
✅ **Redis** - Caching and session management  
✅ **Email Service** - Beautiful HTML templates for .edu verification  
✅ **Image Processing** - Sharp library with thumbnail generation  
✅ **Educational Domain Validation** - Multi-country .edu support  
✅ **Push Notifications** - iOS APN + Android FCM  
✅ **Messaging Service** - Real-time chat with unread tracking  
✅ **Socket.IO** - WebSocket server with room-based architecture  

### iOS Services
✅ **KeychainManager** - Secure token storage (iOS security best practice)  
✅ **PushNotificationManager** - Badge management, notification categories  

### Infrastructure
✅ **Docker Compose** - Redis integration  
✅ **Database Schema** - Conversations, messages, mobile devices, notification logs  

**Key Adaptation:** Changed from **post-centric** (CampusKinect) to **booking-centric** (CampusCuts) architecture.

---

## 📊 Database Schema Overview

### Core Tables

**Users** - Authentication and profiles
- Supports both students and barbers
- .edu email verification
- Student ID verification status
- Notification preferences

**Campuses** - University data
- Name, domain, location (PostGIS)
- Timezone support
- Pre-seeded with major universities

**Barbers** - Barber profiles (off-chain)
- Bio, pricing, availability
- Instant-book toggle
- Average rating, total bookings
- Stripe Connect account ID

**Portfolio Images** - Barber work showcase
- Up to 8 images per barber
- Order index for carousel
- S3 URLs

**Bookings** - Appointment metadata
- Student-barber linkage
- Service details, location, special requests
- Reminder/notification tracking

**Conversations** - Chat rooms
- Booking-centric (tied to appointments)
- Student ↔ barber communication
- Last message timestamp for sorting

**Messages** - Chat messages
- Text, image, system messages
- Read receipt tracking
- Real-time delivery via Socket.IO

**Mobile Devices** - Push notification tokens
- iOS and Android support
- Auto-deactivation of invalid tokens
- Multi-device support per user

---

## 🧪 Testing

### Backend Tests
```bash
cd backend
npm test
```

**Coverage:**
- Unit tests for services
- Integration tests for API routes
- Mock Aptos and Stripe interactions

### iOS Tests
```bash
cd ios-app
xcodebuild test -workspace CampusCuts.xcworkspace -scheme CampusCuts
```

### End-to-End Testing
- Student signup and .edu verification
- Barber profile creation and portfolio upload
- Complete booking flow with payment
- Real-time chat between student and barber
- Review submission and on-chain storage
- Push notification delivery

---

## 🚀 Deployment

### Backend Deployment

**Production Setup:**
```bash
# 1. Build TypeScript
npm run build

# 2. Set production environment
export NODE_ENV=production

# 3. Start with PM2
pm2 start dist/index.js --name campuscuts-api

# 4. Monitor
pm2 monit
```

**Docker Production:**
```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Aptos Contract Deployment

```bash
cd contracts

# Initialize Aptos profile
aptos init --profile campuscuts

# Deploy contracts
aptos move publish --profile campuscuts

# Note the deployed module address for .env
```

### Web App Deployment

**Traditional Hosting (Vercel, Netlify, AWS):**
```bash
cd web-app
npm run build
# Deploy dist/ folder to hosting provider
```

**Docker Deployment:**
```bash
cd web-app
docker build -t campuscuts-web .
docker run -p 8080:80 campuscuts-web
```

**IPFS Deployment (Decentralized):**
```bash
cd web-app
./deploy-ipfs.sh
```

The IPFS deployment creates a fully decentralized web app accessible via:
- Public IPFS gateways
- Cloudflare IPFS
- Local IPFS node

### iOS App Deployment

1. Update `Info.plist` with production API URL
2. Configure App Store Connect
3. Archive and upload to TestFlight
4. Submit for App Store review

---

## 📈 Scalability Considerations

### Caching Strategy (Redis)

| Data Type | TTL | Why |
|-----------|-----|-----|
| User profiles | 1 hour | Frequently accessed, rarely updated |
| Barber profiles | 30 min | Discovery pages need fresh data |
| Campus data | 24 hours | Static data |
| Session data | 2 hours | Security vs performance |
| Search results | 10 min | Balance freshness and load |

### Database Optimization

**Indexes:**
- User email (authentication)
- Barber rating (discovery sorting)
- Booking scheduled_time (calendar queries)
- Message is_read (unread count)
- Conversation last_message_at (inbox sorting)

**Query Optimization:**
- Pagination on all list endpoints
- JOIN optimization for conversation queries
- Materialized views for analytics (future)

### Blockchain Cost Management

**Gas Fee Optimization:**
- Batch operations where possible
- Store hashes instead of full data
- Platform absorbs all gas fees (hidden from users)
- Estimated cost: ~$0.0001 per booking

---

## 🎯 MVP Features (Implemented)

### ✅ Student Features
- [x] Sign up with .edu email verification
- [x] Campus selection and segmentation
- [x] Visual barber discovery (Pinterest-style)
- [x] Barber profile viewing with portfolios
- [x] Filtering (price, rating, distance, availability)
- [x] Booking flow with Stripe payments
- [x] Real-time chat with barbers
- [x] Appointment reminders via push notifications
- [x] Post-service review and rating
- [x] Booking history

### ✅ Barber Features
- [x] Onboarding with portfolio upload
- [x] Profile management (bio, pricing, specialties)
- [x] Schedule templates and availability
- [x] Instant-book / request-book modes
- [x] Calendar with appointment management
- [x] Real-time chat with students
- [x] Earnings reports (daily/weekly/monthly)
- [x] Instant payouts via Stripe Connect
- [x] Review management
- [x] Vacation mode

### ✅ Platform Features
- [x] Hybrid decentralized architecture
- [x] Aptos blockchain integration
- [x] Fiat payment processing (Stripe)
- [x] Real-time messaging (Socket.IO)
- [x] Push notifications (APN + FCM)
- [x] Email notifications
- [x] Image processing and optimization
- [x] Campus-specific marketplaces
- [x] .edu email validation
- [x] Secure authentication (Keychain)

---

## 🔮 Future Enhancements

### Post-MVP Features
- Map interface for distance-based discovery
- AI style matching and recommendations
- Cross-campus marketplace (seasonal shifts)
- Social sharing of reviews
- Barber tips and loyalty programs
- Group bookings (fraternity/sorority events)
- Subscription packages (monthly unlimited cuts)
- Advanced analytics dashboard

### Technical Improvements
- GraphQL API (more efficient mobile queries)
- Service workers for offline support
- WebRTC video consultations
- Machine learning for demand prediction
- Advanced fraud detection
- Multi-language support

---

## 🤝 Contributing

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Make changes with tests
4. Run linters (`npm run lint`)
5. Commit with conventional commits
6. Push and create pull request

### Code Standards
- **TypeScript:** Strict mode enabled
- **ESLint:** Enforced on backend
- **SwiftLint:** Enforced on iOS
- **Prettier:** Code formatting
- **Conventional Commits:** Standardized messages

---

## 📊 Project Stats

**Backend:**
- 8 Controllers
- 9 Routes
- 8 Services
- 15+ Database tables
- 4 Smart contracts

**iOS App:**
- 15+ Views
- 3 ViewModels
- 5+ Models
- 3 Core services

**Web App:**
- 15+ Pages/Views
- 5 Shared Components
- 7 API Services
- 2 State Stores
- PWA enabled
- IPFS deployable

**Total:**
- 200+ files
- 30,000+ lines of code
- Production-ready infrastructure
- Multi-platform (iOS + Web)

---

## 📞 Support

**Developer:** Liam McKeown  
**Email:** liam.mckeown38415@gmail.com  
**GitHub:** https://github.com/lmckeown27/CampusCuts  

**Related Projects:**
- CampusKinect (Student Community Hub)

---

## 📄 License

MIT License - See LICENSE file for details

---

## 🎓 Campus Marketplace Advantages

### vs Traditional Platforms (Booksy, StyleSeat)

| Feature | CampusCuts | Traditional |
|---------|------------|-------------|
| **Commission** | 5% | 20-30% |
| **Gas Fees** | Free (platform pays) | N/A |
| **Target Audience** | Campus students only | General public |
| **Payment** | Fiat (no crypto needed) | Fiat |
| **Transparency** | Blockchain records | Centralized |
| **Trust** | Campus-verified students | Anyone |
| **Location** | Campus-specific | Anywhere |

### Sustainability Model

**5% commission is viable because:**
1. **Blockchain reduces costs** - No expensive infrastructure
2. **Campus focus** - Organic growth through student networks
3. **Low marketing costs** - Word of mouth on campus
4. **Minimal support** - Peer-to-peer marketplace
5. **Gas fees covered** - Aptos fees are negligible (~$0.0001)

---

**Built with 💈 for campus communities**

*Making grooming convenient, affordable, and trustworthy for students everywhere.*
