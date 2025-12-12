# AI Worker Integration (Direct Backend Integration)

The AI Worker is now **directly integrated** into the backend. No separate API server or HTTP calls needed.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                 Backend (Port 3001)                     │
│                                                         │
│  ┌────────────────────────────────────────────────┐   │
│  │  src/services/ai.service.ts                    │   │
│  │  - Directly imports AI functions               │   │
│  │  - No HTTP calls                               │   │
│  │  - In-process function calls                   │   │
│  └────────────────┬───────────────────────────────┘   │
│                   │                                     │
│                   ↓ Direct imports                      │
│  ┌────────────────────────────────────────────────┐   │
│  │  ai-worker/src/services/ai-functions.ts        │   │
│  │  - getBarberPricing()                          │   │
│  │  - getBarberQualityScore()                     │   │
│  │  - calculateBookingPrice()                     │   │
│  │  - getMarketSummary()                          │   │
│  └────────────────────────────────────────────────┘   │
│                                                         │
│  ┌────────────────────────────────────────────────┐   │
│  │  src/controllers/ai.controller.ts              │   │
│  │  src/routes/ai.routes.ts                       │   │
│  │  - Exposes AI data via REST API                │   │
│  └────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│        AI Worker Background Processors                  │
│        (Runs alongside backend)                         │
│                                                         │
│  ┌────────────────────────────────────────────────┐   │
│  │  BullMQ Workers (6 processors)                 │   │
│  │  - Review processing                           │   │
│  │  - Fraud detection                             │   │
│  │  - Dispute resolution                          │   │
│  │  - Market demand analysis                      │   │
│  └────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## 🎯 How It Works

### 1. **Backend Directly Calls AI Functions**

```typescript
// backend/src/services/ai.service.ts
import { getBarberPricing as aiGetBarberPricing } from '../../../ai-worker/src/services/ai-functions';

export async function getBarberPricing(barberId: string) {
  return await aiGetBarberPricing(barberId);  // Direct function call!
}
```

**No HTTP requests. No port 3002. Just direct TypeScript function calls.**

### 2. **Backend Exposes AI Data via REST API**

```typescript
// backend/src/routes/ai.routes.ts
router.get('/barber/:barberId/pricing', getBarberPricing);
router.get('/barber/:barberId/quality', getBarberQuality);
router.post('/booking/calculate-price', calculateBookingPrice);
```

**All AI features available through port 3001 (backend API)**

### 3. **Background Workers Process Events**

```typescript
// AI Worker still runs background processors
// But doesn't expose an HTTP API
npm run ai-worker  // Starts queue workers only
```

## 📡 API Endpoints (Port 3001)

All AI features are now accessed through the main backend:

### **Barber AI Data**

```bash
# Get pricing multiplier
GET http://localhost:3001/api/ai/barber/:barberId/pricing

# Get quality score
GET http://localhost:3001/api/ai/barber/:barberId/quality

# Get history
GET http://localhost:3001/api/ai/barber/:barberId/history

# Get complete analytics
GET http://localhost:3001/api/ai/barber/:barberId/analytics
```

### **Booking Price Calculation**

```bash
POST http://localhost:3001/api/ai/booking/calculate-price
{
  "barberId": "barber-123",
  "basePrice": 35
}

Response:
{
  "basePrice": 35,
  "multiplier": 1.25,
  "finalPrice": 43.75,
  "platformFee": 2.19,
  "barberReceives": 41.56,
  "reasoning": "High demand campus with excellent quality"
}
```

### **Admin Dashboard Data**

```bash
# Complete dashboard
GET http://localhost:3001/api/ai/admin/dashboard

# Market summary
GET http://localhost:3001/api/ai/admin/market-summary

# Fraud flags
GET http://localhost:3001/api/ai/admin/fraud-flags?status=PENDING&limit=50

# Disputes
GET http://localhost:3001/api/ai/admin/disputes?limit=50
```

## 🚀 Usage in Backend Code

### **Calculate Price with AI**

```typescript
// backend/src/controllers/booking.controller.ts
import aiService from '../services/ai.service';

export async function createBooking(req, res) {
  const { barberId, serviceType } = req.body;
  
  // Get barber's base price
  const barber = await getBarberProfile(barberId);
  const basePrice = barber.pricing[serviceType] || 35;
  
  // Calculate with AI multiplier
  const priceData = await aiService.calculateBookingPrice(barberId, basePrice);
  
  // priceData = {
  //   basePrice: 35,
  //   multiplier: 1.25,
  //   finalPrice: 43.75,
  //   platformFee: 2.19,
  //   barberReceives: 41.56
  // }
  
  // Use finalPrice for booking
  const booking = await createBookingRecord({
    ...req.body,
    price: priceData.finalPrice,
    platformFee: priceData.platformFee,
  });
  
  res.json({ booking, pricing: priceData });
}
```

### **Trigger AI Processing on Review**

```typescript
// backend/src/controllers/review.controller.ts
import aiService from '../services/ai.service';

export async function createReview(req, res) {
  const review = await saveReview(req.body);
  
  // Trigger AI processing (adds to queue)
  await aiService.triggerReviewProcessing({
    reviewId: review.id,
    barberId: review.barber_id,
    customerId: req.user.id,
    rating: review.rating,
    reviewText: review.text,
    bookingId: review.booking_id,
    createdAt: review.created_at,
  });
  
  res.json(review);
}
```

### **Get Barber Analytics**

```typescript
// backend/src/controllers/admin.controller.ts
import aiService from '../services/ai.service';

export async function getBarberAnalytics(req, res) {
  const { barberId } = req.params;
  
  // Get all AI data
  const [pricing, quality, history] = await Promise.all([
    aiService.getBarberPricing(barberId),
    aiService.getBarberQualityScore(barberId),
    aiService.getBarberHistory(barberId, 30),
  ]);
  
  res.json({
    barberId,
    currentPricing: pricing,
    currentQuality: quality,
    history,
  });
}
```

## 🔧 Setup

### **1. Backend Already Has Access**

The backend automatically imports AI functions:

```typescript
// backend/src/services/ai.service.ts
import { getBarberPricing } from '../../../ai-worker/src/services/ai-functions';
```

**No configuration needed!**

### **2. Start Background Workers**

The AI Worker still needs to run for background processing:

```bash
# Terminal 1: Start backend
cd backend
npm run dev  # Runs on port 3001

# Terminal 2: Start AI Worker (background processors only)
cd ai-worker
npm run dev  # No API server, just queue workers
```

### **3. Use AI Features**

```bash
# All AI features on port 3001
curl http://localhost:3001/api/ai/barber/barber-123/pricing
curl http://localhost:3001/api/ai/admin/dashboard
```

## 📊 Event Processing Flow

### **Example: New Review → AI Processing**

```
1. Student submits review
   POST /api/reviews

2. Backend saves review to database

3. Backend triggers AI processing:
   await aiService.triggerReviewProcessing({...})

4. Review added to Redis queue

5. AI Worker picks up job from queue

6. Worker fetches barber data

7. Worker calls OpenAI GPT-4

8. Worker saves results to PostgreSQL:
   - barber_quality_scores
   - barber_pricing_multipliers

9. Backend can now fetch updated data:
   GET /api/ai/barber/:id/pricing
   → Returns new multiplier
```

## ✅ Benefits of Direct Integration

| Feature | Before (Microservice) | After (Integrated) |
|---------|----------------------|-------------------|
| **Latency** | ~50ms HTTP overhead | ~1ms function call |
| **Complexity** | 2 servers, 2 ports | 1 server, 1 port |
| **Network** | HTTP requests | In-process |
| **Errors** | Network failures | Direct exceptions |
| **Deployment** | 2 services | 1 service + workers |
| **Development** | 2 terminals | 1 terminal (+ workers) |

## 🎨 Frontend Integration

Frontend still calls the backend (port 3001):

```typescript
// web-app/src/services/ai.service.ts
import axios from 'axios';

const API_URL = 'http://localhost:3001/api/ai';

export async function getBarberPricing(barberId: string) {
  const response = await axios.get(`${API_URL}/barber/${barberId}/pricing`);
  return response.data;
}

export async function calculateBookingPrice(barberId: string, basePrice: number) {
  const response = await axios.post(`${API_URL}/booking/calculate-price`, {
    barberId,
    basePrice,
  });
  return response.data;
}
```

## 🐛 Troubleshooting

### **Issue: "Cannot find module ai-worker"**

**Solution:** The AI Worker should be in the same repository:

```
CampusCuts/
├── backend/
│   └── src/
│       └── services/
│           └── ai.service.ts  # Imports from ../../ai-worker
└── ai-worker/
    └── src/
        └── services/
            └── ai-functions.ts
```

### **Issue: "AI functions returning default values"**

**Cause:** AI Worker processors haven't run yet.

**Solution:**
1. Ensure AI Worker is running: `cd ai-worker && npm run dev`
2. Trigger some reviews to populate AI data
3. Check PostgreSQL for `barber_quality_scores` table

### **Issue: "Queue jobs not processing"**

**Cause:** Redis not running or AI Worker not started.

**Solution:**
```bash
# Start Redis
redis-server

# Start AI Worker
cd ai-worker
npm run dev
```

## 📚 File Structure

```
backend/
├── src/
│   ├── services/
│   │   └── ai.service.ts          # AI service wrapper
│   ├── controllers/
│   │   └── ai.controller.ts       # AI API endpoints
│   └── routes/
│       └── ai.routes.ts           # AI routes

ai-worker/
├── src/
│   ├── services/
│   │   └── ai-functions.ts        # Direct callable functions
│   ├── processors/                # Background workers
│   │   ├── reviewProcessing.processor.ts
│   │   ├── fraudDetection.processor.ts
│   │   └── ...
│   ├── prompts/                   # AI prompt templates
│   └── queues/                    # BullMQ setup
```

## 🚀 Production Deployment

### **Option 1: Single Container**

```dockerfile
FROM node:20-alpine

# Copy both backend and ai-worker
COPY backend/ /app/backend/
COPY ai-worker/ /app/ai-worker/

# Install dependencies
RUN cd /app/backend && npm install
RUN cd /app/ai-worker && npm install

# Start both services
CMD ["sh", "-c", "cd /app/ai-worker && npm start & cd /app/backend && npm start"]
```

### **Option 2: Separate Containers**

```yaml
services:
  backend:
    build: ./backend
    ports:
      - "3001:3001"
    depends_on:
      - postgres
      - redis
    volumes:
      - ./ai-worker:/app/ai-worker:ro  # Read-only access

  ai-worker:
    build: ./ai-worker
    depends_on:
      - postgres
      - redis
```

---

**Summary:** AI Worker is now fully integrated into the backend. All AI features accessible via port 3001. No separate API needed! 🎉

