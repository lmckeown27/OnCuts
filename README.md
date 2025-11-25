# CampusCuts
**A barber, on your phone?**

CampusCuts is a decentralized barber booking platform built specifically for college campuses. It leverages the Aptos blockchain for transparent transactions while providing a seamless Web2-like user experience.

## 🎯 Overview

CampusCuts connects student barbers with clients on campus through a mobile-first platform that features:
- **Zero crypto knowledge required** - Students pay with credit/debit cards
- **5% platform commission** - Enabled by low blockchain costs
- **Transparent reviews** - Immutable on-chain ratings and feedback
- **Campus-specific marketplaces** - Localized trust and discovery
- **Instant payouts** - Barbers get paid immediately after service completion

## 🏗️ Architecture

### Hybrid Design
- **On-Chain (Aptos)**: Bookings, payments, reviews, barber metadata
- **Off-Chain**: Profile images, portfolios, chat, notifications, analytics

### Tech Stack
- **Blockchain**: Aptos (Move language)
- **iOS App**: SwiftUI
- **Backend API**: Node.js + TypeScript + Express
- **Database**: PostgreSQL
- **Payments**: Stripe Connect
- **Storage**: AWS S3 for media
- **Notifications**: Firebase Cloud Messaging

## 📁 Project Structure

```
CampusCuts/
├── contracts/           # Aptos Move smart contracts
├── ios-app/            # iOS SwiftUI application
├── backend/            # Node.js/TypeScript API server
├── docs/               # Documentation
└── scripts/            # Deployment and utility scripts
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Aptos CLI
- Xcode 15+
- PostgreSQL 14+
- Stripe account

### Smart Contract Development
```bash
cd contracts
aptos move compile
aptos move test
```

### Backend Setup
```bash
cd backend
npm install
npm run dev
```

### iOS App
```bash
cd ios-app
open CampusCuts.xcodeproj
# Build and run in Xcode
```

## 🔑 Key Features

### For Students
- Browse barbers by campus
- Filter by price, rating, hair type, availability
- Visual portfolio browsing
- Book appointments with calendar integration
- Rate and review services
- In-app messaging

### For Barbers
- Business dashboard with analytics
- Schedule management with templates
- Instant payouts
- Portfolio management
- Customer relationship tracking
- Earnings reports

## 🔐 Security & Compliance

- .edu email verification
- Student ID verification
- Peer-to-peer marketplace (independent contractors)
- No licensing requirements needed
- Platform absorbs all gas fees

## 📊 Business Model

- 5% commission on all transactions
- No subscription fees
- No hidden charges
- Transparent pricing

## 🛣️ Roadmap

### MVP (Current)
- ✅ Core booking system
- ✅ Payment processing
- ✅ Review system
- ✅ Basic analytics

### Future Enhancements
- AI barber recommendations
- Cross-campus marketplace
- Map-based discovery
- Social sharing features
- Android app

## 📄 License

MIT License - See LICENSE file for details

## 🤝 Contributing

Contributions welcome! Please read CONTRIBUTING.md for guidelines.

## 📞 Contact

For questions or support, reach out to [contact info]
