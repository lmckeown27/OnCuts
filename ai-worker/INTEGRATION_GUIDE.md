# AI Worker Integration Guide

Complete guide for integrating the AI Worker with the main CampusCuts backend.

## 🔌 Integration Points

The AI Worker integrates with the main backend through:

1. **REST API** - Pull AI-generated data
2. **Queue Events** - Push events for AI processing
3. **Database** - Shared PostgreSQL database
4. **Redis** - Shared queue infrastructure

## 📡 Backend Integration Steps

### Step 1: Install Dependencies

Add to `backend/package.json`:

```json
{
  "dependencies": {
    "bull": "^4.11.0",
    "axios": "^1.6.0"
  }
}
```

### Step 2: Create AI Worker Client

Create `backend/src/services/ai-worker.client.ts`:

```typescript
import axios from 'axios';
import { logger } from '../utils/logger';

const AI_WORKER_URL = process.env.AI_WORKER_URL || 'http://localhost:3002';

class AIWorkerClient {
  /**
   * Get current pricing multiplier for barber
   */
  async getBarberPricing(barberId: string) {
    try {
      const response = await axios.get(`${AI_WORKER_URL}/barber/${barberId}/pricing`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        // No AI pricing yet, use default
        return { multiplier: 1.0, defaultMultiplier: true };
      }
      logger.error('Failed to fetch barber pricing:', error);
      return { multiplier: 1.0, error: true };
    }
  }

  /**
   * Get quality score for barber
   */
  async getBarberQualityScore(barberId: string) {
    try {
      const response = await axios.get(`${AI_WORKER_URL}/barber/${barberId}/quality-score`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return { qualityScore: 50, defaultScore: true };
      }
      logger.error('Failed to fetch quality score:', error);
      return { qualityScore: 50, error: true };
    }
  }

  /**
   * Get barber pricing/quality history
   */
  async getBarberHistory(barberId: string, limit = 30) {
    try {
      const response = await axios.get(`${AI_WORKER_URL}/barber/${barberId}/history`, {
        params: { limit },
      });
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch barber history:', error);
      return { pricing: [], quality: [] };
    }
  }

  /**
   * Get market summary for admin dashboard
   */
  async getMarketSummary() {
    try {
      const response = await axios.get(`${AI_WORKER_URL}/admin/market-summary`);
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch market summary:', error);
      return null;
    }
  }

  /**
   * Get fraud flags for admin
   */
  async getFraudFlags(status = 'PENDING', limit = 50) {
    try {
      const response = await axios.get(`${AI_WORKER_URL}/admin/fraud-flags`, {
        params: { status, limit },
      });
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch fraud flags:', error);
      return { flags: [] };
    }
  }

  /**
   * Get dispute recommendations
   */
  async getDisputes(limit = 50) {
    try {
      const response = await axios.get(`${AI_WORKER_URL}/admin/disputes`, {
        params: { limit },
      });
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch disputes:', error);
      return { disputes: [] };
    }
  }
}

export default new AIWorkerClient();
```

### Step 3: Create Queue Client

Create `backend/src/services/ai-queue.client.ts`:

```typescript
import Queue from 'bull';
import { logger } from '../utils/logger';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Create queue instances
const reviewQueue = new Queue('review-processing', REDIS_URL);
const fraudQueue = new Queue('fraud-detection', REDIS_URL);
const disputeQueue = new Queue('dispute-resolution', REDIS_URL);
const onboardingQueue = new Queue('barber-onboarding', REDIS_URL);
const marketQueue = new Queue('market-demand', REDIS_URL);

export async function triggerReviewProcessing(reviewData: {
  reviewId: string;
  barberId: string;
  customerId: string;
  rating: number;
  reviewText: string;
  bookingId: string;
  createdAt: string;
}) {
  try {
    await reviewQueue.add('process-review', reviewData);
    logger.info(`Review processing queued: ${reviewData.reviewId}`);
  } catch (error) {
    logger.error('Failed to queue review processing:', error);
  }
}

export async function triggerFraudDetection(userId: string, userType: 'barber' | 'customer', reason: string) {
  try {
    await fraudQueue.add('detect-fraud', { userId, userType, triggerReason: reason });
    logger.info(`Fraud detection queued for user: ${userId}`);
  } catch (error) {
    logger.error('Failed to queue fraud detection:', error);
  }
}

export async function triggerDisputeResolution(disputeData: {
  bookingId: string;
  disputeId: string;
  disputeReason: string;
  disputeDescription: string;
}) {
  try {
    await disputeQueue.add('resolve-dispute', disputeData);
    logger.info(`Dispute resolution queued: ${disputeData.disputeId}`);
  } catch (error) {
    logger.error('Failed to queue dispute resolution:', error);
  }
}

export async function triggerOnboardingAssessment(applicationData: any) {
  try {
    await onboardingQueue.add('onboarding-assessment', applicationData);
    logger.info(`Onboarding assessment queued for: ${applicationData.userId}`);
  } catch (error) {
    logger.error('Failed to queue onboarding assessment:', error);
  }
}

export async function triggerMarketDemandUpdate(campusId: string, campusName: string) {
  try {
    await marketQueue.add('calculate-demand', { campusId, campusName });
    logger.info(`Market demand update queued for: ${campusName}`);
  } catch (error) {
    logger.error('Failed to queue market demand update:', error);
  }
}
```

### Step 4: Integrate with Review Creation

Update `backend/src/controllers/review.controller.ts`:

```typescript
import { triggerReviewProcessing } from '../services/ai-queue.client';

export async function createReview(req: Request, res: Response) {
  try {
    const { booking_id, rating, review_text } = req.body;
    const user_id = req.user.id;

    // Get booking details
    const booking = await getBooking(booking_id);

    // Save review to database
    const review = await pool.query(
      `INSERT INTO reviews (booking_id, user_id, barber_id, rating, review_text, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [booking_id, user_id, booking.barber_id, rating, review_text]
    );

    // Trigger AI processing asynchronously
    triggerReviewProcessing({
      reviewId: review.rows[0].id,
      barberId: booking.barber_id,
      customerId: user_id,
      rating,
      reviewText: review_text,
      bookingId: booking_id,
      createdAt: review.rows[0].created_at,
    }).catch(err => logger.error('AI trigger failed:', err));

    res.status(201).json({
      success: true,
      review: review.rows[0],
    });
  } catch (error) {
    logger.error('Create review error:', error);
    res.status(500).json({ error: 'Failed to create review' });
  }
}
```

### Step 5: Integrate Dynamic Pricing

Update `backend/src/controllers/booking.controller.ts`:

```typescript
import aiWorkerClient from '../services/ai-worker.client';

export async function calculateBookingPrice(req: Request, res: Response) {
  try {
    const { barber_id, service_type } = req.body;

    // Get base price from barber profile
    const barber = await getBarberProfile(barber_id);
    const basePrice = barber.pricing[service_type] || 35;

    // Get AI-generated pricing multiplier
    const pricingData = await aiWorkerClient.getBarberPricing(barber_id);

    // Calculate final price
    const finalPrice = Math.round(basePrice * pricingData.multiplier * 100) / 100;
    const platformFee = Math.round(finalPrice * 0.05 * 100) / 100;

    res.json({
      basePrice,
      multiplier: pricingData.multiplier,
      finalPrice,
      platformFee,
      barberReceives: finalPrice - platformFee,
      reasoning: pricingData.reasoning,
      breakdown: pricingData.breakdown,
    });
  } catch (error) {
    logger.error('Calculate price error:', error);
    res.status(500).json({ error: 'Failed to calculate price' });
  }
}
```

### Step 6: Add Admin Dashboard Endpoints

Update `backend/src/controllers/admin.controller.ts`:

```typescript
import aiWorkerClient from '../services/ai-worker.client';

export async function getAdminDashboard(req: Request, res: Response) {
  try {
    // Get AI-generated market summary
    const marketSummary = await aiWorkerClient.getMarketSummary();
    
    // Get fraud alerts
    const fraudAlerts = await aiWorkerClient.getFraudFlags('PENDING', 10);
    
    // Get pending disputes
    const disputes = await aiWorkerClient.getDisputes(10);

    res.json({
      marketSummary,
      fraudAlerts: fraudAlerts.flags,
      disputes: disputes.disputes,
      lastUpdated: new Date(),
    });
  } catch (error) {
    logger.error('Admin dashboard error:', error);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
}

export async function getBarberAnalytics(req: Request, res: Response) {
  try {
    const { barberId } = req.params;

    const [pricing, qualityScore, history] = await Promise.all([
      aiWorkerClient.getBarberPricing(barberId),
      aiWorkerClient.getBarberQualityScore(barberId),
      aiWorkerClient.getBarberHistory(barberId, 30),
    ]);

    res.json({
      barberId,
      currentPricing: pricing,
      currentQuality: qualityScore,
      history,
    });
  } catch (error) {
    logger.error('Barber analytics error:', error);
    res.status(500).json({ error: 'Failed to load analytics' });
  }
}
```

### Step 7: Add Environment Variables

Add to `backend/.env`:

```env
# AI Worker
AI_WORKER_URL=http://localhost:3002
REDIS_URL=redis://localhost:6379
```

### Step 8: Update Routes

Add to `backend/src/routes/admin.routes.ts`:

```typescript
router.get('/dashboard', authenticate, isAdmin, getAdminDashboard);
router.get('/barber/:barberId/analytics', authenticate, isAdmin, getBarberAnalytics);
```

## 🎯 Event Triggers

### When to Trigger AI Processing

| Event | When to Trigger | Why |
|-------|----------------|-----|
| Review Created | Immediately after review save | Update barber quality & pricing |
| Barber Onboards | During signup process | Risk assessment & quality prediction |
| Dispute Filed | When customer/barber files dispute | Get resolution recommendation |
| Cancellation Pattern | After 3+ cancellations in 7 days | Check for fraud |
| Market Update | Daily cron job at 2 AM | Refresh campus demand index |
| Weekly Summary | Sunday at 9 AM | Generate admin report |

### Cron Jobs for Automated Processing

Create `backend/src/cron/ai-worker-cron.ts`:

```typescript
import cron from 'node-cron';
import { triggerMarketDemandUpdate } from '../services/ai-queue.client';
import { logger } from '../utils/logger';

// Run market demand analysis daily at 2 AM
cron.schedule('0 2 * * *', async () => {
  logger.info('Running daily market demand analysis');
  
  const campuses = await getAllCampuses();
  
  for (const campus of campuses) {
    await triggerMarketDemandUpdate(campus.id, campus.name);
  }
});

// Trigger weekly summary on Sundays at 9 AM
cron.schedule('0 9 * * 0', async () => {
  logger.info('Triggering weekly summary generation');
  // Weekly summary runs automatically in AI worker
});
```

## 🔧 Error Handling

### Graceful Degradation

```typescript
export async function getBarberPricingWithFallback(barberId: string) {
  try {
    const pricingData = await aiWorkerClient.getBarberPricing(barberId);
    return pricingData;
  } catch (error) {
    logger.warn(`AI Worker unavailable, using default pricing for ${barberId}`);
    return {
      multiplier: 1.0,
      fallback: true,
      reasoning: 'AI Worker unavailable, using default pricing',
    };
  }
}
```

### Retry Logic

```typescript
import { retry } from '../utils/retry';

export async function getBarberPricingWithRetry(barberId: string) {
  return await retry(
    () => aiWorkerClient.getBarberPricing(barberId),
    {
      retries: 3,
      delay: 1000,
      backoff: 2,
    }
  );
}
```

## 📊 Monitoring Integration

### Add Health Check

Update `backend/src/routes/health.routes.ts`:

```typescript
import axios from 'axios';

router.get('/health', async (req, res) => {
  const checks = {
    database: await checkDatabase(),
    redis: await checkRedis(),
    aiWorker: await checkAIWorker(),
  };

  const allHealthy = Object.values(checks).every(c => c.healthy);

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'healthy' : 'degraded',
    checks,
  });
});

async function checkAIWorker() {
  try {
    const response = await axios.get(`${AI_WORKER_URL}/health`, { timeout: 5000 });
    return { healthy: response.status === 200, service: 'ai-worker' };
  } catch (error) {
    return { healthy: false, service: 'ai-worker', error: 'unreachable' };
  }
}
```

## 🚀 Production Deployment

### Docker Compose Integration

Update root `docker-compose.prod.yml`:

```yaml
services:
  backend:
    # ... existing config
    depends_on:
      - ai-worker
    environment:
      AI_WORKER_URL: http://ai-worker:3002

  ai-worker:
    build: ./ai-worker
    depends_on:
      - postgres
      - redis
    environment:
      DATABASE_URL: postgresql://postgres:password@postgres:5432/campuscuts
      REDIS_HOST: redis
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      SENDGRID_API_KEY: ${SENDGRID_API_KEY}
    ports:
      - "3002:3002"
    restart: unless-stopped
```

## ✅ Testing Integration

Create `backend/src/tests/ai-worker-integration.test.ts`:

```typescript
import aiWorkerClient from '../services/ai-worker.client';

describe('AI Worker Integration', () => {
  test('should fetch barber pricing', async () => {
    const pricing = await aiWorkerClient.getBarberPricing('test-barber');
    expect(pricing).toHaveProperty('multiplier');
    expect(pricing.multiplier).toBeGreaterThanOrEqual(0.8);
    expect(pricing.multiplier).toBeLessThanOrEqual(1.5);
  });

  test('should handle AI worker unavailable gracefully', async () => {
    // Simulate AI worker down
    process.env.AI_WORKER_URL = 'http://localhost:9999';
    
    const pricing = await aiWorkerClient.getBarberPricing('test-barber');
    expect(pricing.multiplier).toBe(1.0);
    expect(pricing.error).toBe(true);
  });
});
```

---

**Integration Complete!** Your main backend now has full access to AI-powered features. 🎉

