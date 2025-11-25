# CampusCuts MVP – Detailed Specification

## 1. Core Goal

Launch a decentralized barber booking platform for college campuses that:

* Uses **Aptos blockchain** to store critical transactional data.
* Allows **students to book and pay barbers** without needing cryptocurrency knowledge.
* Offers barbers **full business operations tools** while keeping platform costs minimal.

---

## 2. Platform Architecture

| Layer                          | Function                                    | MVP Implementation                                                                                                                |
| ------------------------------ | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Frontend**                   | User interface for students & barbers       | iOS app (Swift/SwiftUI) with responsive UI: student booking, barber dashboard, profile management, reviews, payments              |
| **Backend / Blockchain**       | Core transactional data                     | Aptos blockchain stores: bookings, completed appointments, payments (hashed), reviews, barber metadata, campus affiliation        |
| **Centralized Layer (Hybrid)** | Handle heavy or real-time tasks             | - Portfolio images / profile pictures<br>- Chat logs<br>- Marketing/media files<br>- Push notifications<br>- Analytics dashboards |
| **Payment Gateway**            | Fiat payment processing & custodial wallets | Stripe Connect or Plaid integration for credit/debit card payments; platform pays Aptos gas fees; barbers receive instant payouts |
| **Authentication**             | Student and barber verification             | .edu email verification, student ID check, campus selection for segmented marketplaces                                            |

---

## 3. User Roles & Features

### Student / Client

* Sign-up via .edu email verification
* Campus selection (default marketplace)
* Visual discovery of barbers (Pinterest-style grid)
* Barber profile view: portfolio photos, bio, pricing, reviews, specialties, response times
* Filters: price, ratings, hair type, cut type, distance, barber availability
* Booking flow: select service → choose time → confirm location → payment (fiat)
* After-service rating/review submission (stored on-chain)
* In-app notifications, calendar reminders, and chat (optional, hybrid)

### Barber / Service Provider

* Onboarding: submit student ID, upload portfolio, set pricing, bio, availability
* Dashboard:
  * Calendar & schedule management
  * Appointment requests: accept/decline
  * Weekly schedule templates & vacation mode
  * Instant-book / request-book options
* Financial tools:
  * Daily, weekly, monthly earnings reports
  * Tip tracking
  * Refunds & adjustments
  * Instant payouts via Stripe/Fiat or optional crypto withdrawal
* Advanced features (future MVP additions):
  * House-call services
  * Add-ons (e.g., beard trim, extra styling)
  * Multi-campus availability
* Analytics: growth trends, most booked hours, repeat clients, leaderboard ranking

---

## 4. Decentralized Data (On-Chain)

Stored on **Aptos blockchain** for transparency and minimal cost:

* Booking creation & completion hashes
* Payment transaction hashes
* Reviews (text & rating averages)
* Barber metadata (bio, specialties, availability)
* Campus marketplace assignment

*Benefits:*
* Tamper-proof records
* Low operational cost scaling with users
* Enables 5% commission sustainability

---

## 5. Centralized Data (Hybrid)

Stored off-chain for performance and feasibility:

* Barber & student profile pictures
* Portfolio images
* Chat logs for in-app messaging
* Push notifications
* Media/marketing files
* Analytics dashboards

*Rationale:* heavy media and real-time data cannot efficiently or economically run fully on-chain.

---

## 6. Payment Flow (Custodial Wallet)

1. Student pays with **credit/debit card** → funds enter **platform custodial wallet**
2. Platform logs **transaction hash on Aptos** (immutable record)
3. Barber completes service → receives **instant payout**
4. Gas fees are fully absorbed by the platform; student never sees crypto

*Benefits:* students experience a Web2-style flow, while the backend is fully decentralized.

---

## 7. Booking & Cancellation Logic

* Barber-defined service durations prevent double-bookings
* Instant-book or request-book logic
* Campus-specific waitlists for high-demand barbers
* Payments after service:
  * Barber cancellations → no refund needed
  * Client no-shows → no-show fee applied
  * Line-item transparency for platform fees

---

## 8. Security & Compliance

* Peer-to-peer student marketplace (barbers are independent contractors)
* Terms of Service specify peer-to-peer nature
* ID verification ensures legitimate users
* Operates legally across campuses without requiring barbers to hold licenses

---

## 9. MVP Exclusions / Future Additions

* Map interface (Uber-style distance display) – can be added after A.I. features
* Advanced AI barber recommendations or "style-matching"
* Cross-campus/seasonal marketplace shift
* Social sharing features beyond review system

---

## 10. Development Phases

### Phase 1: Foundation (Weeks 1-2)
- Project setup
- Smart contract development
- Basic API structure
- Database schema

### Phase 2: Core Features (Weeks 3-6)
- Authentication system
- Barber onboarding
- Booking system
- Payment integration

### Phase 3: User Experience (Weeks 7-8)
- iOS app UI/UX
- Discovery & filtering
- Review system
- Notifications

### Phase 4: Testing & Launch (Weeks 9-10)
- End-to-end testing
- Campus pilot program
- Bug fixes & optimization
- App Store submission

