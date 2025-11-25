# CampusCuts Deployment Guide

This guide covers deploying CampusCuts to production.

## Overview

CampusCuts consists of three main components:

1. **Aptos Smart Contracts** - Deployed to Aptos blockchain
2. **Backend API** - Deployed to cloud service (AWS, GCP, Heroku)
3. **iOS App** - Deployed to Apple App Store

---

## 1. Deploy Smart Contracts

### Prerequisites

- Aptos CLI installed
- Funded Aptos account (mainnet)
- Network configuration set up

### Steps

1. **Initialize mainnet profile:**
   ```bash
   aptos init --profile mainnet --network mainnet
   ```

2. **Fund your account:**
   - Transfer APT to your deployment address
   - Ensure sufficient balance for deployment + gas fees

3. **Compile contracts:**
   ```bash
   cd contracts
   aptos move compile --skip-fetch-latest-git-deps
   ```

4. **Run tests:**
   ```bash
   aptos move test --skip-fetch-latest-git-deps
   ```

5. **Deploy to mainnet:**
   ```bash
   ./scripts/deploy-contracts.sh mainnet
   ```

6. **Save deployment info:**
   - Record contract address
   - Update backend environment variables

---

## 2. Deploy Backend API

### Option A: AWS Elastic Beanstalk

1. **Install EB CLI:**
   ```bash
   pip install awsebcli
   ```

2. **Initialize EB:**
   ```bash
   cd backend
   eb init -p node.js campuscuts-api
   ```

3. **Create environment:**
   ```bash
   eb create campuscuts-prod
   ```

4. **Set environment variables:**
   ```bash
   eb setenv \
     NODE_ENV=production \
     DATABASE_URL=<rds_url> \
     JWT_SECRET=<secret> \
     STRIPE_SECRET_KEY=<key> \
     APTOS_PLATFORM_ADDRESS=<address>
   ```

5. **Deploy:**
   ```bash
   eb deploy
   ```

### Option B: Heroku

1. **Create app:**
   ```bash
   heroku create campuscuts-api
   ```

2. **Add PostgreSQL:**
   ```bash
   heroku addons:create heroku-postgresql:standard-0
   ```

3. **Set config vars:**
   ```bash
   heroku config:set \
     NODE_ENV=production \
     JWT_SECRET=<secret> \
     STRIPE_SECRET_KEY=<key>
   ```

4. **Deploy:**
   ```bash
   git push heroku main
   ```

### Option C: Docker + AWS ECS

1. **Build image:**
   ```bash
   docker build -t campuscuts-api ./backend
   ```

2. **Push to ECR:**
   ```bash
   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account_id>.dkr.ecr.us-east-1.amazonaws.com
   docker tag campuscuts-api:latest <account_id>.dkr.ecr.us-east-1.amazonaws.com/campuscuts-api:latest
   docker push <account_id>.dkr.ecr.us-east-1.amazonaws.com/campuscuts-api:latest
   ```

3. **Deploy to ECS:**
   - Create task definition
   - Create service
   - Configure load balancer

---

## 3. Database Setup

### PostgreSQL (Production)

1. **Use managed service:**
   - AWS RDS
   - Google Cloud SQL
   - Heroku Postgres

2. **Create database:**
   ```sql
   CREATE DATABASE campuscuts;
   ```

3. **Run schema:**
   ```bash
   psql -h <host> -U <user> -d campuscuts -f backend/src/database/schema.sql
   ```

4. **Enable PostGIS:**
   ```sql
   CREATE EXTENSION postgis;
   ```

5. **Set up backups:**
   - Configure automated daily backups
   - Test restore process

---

## 4. iOS App Deployment

### Prerequisites

- Apple Developer Account ($99/year)
- App Store Connect access
- Valid code signing certificates

### Steps

1. **Update version and build number:**
   - Open Xcode project
   - Target settings → General → Version/Build

2. **Configure app signing:**
   - Select your development team
   - Choose automatic signing

3. **Update API endpoint:**
   ```swift
   // In Constants.swift
   static let baseURL = "https://api.campuscuts.com/api"
   ```

4. **Archive for distribution:**
   - Product → Archive
   - Wait for archive to complete

5. **Upload to App Store Connect:**
   - Window → Organizer
   - Select archive
   - Click "Distribute App"
   - Choose "App Store Connect"
   - Upload

6. **Submit for review:**
   - Go to App Store Connect
   - Complete app information
   - Add screenshots
   - Submit for review

---

## 5. Third-Party Services Configuration

### Stripe

1. **Create Stripe account**
2. **Enable Stripe Connect** for marketplace
3. **Configure webhooks:**
   - URL: `https://api.campuscuts.com/api/payments/webhook`
   - Events: `payment_intent.*`, `transfer.*`
4. **Get API keys** (live mode)
5. **Update backend env variables**

### AWS S3

1. **Create S3 bucket:** `campuscuts-media-prod`
2. **Configure CORS:**
   ```json
   [
     {
       "AllowedOrigins": ["https://campuscuts.com"],
       "AllowedMethods": ["GET", "PUT", "POST"],
       "AllowedHeaders": ["*"]
     }
   ]
   ```
3. **Set up IAM user** with S3 permissions
4. **Get access keys**
5. **Update backend env variables**

### Firebase

1. **Create Firebase project**
2. **Enable Cloud Messaging**
3. **Download service account JSON**
4. **Extract credentials:**
   - Project ID
   - Private key
   - Client email
5. **Update backend env variables**

---

## 6. Environment Variables

### Backend Production Environment

```bash
# Server
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=postgresql://user:pass@host:5432/campuscuts

# JWT
JWT_SECRET=<strong-random-secret>
JWT_REFRESH_SECRET=<another-strong-secret>

# Aptos
APTOS_NODE_URL=https://fullnode.mainnet.aptoslabs.com/v1
APTOS_NETWORK=mainnet
APTOS_PLATFORM_ADDRESS=0x...
APTOS_PLATFORM_PRIVATE_KEY=0x...

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# AWS
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=campuscuts-media-prod

# Firebase
FIREBASE_PROJECT_ID=...
FIREBASE_PRIVATE_KEY="..."
FIREBASE_CLIENT_EMAIL=...
```

---

## 7. Monitoring & Logging

### Backend Monitoring

1. **Set up APM:**
   - New Relic
   - Datadog
   - AWS CloudWatch

2. **Error tracking:**
   - Sentry integration
   - Log aggregation

3. **Performance monitoring:**
   - API response times
   - Database query performance
   - Blockchain transaction success rate

### iOS App Monitoring

1. **Firebase Crashlytics**
2. **Firebase Analytics**
3. **App Store Connect analytics**

---

## 8. Security Checklist

- [ ] All secrets in environment variables (not in code)
- [ ] HTTPS enforced on all endpoints
- [ ] Database connections encrypted (SSL)
- [ ] Rate limiting enabled
- [ ] CORS properly configured
- [ ] Helmet.js security headers
- [ ] Input validation on all endpoints
- [ ] SQL injection protection (parameterized queries)
- [ ] XSS protection
- [ ] Private keys stored in AWS KMS or similar
- [ ] Regular security audits

---

## 9. Pre-Launch Checklist

### Smart Contracts
- [ ] Audited by third party
- [ ] All tests passing
- [ ] Gas optimization complete
- [ ] Deployed to mainnet
- [ ] Initialization transactions confirmed

### Backend
- [ ] All tests passing
- [ ] Load testing completed
- [ ] Database indexes optimized
- [ ] Logging configured
- [ ] Monitoring set up
- [ ] Backup strategy in place
- [ ] SSL certificates configured

### iOS App
- [ ] All features tested on device
- [ ] App Store guidelines compliance
- [ ] Privacy policy published
- [ ] Terms of service published
- [ ] Screenshots prepared
- [ ] App description written
- [ ] Support URL configured

### Business
- [ ] Stripe Connect approved
- [ ] Legal documents reviewed
- [ ] Support email configured
- [ ] Marketing materials ready
- [ ] Campus partnerships established

---

## 10. Rollback Procedure

### Backend Rollback

**Heroku:**
```bash
heroku releases:rollback v123
```

**AWS EB:**
```bash
eb deploy --version <previous_version>
```

### iOS App Rollback

- Cannot rollback published apps
- Can release new version quickly
- Can remove app from sale temporarily

### Smart Contract "Rollback"

- Smart contracts are immutable
- Use circuit breaker pattern if needed
- Deploy new version with migration path

---

## 11. Scaling Strategy

### Phase 1: Single Campus (0-1000 users)
- Single backend server
- Basic database instance
- Minimal infrastructure

### Phase 2: Multi-Campus (1000-10000 users)
- Horizontal scaling (2-4 backend servers)
- Load balancer
- Database read replicas
- CDN for media

### Phase 3: National Scale (10000+ users)
- Auto-scaling groups
- Database sharding by campus
- Microservices architecture
- Advanced caching (Redis)
- Multiple regions

---

## Support

For deployment questions:
- Email: devops@campuscuts.com
- Docs: https://docs.campuscuts.com
- GitHub Issues: https://github.com/lmckeown27/CampusCuts/issues

