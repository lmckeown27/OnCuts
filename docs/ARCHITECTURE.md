# CampusCuts Technical Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      iOS App (SwiftUI)                       │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐ │
│  │  Student UI    │  │   Barber UI    │  │   Shared UI    │ │
│  └────────────────┘  └────────────────┘  └────────────────┘ │
└───────────────────────────┬─────────────────────────────────┘
                            │
                    ┌───────▼───────┐
                    │   REST API    │
                    │  (Node.js)    │
                    └───┬───────┬───┘
                        │       │
            ┌───────────┘       └────────────┐
            │                                 │
    ┌───────▼────────┐              ┌────────▼────────┐
    │  PostgreSQL    │              │ Aptos Blockchain│
    │   (Off-Chain)  │              │   (On-Chain)    │
    │                │              │                 │
    │ • Profiles     │              │ • Bookings      │
    │ • Images       │              │ • Payments      │
    │ • Chat         │              │ • Reviews       │
    │ • Notifications│              │ • Barber Data   │
    └────────────────┘              └─────────────────┘
            │
    ┌───────▼────────┐
    │  AWS S3        │
    │  (Media Store) │
    └────────────────┘
```

## Component Details

### 1. Aptos Smart Contracts (Move)

**Purpose**: Immutable, transparent transaction ledger

**Contracts**:
- `booking_system.move` - Handles appointment creation, updates, completion
- `payment_system.move` - Manages payment escrow, releases, refunds
- `review_system.move` - Stores ratings and reviews
- `barber_registry.move` - Manages barber profiles and metadata

**Key Functions**:
- Create booking with timestamp, barber, client, service details
- Complete booking and release payment
- Cancel booking with refund logic
- Submit review (rating + text hash)
- Update barber metadata

**Data Stored On-Chain**:
```move
struct Booking {
    id: u64,
    barber_address: address,
    client_address: address,
    service_type: String,
    price: u64,
    timestamp: u64,
    status: u8, // 0=pending, 1=confirmed, 2=completed, 3=cancelled
    campus_id: u64
}

struct Review {
    booking_id: u64,
    rating: u8,
    review_hash: vector<u8>,
    timestamp: u64
}

struct BarberProfile {
    address: address,
    campus_id: u64,
    specialties: vector<String>,
    average_rating: u64,
    total_bookings: u64,
    is_active: bool
}
```

---

### 2. Backend API (Node.js + TypeScript + Express)

**Purpose**: Bridge between iOS app, blockchain, and off-chain storage

**Key Services**:
- `AuthService` - Handle .edu verification, JWT tokens
- `BarberService` - CRUD operations for barber data
- `BookingService` - Coordinate on-chain + off-chain booking data
- `PaymentService` - Stripe integration, wallet management
- `ReviewService` - Submit reviews to blockchain
- `NotificationService` - Push notifications via Firebase
- `MediaService` - Handle S3 uploads for portfolios

**Endpoints**:

```
Authentication:
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/verify-email
POST   /api/auth/verify-student-id

Barbers:
GET    /api/barbers
GET    /api/barbers/:id
POST   /api/barbers
PUT    /api/barbers/:id
DELETE /api/barbers/:id
GET    /api/barbers/:id/portfolio
POST   /api/barbers/:id/portfolio

Bookings:
GET    /api/bookings
POST   /api/bookings
GET    /api/bookings/:id
PUT    /api/bookings/:id/confirm
PUT    /api/bookings/:id/complete
PUT    /api/bookings/:id/cancel

Payments:
POST   /api/payments/process
POST   /api/payments/payout
GET    /api/payments/earnings

Reviews:
GET    /api/reviews/barber/:barberId
POST   /api/reviews

Campus:
GET    /api/campus/list
GET    /api/campus/:id/barbers
```

---

### 3. iOS App (SwiftUI)

**Structure**:
```
ios-app/
├── CampusCuts/
│   ├── Models/
│   │   ├── User.swift
│   │   ├── Barber.swift
│   │   ├── Booking.swift
│   │   ├── Review.swift
│   │   └── Campus.swift
│   ├── Views/
│   │   ├── Student/
│   │   │   ├── DiscoveryView.swift
│   │   │   ├── BarberDetailView.swift
│   │   │   ├── BookingFlowView.swift
│   │   │   └── StudentProfileView.swift
│   │   ├── Barber/
│   │   │   ├── DashboardView.swift
│   │   │   ├── CalendarView.swift
│   │   │   ├── EarningsView.swift
│   │   │   └── PortfolioManagerView.swift
│   │   ├── Shared/
│   │   │   ├── LoginView.swift
│   │   │   ├── SignUpView.swift
│   │   │   ├── CampusSelectionView.swift
│   │   │   └── ReviewListView.swift
│   ├── ViewModels/
│   │   ├── AuthViewModel.swift
│   │   ├── BarberViewModel.swift
│   │   ├── BookingViewModel.swift
│   │   └── PaymentViewModel.swift
│   ├── Services/
│   │   ├── APIService.swift
│   │   ├── AptosService.swift
│   │   ├── PaymentService.swift
│   │   └── NotificationService.swift
│   └── Utilities/
│       ├── Constants.swift
│       ├── Extensions.swift
│       └── NetworkManager.swift
```

---

### 4. Database Schema (PostgreSQL)

**Off-Chain Tables**:

```sql
users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE,
  campus_id INTEGER,
  role VARCHAR(20), -- 'student' or 'barber'
  aptos_address VARCHAR(66),
  created_at TIMESTAMP,
  verified BOOLEAN
)

barbers (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  bio TEXT,
  profile_image_url TEXT,
  pricing JSONB,
  instant_book BOOLEAN,
  average_response_time INTEGER,
  total_earnings DECIMAL(10,2)
)

portfolio_images (
  id UUID PRIMARY KEY,
  barber_id UUID REFERENCES barbers(id),
  image_url TEXT,
  caption TEXT,
  order_index INTEGER,
  created_at TIMESTAMP
)

chat_messages (
  id UUID PRIMARY KEY,
  booking_id UUID,
  sender_id UUID REFERENCES users(id),
  message TEXT,
  timestamp TIMESTAMP
)

notifications (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  type VARCHAR(50),
  message TEXT,
  read BOOLEAN,
  created_at TIMESTAMP
)

campuses (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255),
  domain VARCHAR(255), -- e.g., 'harvard.edu'
  location GEOGRAPHY(POINT)
)

booking_metadata (
  id UUID PRIMARY KEY,
  blockchain_booking_id BIGINT,
  location_details TEXT,
  special_requests TEXT,
  reminder_sent BOOLEAN,
  created_at TIMESTAMP
)
```

---

## 5. Data Flow Examples

### Booking Creation Flow

1. **Student selects barber and time** → iOS app
2. **iOS app calls** `POST /api/bookings` → Backend
3. **Backend**:
   - Creates entry in `booking_metadata` table
   - Calls Aptos smart contract to create on-chain booking
   - Processes payment via Stripe (held in escrow)
   - Returns booking confirmation
4. **Backend sends notification** to barber
5. **Barber accepts** → Booking status updated on-chain and in database
6. **Service completed** → Barber marks complete → Payment released → Review prompt sent

### Review Submission Flow

1. **Student submits review** → iOS app
2. **Backend**:
   - Validates booking completion
   - Hashes review text
   - Submits to Aptos smart contract
   - Updates barber's average rating
3. **Review displayed** to future clients

---

## 6. Security Considerations

### Authentication
- JWT tokens for API access
- .edu email verification required
- Student ID photo verification (manual review initially)
- Rate limiting on all endpoints

### Blockchain Security
- Aptos addresses managed by platform (custodial)
- Private keys stored in AWS KMS or HashiCorp Vault
- Gas fees paid from platform wallet
- Transaction signing happens server-side

### Payment Security
- PCI compliance via Stripe
- No credit card data stored on platform
- Escrow system prevents fraud
- Refund policies enforced by smart contracts

### Data Privacy
- GDPR/CCPA compliant data handling
- Students can delete profiles (removes off-chain data, on-chain remains)
- Chat encryption in transit and at rest
- Profile images stored with access controls

---

## 7. Scaling Strategy

### Phase 1: Single Campus (MVP)
- Pilot at one university
- Manual barber onboarding
- Limited to 10-20 barbers
- Focus on UX refinement

### Phase 2: Multi-Campus Expansion
- Automated onboarding
- Campus leaderboards
- Cross-campus features
- Referral system

### Phase 3: National Scale
- CDN for media delivery
- Database sharding by campus
- Microservices architecture
- Advanced caching strategies

---

## 8. Technology Choices Rationale

| Technology       | Why?                                                              |
| ---------------- | ----------------------------------------------------------------- |
| **Aptos**        | Low gas fees, fast finality, Move language safety                 |
| **SwiftUI**      | Native iOS performance, rapid development, modern UI              |
| **Node.js**      | Fast API development, large ecosystem, async I/O                  |
| **PostgreSQL**   | Robust, ACID compliant, excellent JSON support, geospatial        |
| **Stripe**       | Industry standard, instant payouts, Connect for marketplaces      |
| **AWS S3**       | Scalable, cost-effective media storage                            |
| **Firebase**     | Reliable push notifications, real-time capabilities               |

---

## 9. Performance Targets

- **Booking creation**: < 2 seconds end-to-end
- **Barber discovery**: < 1 second to display grid
- **Payment processing**: < 3 seconds
- **Review submission**: < 2 seconds
- **App launch**: < 1.5 seconds to interactive

---

## 10. Monitoring & Analytics

**Platform Metrics**:
- Total bookings per day/week/month
- Revenue and commission tracking
- Active users (students & barbers)
- Conversion rates (views → bookings)
- Average transaction value
- Barber utilization rates

**Technical Metrics**:
- API response times
- Blockchain transaction success rates
- Error rates by endpoint
- App crash rates
- Database query performance

**Tools**:
- Datadog or New Relic for APM
- Sentry for error tracking
- Aptos Explorer for blockchain monitoring
- Google Analytics for user behavior

