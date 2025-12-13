# CampusCuts Scoring & Visibility System
## Merit-Based Marketplace Without Score Anxiety

**Version:** 1.0  
**Last Updated:** December 12, 2025  
**Status:** Active

---

## Overview

CampusCuts uses a **dual scoring system** to create a fair, merit-based marketplace:

1. **Consumer Reliability Scores** - Track booking completion, no-shows, and behavior
2. **Barber Quality Scores (BQS)** - Track service quality, availability, and performance

**Key Principle:** Users cannot see their own scores, but can see the scores of people they're considering booking with.

---

## Scoring Visibility Rules

### ✅ What Users CAN See

#### Consumers Can See:

**Barber Information:**
- ⭐ Average rating (e.g., 4.8 stars)
- 📊 Total reviews (e.g., 127 reviews)
- 📅 Total bookings (e.g., 450 completed)
- 🎓 Years of experience
- 🏆 Specialties and service types
- ⚡ Instant book status
- 📸 Portfolio images
- 📱 Instagram handle (if linked)
- ✅ Verification status

**Where Displayed:**
- Discovery page barber cards
- Barber profile pages
- Search/filter results

**Purpose:** Helps consumers make informed decisions about which barber to book.

---

#### Barbers Can See:

**Consumer Information:**
- 📊 Completion rate (e.g., 92%)
- ✅ Total bookings completed
- ❌ No-show count
- ⭐ Average rating from other barbers
- 📝 Total reviews received
- 🎯 Reliability badge (Reliable/Good/Caution)
- 📅 Member since date
- 💬 Booking history stats

**Where Displayed:**
- Booking request cards (quick stats)
- Customer profile modal (detailed view)
- Appointment details page

**Purpose:** Helps barbers assess customer reliability before accepting bookings.

---

#### Admins Can See:

**All Scores & Metrics:**
- 📊 Consumer reliability scores (all users)
- 🏆 Barber Quality Scores (BQS)
- 📈 Platform analytics
- 🎯 Ranking positions
- 📉 Performance trends
- ⚠️ Fraud detection flags
- 🔍 Market statistics
- 💰 Pricing multipliers
- 🚨 Alert history

**Where Displayed:**
- Admin dashboard
- Campus-specific pages
- User management views
- Analytics panels
- Market management

**Purpose:** Platform oversight, quality control, fraud prevention, market optimization.

---

### ❌ What Users CANNOT See

#### Consumers CANNOT See:

- 🚫 Their own reliability score
- 🚫 Their own completion rate
- 🚫 Their own quality metrics
- 🚫 How they rank vs other consumers
- 🚫 How barbers rate them individually
- 🚫 Their "score dashboard"
- 🚫 Performance breakdown

**Why Hidden:**
- Prevents score anxiety
- Reduces metric gaming
- Focuses on quality interactions
- No social comparison pressure

---

#### Barbers CANNOT See:

- 🚫 Their own Quality Score (BQS)
- 🚫 Their own ranking position
- 🚫 Their performance metrics dashboard
- 🚫 How they rank vs other barbers
- 🚫 Their pricing multiplier
- 🚫 Their demand normalization factor
- 🚫 Algorithm-specific metrics

**Why Hidden:**
- Prevents obsession over rankings
- Reduces competitive gaming
- Focuses on service quality
- Avoids status competition
- No VIP hierarchy visible to users

**What Barbers DO See:**
- ✅ Public ratings and reviews (everyone sees this)
- ✅ Total bookings completed (public stat)
- ✅ Their pricing settings (what they control)
- ✅ Their availability calendar

---

## Scoring System Components

### Consumer Reliability Score

**Formula Components:**

```typescript
interface ConsumerMetrics {
  totalBookings: number;        // Total appointments booked
  completedBookings: number;    // Successfully completed
  cancelledBookings: number;    // Cancelled by consumer
  noShowCount: number;          // Didn't show up
  avgRating: number;            // Avg rating from barbers
  totalReviews: number;         // # of reviews received
  completionRate: number;       // (completed / total) * 100
  responseRate: number;         // How quickly they respond
  isReliable: boolean;          // completionRate >= 90% && noShowCount === 0
}
```

**Reliability Badge Calculation:**

```typescript
if (completionRate >= 90 && noShowCount === 0) {
  badge = "Reliable" // Green
} else if (completionRate >= 70 && noShowCount < 3) {
  badge = "Good" // Yellow
} else {
  badge = "Caution" // Red
}
```

**Used For:**
- Barber decision-making (accept/reject requests)
- Algorithm matching (pair reliable users)
- Fraud detection (identify problematic patterns)

---

### Barber Quality Score (BQS)

**Formula:**

```
BQS = 0.45*R + 0.25*D + 0.15*P + 0.15*L
```

**Where:**
- **R** = ReviewScoreWeighted = `avg_rating * log(1 + total_reviews)`
- **D** = DemandScore = `(slots_booked / slots_available) * 100`
- **P** = PriceJustificationScore = `100 * (repeat_bookings_at_price / total_bookings_at_price)`
- **L** = LoyaltyScore = `(repeat_customers / total_customers) * 100`

**Pricing Multiplier (Based on BQS):**

```
BQS < 60  → multiplier = 1.0
BQS 60-80 → multiplier = 1.10
BQS 80-90 → multiplier = 1.25
BQS 90+   → multiplier = 1.50
```

**Used For:**
- Discovery page ranking (capitalistic algorithm)
- Dynamic pricing bounds (earn higher max prices)
- Market-level adjustments
- Visibility in search results

---

## Algorithmic Ranking

### Consumer Discovery Algorithm

**How Barbers Are Ranked:**

```typescript
function rankBarbers(barbers: Barber[]): Barber[] {
  return barbers
    .map((barber) => {
      let score = barber.average_rating * 100;  // Base: rating
      
      score += Math.log(barber.total_bookings + 1) * 10;  // Experience
      score += barber.years_experience * 5;                // Tenure
      
      // Newcomer boost
      if (barber.total_bookings < 20 && barber.average_rating >= 4.5) {
        score += 20;
      }
      
      // Convenience bonus
      if (barber.instant_book_enabled) {
        score += 15;
      }
      
      return { barber, score };
    })
    .sort((a, b) => b.score - a.score)
    .map(({ barber }) => barber);
}
```

**Ranking Factors:**
1. **Rating (Weighted Heavily)** - Quality of service
2. **Experience** - Total bookings completed
3. **Tenure** - Years in business
4. **Newcomer Adjustment** - Give new high-performers a chance
5. **Instant Book** - Convenience factor

**Market Calibration:**

Different markets have different sensitivity:
- **Large Markets (LA):** More dramatic BQS impact
- **Small Markets (SLO):** More weight on availability/reviews

---

## User Interface Examples

### Consumer View: Discovering Barbers

```
┌─────────────────────────────────────────┐
│  Discover Barbers                       │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐ │
│  │ [Photo] │  │ [Photo] │  │ [Photo] │ │
│  │         │  │         │  │         │ │
│  │ Marcus  │  │ Alex    │  │ David   │ │
│  │ ⭐ 4.9   │  │ ⭐ 4.8   │  │ ⭐ 4.7   │ │
│  │ 127 rvw │  │ 95 rvw  │  │ 78 rvw  │ │
│  │ 450 bks │  │ 320 bks │  │ 250 bks │ │
│  │ From $25│  │ From $22│  │ From $30│ │
│  │ [View]  │  │ [View]  │  │ [View]  │ │
│  └─────────┘  └─────────┘  └─────────┘ │
│                                         │
└─────────────────────────────────────────┘

✅ Consumer sees: Barber ratings & stats
❌ Consumer does NOT see: Their own score
```

---

### Barber View: Booking Requests

```
┌─────────────────────────────────────────┐
│  Pending Booking Requests (3)           │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  JD  Sarah Johnson              │   │
│  │      [Reliable Badge]           │   │
│  │                                 │   │
│  │  Bookings: 45  | Completion: 96%│  │
│  │  Rating: ⭐ 4.8 | No-shows: 0   │   │
│  │                                 │   │
│  │  📅 Friday, Jan 15 at 2:00 PM   │   │
│  │  Service: Fade • $25            │   │
│  │                                 │   │
│  │  [Accept]  [Decline]            │   │
│  └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘

✅ Barber sees: Consumer reliability stats
❌ Barber does NOT see: Their own BQS
```

---

### Admin View: All Metrics

```
┌─────────────────────────────────────────┐
│  Campus Dashboard - Cal Poly SLO        │
├─────────────────────────────────────────┤
│                                         │
│  TOP BARBERS (by BQS):                  │
│  1. Marcus Williams - BQS 94.2          │
│  2. Alex Rivera - BQS 91.8              │
│  3. David Kim - BQS 88.5                │
│                                         │
│  TOP CONSUMERS (by Reliability):        │
│  1. Sarah Johnson - 98% completion      │
│  2. Mike Chen - 95% completion          │
│  3. Emma Davis - 93% completion         │
│                                         │
│  MARKET STATS:                          │
│  Avg BQS: 78.3                          │
│  Avg Consumer Reliability: 87.2%        │
│  Active Barbers: 24                     │
│  Active Consumers: 1,247                │
│                                         │
└─────────────────────────────────────────┘

✅ Admin sees: All scores, rankings, metrics
```

---

## Design Philosophy

### Why Hide Self-Scores?

#### 1. **Reduces Score Anxiety**

**Problem Avoided:**
```
❌ "My reliability is 87%... why not 90%?"
❌ "I'm ranked #15... how do I get to #10?"
❌ "My BQS dropped 2 points this week!"
```

**Result:**
```
✅ Users focus on quality service
✅ Natural behavior, not metric gaming
✅ Less stress and comparison
```

---

#### 2. **Prevents Metric Gaming**

**Problem Avoided:**
```
❌ Barbers declining low-paying customers to boost metrics
❌ Consumers requesting cancellations to avoid no-show marks
❌ Users optimizing for visible scores instead of quality
```

**Result:**
```
✅ Authentic interactions
✅ Merit-based outcomes
✅ Long-term quality focus
```

---

#### 3. **Maintains Fair Competition**

**Problem Avoided:**
```
❌ Top barbers displaying "Rank #1" badges
❌ VIP status creating two-tier system
❌ New barbers feeling discouraged by visible rankings
```

**Result:**
```
✅ No visible hierarchy
✅ Everyone competes on quality
✅ Newcomers get fair chance
```

---

#### 4. **Enables Informed Decisions**

**What Users Need:**
```
✅ Consumers see barber quality → Make informed bookings
✅ Barbers see consumer reliability → Accept good customers
✅ Algorithm uses scores → Match compatible users
```

**What Users Don't Need:**
```
❌ Seeing own score → Creates anxiety
❌ Comparing to others → Creates competition
❌ Tracking daily changes → Creates obsession
```

---

## Technical Implementation

### Consumer Page Structure

**Before (With Score Tab):**
```typescript
type TabType = 'discovery' | 'score' | 'profile';

<button onClick={() => setActiveTab('score')}>
  My Score
</button>

{activeTab === 'score' && <ConsumerScoreDashboard />}
```

**After (Without Score Tab):**
```typescript
type TabType = 'discovery' | 'profile';

// No score tab button

// No score dashboard rendering
```

---

### Barber Page Structure

**Current (Correct):**
```typescript
type TabType = 'dashboard' | 'requests' | 'pricing' | 'profile';

// No 'score' or 'quality' tab
// Barbers only see:
// - Dashboard: Schedule, earnings, upcoming appointments
// - Requests: Pending bookings with consumer stats
// - Pricing: Their service pricing settings
// - Profile: Bio, specialties, portfolio
```

---

### Data Flow

```
┌──────────────────────────────────────────┐
│         SCORE CALCULATION                │
│              (Backend)                   │
├──────────────────────────────────────────┤
│                                          │
│  Consumer Reliability → Database         │
│  Barber Quality (BQS) → Database         │
│                                          │
└────────────┬─────────────────────────────┘
             │
             ├──────────────────────────────┐
             │                              │
             ▼                              ▼
     ┌─────────────┐              ┌──────────────┐
     │  Algorithm  │              │ Visibility   │
     │   Ranking   │              │   Control    │
     └─────────────┘              └──────────────┘
             │                              │
             ▼                              ▼
     ┌─────────────┐              ┌──────────────┐
     │  Discovery  │              │  Show to     │
     │   Results   │              │  Others      │
     └─────────────┘              └──────────────┘
                                          │
                                          ▼
                              ┌──────────────────────┐
                              │  ✅ Consumers see:   │
                              │    Barber ratings    │
                              │                      │
                              │  ✅ Barbers see:     │
                              │    Consumer stats    │
                              │                      │
                              │  ✅ Admins see:      │
                              │    All scores        │
                              │                      │
                              │  ❌ Self-scores:     │
                              │    Hidden            │
                              └──────────────────────┘
```

---

## API Endpoints & Visibility

### Consumer-Facing Endpoints

**GET `/api/barbers/ranked`**
- Returns: Barber list with ratings, reviews, bookings
- Includes: Public stats (rating, experience, specialties)
- Excludes: BQS, pricing multipliers, ranking positions

**GET `/api/barbers/:id/profile`**
- Returns: Full barber profile with portfolio
- Includes: Ratings, reviews, stats, services
- Excludes: BQS, internal quality metrics

---

### Barber-Facing Endpoints

**GET `/api/booking-requests/barber/:id/pending`**
- Returns: Pending requests with customer profiles
- Includes: Reliability scores, completion rates, no-shows
- Excludes: Customer's self-view dashboard data

**GET `/api/appointments/:id/details`**
- Returns: Full appointment info with customer stats
- Includes: Booking history, ratings, reliability badge
- Excludes: Platform-internal scoring algorithms

---

### Admin-Facing Endpoints

**GET `/api/admin/barbers`**
- Returns: All barber data including BQS
- Includes: Quality scores, rankings, multipliers

**GET `/api/admin/consumers`**
- Returns: All consumer data including reliability
- Includes: Full stats, fraud flags, patterns

**GET `/api/admin/markets/:id/stats`**
- Returns: Market-level aggregates
- Includes: Avg BQS, demand scores, pricing data

---

## Security & Privacy

### Score Access Control

**Database Layer:**
```sql
-- Consumer can query own basic info
SELECT name, bio, profile_image 
FROM consumers 
WHERE id = :user_id;

-- Consumer CANNOT query own reliability score
-- (No endpoint exposes this)

-- Barbers can query consumer scores for booking requests only
SELECT c.reliability_score, c.completion_rate
FROM consumers c
JOIN booking_requests br ON br.consumer_id = c.id
WHERE br.barber_id = :barber_id AND br.status = 'pending';
```

**API Middleware:**
```typescript
// Check role-based access
if (endpoint === '/api/consumer/:id/score') {
  if (userRole === 'consumer' && userId === id) {
    return 403; // Forbidden: Can't see own score
  }
  if (userRole === 'barber' && hasActiveRequest(userId, id)) {
    return score; // Allowed: Barber viewing booking request
  }
  if (userRole === 'admin') {
    return score; // Allowed: Admin oversight
  }
  return 403;
}
```

---

## Future Considerations

### Potential Additions (If Needed)

**Indirect Feedback:**
```
Instead of showing exact scores, could show:
- "You've completed 45 bookings" (factual)
- "Great job maintaining high standards!" (qualitative)
- "Consider responding faster to booking requests" (actionable tip)
```

**Aggregate Insights:**
```
- "You're among the top 25% of consumers" (relative without exact rank)
- "Your service quality is above average" (comparative without number)
- "Consider expanding your availability" (suggestion without metric)
```

**Badges (Non-Score Based):**
```
- "Early Supporter" (joined in first month)
- "100 Cuts Milestone" (factual achievement)
- "Verified Account" (trust indicator)
- NOT: "Top 10 Barber" or "5-Star Customer"
```

---

## Comparison to Other Platforms

### Uber/Lyft

**What They Do:**
- Drivers see their own rating
- Riders see their own rating
- Everyone obsesses over 5.0 stars

**Why CampusCuts Is Different:**
- No self-rating visibility
- Focus on quality, not scores
- Less anxiety, more authentic service

---

### Airbnb

**What They Do:**
- Hosts see guest reviews and scores
- Guests see their own reviews
- Visible "Superhost" status

**Why CampusCuts Is Different:**
- No visible VIP status
- Everyone competes equally
- Merit-based without hierarchy badges

---

### TaskRabbit / Thumbtack

**What They Do:**
- Service providers see rankings
- Top performers get "Top Pro" badges
- Creates competitive pressure

**Why CampusCuts Is Different:**
- No visible professional tiers
- Algorithm handles matching
- Natural selection without stress

---

## Summary

### The CampusCuts Scoring Philosophy

```
┌──────────────────────────────────────────┐
│  TRANSPARENCY WHERE IT MATTERS           │
│  - Users see who they're booking with   │
│  - Informed decisions before scheduling  │
│                                          │
│  PRIVACY FOR SELF-ASSESSMENT             │
│  - Users don't obsess over own metrics  │
│  - Focus on quality, not optimization   │
│                                          │
│  TRUST-BUILDING MECHANISM                │
│  - Scores match compatible users         │
│  - Algorithm rewards good behavior       │
│  - Merit-based without status symbols    │
└──────────────────────────────────────────┘
```

### Key Takeaways

✅ **Consumers see barber quality** → Make informed bookings  
✅ **Barbers see consumer reliability** → Accept good customers  
✅ **Admins see all metrics** → Platform oversight  
❌ **Users don't see own scores** → Focus on quality, not metrics  
❌ **No VIP status** → Fair, merit-based competition  
❌ **No metric gaming** → Authentic interactions  

---

**For questions:** lmckeown@calpoly.edu  
**For implementation details:** See `/web-app/src/components/` and `/backend/src/services/`

---

**End of Scoring System Documentation**

