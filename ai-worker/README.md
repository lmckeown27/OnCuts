# CampusCuts AI Worker

Automated AI intelligence system for the CampusCuts platform. Handles dynamic pricing, fraud detection, dispute resolution, quality scoring, and administrative insights.

## 🎯 Overview

The AI Worker is a standalone microservice that processes queued events asynchronously using OpenAI's GPT-4, providing:

- **Dynamic Pricing**: Automatic price multipliers based on barber quality and market demand
- **Quality Scoring**: Continuous barber performance evaluation
- **Fraud Detection**: Pattern recognition for suspicious accounts
- **Dispute Resolution**: AI-assisted booking dispute analysis
- **Onboarding Assessment**: New user risk evaluation
- **Market Analysis**: Campus-level supply-demand intelligence
- **Weekly Summaries**: Automated admin reports

## 📁 Architecture

```
ai-worker/
├── src/
│   ├── api/              # Internal REST API
│   │   └── server.ts
│   ├── db/               # Database connection & schema
│   │   ├── connection.ts
│   │   └── schema.sql
│   ├── processors/       # BullMQ job processors
│   │   ├── reviewProcessing.processor.ts
│   │   ├── fraudDetection.processor.ts
│   │   ├── disputeResolution.processor.ts
│   │   ├── onboardingAssessment.processor.ts
│   │   ├── marketDemand.processor.ts
│   │   └── weeklySummary.processor.ts
│   ├── prompts/          # AI prompt templates
│   │   ├── dynamicPricingPrompt.ts
│   │   ├── fraudDetectionPrompt.ts
│   │   ├── disputeResolutionPrompt.ts
│   │   ├── onboardingAssessmentPrompt.ts
│   │   ├── marketDemandPrompt.ts
│   │   └── weeklySummaryPrompt.ts
│   ├── queues/           # BullMQ queue definitions
│   │   └── index.ts
│   ├── utils/            # Utilities
│   │   ├── logger.ts
│   │   └── openai-client.ts
│   └── index.ts          # Main entry point
├── Dockerfile
├── docker-compose.yml
└── package.json
```

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- OpenAI API Key

### Installation

1. **Clone and navigate:**
```bash
cd /path/to/CampusCuts/ai-worker
```

2. **Install dependencies:**
```bash
npm install
```

3. **Configure environment:**
Create `.env` file:
```env
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/campuscuts

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# OpenAI
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4-turbo-preview

# SendGrid (for email summaries)
SENDGRID_API_KEY=your-sendgrid-key
ADMIN_EMAIL=admin@campuscuts.com

# Worker Config
PORT=3002
NODE_ENV=development
LOG_LEVEL=info
QUEUE_CONCURRENCY=5
```

4. **Initialize database:**
```bash
psql -U postgres -d campuscuts -f src/db/schema.sql
```

5. **Run development server:**
```bash
npm run dev
```

### Docker Deployment

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f ai-worker

# Stop services
docker-compose down
```

## 📊 Event Processing

### Supported Events

| Event Type | Description | Processor |
|------------|-------------|-----------|
| `NEW_REVIEW_CREATED` | New barber review | Updates quality score & pricing |
| `BARBER_ONBOARDED` | New barber signs up | Assesses risk & quality prediction |
| `BOOKING_DISPUTED` | Customer disputes booking | Analyzes evidence & recommends action |
| `CANCELLATION_PATTERN_DETECTED` | Fraud trigger | Runs fraud detection |
| `MARKET_DEMAND_UPDATE` | Weekly market analysis | Calculates campus demand index |
| `WEEKLY_SUMMARY` | Admin report generation | Creates & emails summary |

### Adding Jobs to Queue

**From Main Backend:**

```typescript
import axios from 'axios';

// Add review processing job
await axios.post('http://localhost:3002/api/queue/review', {
  reviewId: 'review-123',
  barberId: 'barber-456',
  rating: 5,
  reviewText: 'Great haircut!',
  bookingId: 'booking-789',
  createdAt: new Date().toISOString(),
});
```

**Direct Queue Access:**

```typescript
import { addReviewProcessingJob } from './queues';

await addReviewProcessingJob({
  reviewId: 'review-123',
  barberId: 'barber-456',
  rating: 5,
  reviewText: 'Great haircut!',
  bookingId: 'booking-789',
  createdAt: new Date().toISOString(),
});
```

## 🔌 Internal API

The AI Worker exposes a REST API for the main backend to access AI-generated data.

### Endpoints

#### `GET /barber/:id/pricing`
Returns current pricing multiplier.

**Response:**
```json
{
  "barberId": "barber-123",
  "multiplier": 1.25,
  "breakdown": {
    "base": 1.0,
    "campusCoefficient": 0.1,
    "demandFactor": 0.1,
    "qualityFactor": 0.05
  },
  "reasoning": "High demand campus with excellent quality score",
  "expiresAt": "2024-01-15T00:00:00Z",
  "updatedAt": "2024-01-08T10:30:00Z"
}
```

#### `GET /barber/:id/quality-score`
Returns current quality score.

**Response:**
```json
{
  "barberId": "barber-123",
  "qualityScore": 87.5,
  "sentimentScore": 0.85,
  "reasoning": "Consistently high ratings with excellent repeat customer rate",
  "factors": {
    "demand_factor": 0.15,
    "quality_factor": 0.2,
    "campus_coefficient": 0.1,
    "flags": ["TOP_PERFORMER"]
  },
  "updatedAt": "2024-01-08T10:30:00Z"
}
```

#### `GET /barber/:id/history?limit=30`
Returns historical trends.

**Response:**
```json
{
  "barberId": "barber-123",
  "pricing": [
    { "multiplier": 1.25, "date": "2024-01-08T10:30:00Z" },
    { "multiplier": 1.20, "date": "2024-01-01T10:30:00Z" }
  ],
  "quality": [
    { "score": 87.5, "date": "2024-01-08T10:30:00Z" },
    { "score": 85.0, "date": "2024-01-01T10:30:00Z" }
  ]
}
```

#### `GET /admin/market-summary`
Returns campus market data.

#### `GET /admin/fraud-flags?status=PENDING&limit=50`
Returns fraud alerts.

#### `GET /admin/disputes?limit=50`
Returns pending disputes.

## 🧠 AI Prompt System

### Prompt Structure

Each AI task uses a structured prompt template with:

1. **System Prompt**: Defines AI role and expertise
2. **Input Data**: Contextual information
3. **Evaluation Criteria**: Decision-making guidelines
4. **Output Schema**: Strict JSON format

### Example: Dynamic Pricing

```typescript
const promptInput: DynamicPricingInput = {
  barberId: 'barber-123',
  recentReviews: [...],
  performanceLast60Days: {
    totalBookings: 45,
    completedBookings: 43,
    cancelledBookings: 2,
    avgRating: 4.8
  },
  cancellationRate: 0.04,
  latenessRate: 0.02,
  repeatCustomerRate: 0.65,
  campusMarketDemandIndex: 1.3,
  historicalQualityScore: 85
};

const result = await callAI<DynamicPricingOutput>({
  prompt: buildDynamicPricingPrompt(promptInput),
  systemPrompt: SYSTEM_PROMPT,
  jsonMode: true
});

// result.parsed = {
//   quality_score: 88,
//   pricing_multiplier: 1.25,
//   reasoning: "...",
//   flags: ["TOP_PERFORMER"]
// }
```

### Customizing Prompts

Edit templates in `src/prompts/*.ts`:

```typescript
export function buildDynamicPricingPrompt(input: DynamicPricingInput): string {
  return `
    You are an economic pricing analyst...
    
    BARBER PROFILE:
    - Quality Score: ${input.historicalQualityScore}/100
    - Cancellation Rate: ${input.cancellationRate * 100}%
    
    EVALUATION CRITERIA:
    - Quality Score (0-100): ...
    - Pricing Multiplier (0.8-1.5): ...
    
    OUTPUT (JSON ONLY):
    {
      "quality_score": <number>,
      "pricing_multiplier": <number>,
      ...
    }
  `;
}
```

## 💾 Database Schema

### Key Tables

#### `barber_quality_scores`
Stores AI-generated quality assessments.

```sql
CREATE TABLE barber_quality_scores (
  id SERIAL PRIMARY KEY,
  barber_id VARCHAR(255) NOT NULL,
  quality_score NUMERIC(5,2) CHECK (quality_score >= 0 AND quality_score <= 100),
  sentiment_score NUMERIC(3,2) CHECK (sentiment_score >= -1 AND sentiment_score <= 1),
  reasoning TEXT NOT NULL,
  factors JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### `barber_pricing_multipliers`
Stores dynamic pricing multipliers.

```sql
CREATE TABLE barber_pricing_multipliers (
  id SERIAL PRIMARY KEY,
  barber_id VARCHAR(255) NOT NULL,
  multiplier NUMERIC(3,2) CHECK (multiplier >= 0.8 AND multiplier <= 1.5),
  base_multiplier NUMERIC(3,2),
  campus_coefficient NUMERIC(3,2),
  demand_factor NUMERIC(3,2),
  quality_factor NUMERIC(3,2),
  reasoning TEXT,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### `fraud_flags`
Stores fraud detection alerts.

#### `dispute_recommendations`
Stores AI dispute resolution suggestions.

#### `market_stats`
Stores campus demand analysis.

#### `ai_events_log`
Logs all AI processing activities.

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DATABASE_URL` | PostgreSQL connection string | - | Yes |
| `REDIS_HOST` | Redis hostname | localhost | Yes |
| `REDIS_PORT` | Redis port | 6379 | Yes |
| `OPENAI_API_KEY` | OpenAI API key | - | Yes |
| `OPENAI_MODEL` | GPT model to use | gpt-4-turbo-preview | No |
| `SENDGRID_API_KEY` | SendGrid API key | - | No |
| `ADMIN_EMAIL` | Admin email for summaries | - | No |
| `PORT` | API server port | 3002 | No |
| `QUEUE_CONCURRENCY` | Jobs processed simultaneously | 5 | No |
| `QUEUE_MAX_RETRIES` | Max retry attempts | 3 | No |
| `LOG_LEVEL` | Logging level | info | No |

### Queue Configuration

Adjust in `src/queues/index.ts`:

```typescript
const defaultQueueOptions: QueueOptions = {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      age: 24 * 3600,
      count: 1000,
    },
  },
};
```

## 📈 Monitoring

### Health Check

```bash
curl http://localhost:3002/health
```

### View AI Events Log

```bash
curl http://localhost:3002/ai/events?limit=50
```

### Worker Status

Check logs for worker status:

```bash
docker-compose logs -f ai-worker | grep "Worker"
```

### Redis Queue Monitor

```bash
redis-cli
> KEYS bull:*
> LLEN bull:review-processing:waiting
```

## 🔒 Security

- API keys stored in environment variables
- Database credentials not hardcoded
- Non-root Docker user
- Input validation on all endpoints
- SQL injection protection via parameterized queries
- OpenAI request/response logging for audits

## 🧪 Testing

```bash
# Unit tests
npm test

# Test specific processor
npm test -- reviewProcessing.processor

# Integration tests
npm run test:integration
```

## 📦 Integration with Main Backend

### 1. Add AI Worker Client

```typescript
// backend/src/services/ai-worker-client.ts
import axios from 'axios';

const AI_WORKER_URL = process.env.AI_WORKER_URL || 'http://localhost:3002';

export async function getBarberPricing(barberId: string) {
  const response = await axios.get(`${AI_WORKER_URL}/barber/${barberId}/pricing`);
  return response.data;
}

export async function getBarberQualityScore(barberId: string) {
  const response = await axios.get(`${AI_WORKER_URL}/barber/${barberId}/quality-score`);
  return response.data;
}
```

### 2. Trigger AI Processing on Events

```typescript
// backend/src/controllers/review.controller.ts
import { addReviewProcessingJob } from '../services/queue-client';

export async function createReview(req, res) {
  const review = await saveReview(req.body);
  
  // Trigger AI processing
  await addReviewProcessingJob({
    reviewId: review.id,
    barberId: review.barber_id,
    rating: review.rating,
    reviewText: review.text,
    bookingId: review.booking_id,
    createdAt: review.created_at,
  });
  
  res.json(review);
}
```

### 3. Use AI-Generated Pricing

```typescript
// backend/src/controllers/booking.controller.ts
import { getBarberPricing } from '../services/ai-worker-client';

export async function calculatePrice(barberId: string, basePrice: number) {
  const pricingData = await getBarberPricing(barberId);
  const finalPrice = basePrice * pricingData.multiplier;
  
  return {
    basePrice,
    multiplier: pricingData.multiplier,
    finalPrice,
    reasoning: pricingData.reasoning,
  };
}
```

## 🤝 Contributing

1. Create feature branch
2. Add tests for new processors
3. Update prompt templates in `src/prompts/`
4. Document API changes
5. Submit PR with description

## 📄 License

MIT License - See LICENSE file

## 🆘 Support

- **Issues**: GitHub Issues
- **Email**: dev@campuscuts.com
- **Docs**: https://docs.campuscuts.com/ai-worker

---

**Built with ChatGPT-style automated intelligence for CampusCuts** 🤖✨

