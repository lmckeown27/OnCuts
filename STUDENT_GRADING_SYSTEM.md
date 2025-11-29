# Student/Consumer Grading System

## 📊 **Overview**

CampusCuts now has a **two-sided grading system** where students/consumers are scored **just as rigorously (if not more strictly)** than barbers. This ensures marketplace quality and protects barbers from problem customers.

---

## 🎯 **Why Grade Students?**

### **The Problem:**
- **No-shows** waste barber time and potential earnings
- **Harsh reviewers** unfairly damage barber reputations
- **Serial cancelers** make scheduling unreliable
- **Problem customers** drive good barbers away

### **The Solution:**
- Grade students on behavior, fairness, and reliability
- Auto-restrict students with poor scores
- Let barbers see student scores before accepting bookings
- Reward good customers with benefits and perks

---

## 🔢 **Student Score Calculation**

Students receive a **Customer Score (0-100)** based on three components:

### **1. Review Fairness Score (40% weight)** 
*Ensures students are fair and honest reviewers*

#### **What's Measured:**
- **Average rating given to barbers** (1-5 stars)
- **Review rate** (do they leave reviews?)

#### **Optimal Behavior:**
- Give ratings between **3.8 - 4.6 stars** on average = **100 score**
- Leave reviews for at least 60% of bookings

#### **HARSH PENALTIES:**
- **< 3.5 avg rating** ("harsh reviewer") = **0-50 score**
  - Example: Student who only gives 1-2 stars = **very low score**
- **> 4.8 avg rating** ("too easy") = **85 score** (minor penalty)
  - Ratings everyone 5-stars isn't helpful

#### **Why It Matters:**
- Fair reviews help barbers improve
- Unfair reviews damage reputations
- Students who are "never satisfied" are flagged

#### **Formula:**
```typescript
ratingFairnessScore = 
  if (avgRating between 3.8-4.6): 100
  else if (avgRating < 3.5): max(0, 50 - (distance × 30))
  else if (avgRating > 4.8): 85
  else: 100 - (distanceFromOptimal × 20)

reviewRateScore = reviewRate × 100

fairnessScore = (ratingFairnessScore × 0.60) + (reviewRateScore × 0.40)
```

---

### **2. Attendance Score (40% weight)**
*VERY HARSH on no-shows and cancellations*

#### **What's Measured:**
- **No-show rate** (didn't show up)
- **Cancellation rate** (total cancellations)
- **Same-day cancellation rate** (especially bad)

#### **Optimal Behavior:**
- **0% no-shows** = **100 score**
- **0% cancellations** = **100 score**
- **Show up on time** every time

#### **HARSH PENALTIES:**
- **>15% no-shows** = **0-20 score** (CRITICAL problem)
  - Example: 2 no-shows out of 10 bookings = **very low score**
- **>25% cancellations** = **0-40 score** (problem)
- **>10% same-day cancellations** = **additional -50% penalty**

#### **Why It Matters:**
- No-shows waste barber's time slot (lost income)
- Cancellations make scheduling unreliable
- Same-day cancels are especially harmful (too late to fill slot)

#### **Formula:**
```typescript
showUpScore =
  if (noShowRate === 0): 100
  else if (noShowRate > 0.15): max(0, 20 - (excess × 100))
  else: (1 - noShowRate) × 100

noCancelScore =
  if (cancelRate === 0): 100
  else if (cancelRate > 0.25): max(0, 40 - (excess × 100))
  else: (1 - cancelRate) × 100
  
  // Extra penalty for same-day cancels
  if (sameDayCancelRate > 0.10):
    noCancelScore -= (sameDayCancelRate × 50)

attendanceScore = (showUpScore × 0.70) + (noCancelScore × 0.30)
```

---

### **3. Engagement Score (20% weight)**
*Rewards active, loyal customers*

#### **What's Measured:**
- **Loyalty rate** (rebooking same barbers)
- **Variety** (trying different barbers)
- **Booking frequency** (how often they book)
- **Tip percentage** (generosity)

#### **Optimal Behavior:**
- Rebook favorite barbers regularly
- Try new barbers occasionally
- Book at least monthly
- Tip generously (15-20%)

#### **Score Bonuses:**
- Loyal to favorite barbers = +30%
- Active booker (every 2 weeks) = +30%
- Generous tipper (20%+) = +20%
- Trying variety = +20%

#### **Why It Matters:**
- Active customers keep the marketplace healthy
- Loyal customers help barbers build their business
- Generous tippers are preferred customers

#### **Formula:**
```typescript
loyaltyScore = loyaltyRate × 100
varietyScore = min(100, (uniqueBarbers / 3) × 100)
frequencyScore = 
  if (avgDaysBetween <= 14): 100
  else if (avgDaysBetween <= 30): 80
  else if (avgDaysBetween <= 60): 60
  else: 40
tipScore = min(100, avgTipPct × 5)

engagementScore = 
  (loyalty × 0.30) + (variety × 0.20) + 
  (frequency × 0.30) + (tips × 0.20)
```

---

### **Overall Customer Score**

```typescript
CustomerScore = 
  (ReviewFairness × 0.40) + 
  (Attendance × 0.40) + 
  (Engagement × 0.20)
```

**Range:** 0-100

---

## 🏆 **Student Grade Levels**

Students are assigned a **grade level** based on their score:

### **VIP Customer (95-100)** 🌟 Platinum Badge
**Benefits:**
- ✅ Instant book with ALL barbers
- ✅ Priority scheduling
- ✅ **10% loyalty discount**
- ✅ Skip waitlists
- ✅ Premium support

**Requirements:**
- Near-perfect attendance
- Fair, helpful reviews
- Active booking history

---

### **Excellent Customer (85-94.99)** 🥇 Gold Badge
**Benefits:**
- ✅ Instant book with most barbers
- ✅ **5% loyalty discount**
- ✅ Priority support

**Requirements:**
- Great attendance (<5% no-shows)
- Fair reviews (3.8-4.5 avg)
- Regular bookings

---

### **Good Customer (70-84.99)** 🥈 Silver Badge
**Benefits:**
- ✅ Standard instant book access
- ✅ Normal support

**Requirements:**
- Good attendance (<10% no-shows)
- Reasonable reviews
- Occasional bookings

---

### **Average Customer (50-69.99)** 🥉 Bronze Badge
**Benefits:**
- ⚠️ Limited instant book
- ⚠️ Standard support

**Restrictions:**
- Some barbers may require request-book
- Lower priority in waitlists

---

### **Below Average (30-49.99)** ⚪ Gray Badge
**Restrictions:**
- ⛔ Request-book only
- ⛔ Extended response times
- ⛔ Many barbers may decline
- ⛔ Lower priority

**Why:**
- Frequent no-shows or cancellations
- Harsh reviewer pattern
- Minimal engagement

---

### **Poor Customer (0-29.99)** 🔴 Red Badge
**SEVERE RESTRICTIONS:**
- ⛔ Request-book only (no instant)
- ⛔ **Higher deposits required**
- ⛔ **Account review required**
- ⛔ Most barbers will decline
- ⛔ Possible account suspension

**Why:**
- Excessive no-shows (>20%)
- Extremely harsh reviewer (<3.0 avg)
- Multiple barber complaints
- Pattern of problematic behavior

---

## 🚨 **Auto-Restrictions**

Students with scores below certain thresholds face **automatic restrictions**:

### **Score < 30 (Auto-Flag)**
- Account is **flagged for review**
- Admin notification
- Warning sent to student

### **Score < 20 (Auto-Restrict)**
- **Instant book disabled** immediately
- Request-book only
- **Higher deposits required**
- System restricts booking privileges

### **Types of Restrictions:**
1. **instant_book_disabled** - Can only request bookings
2. **requires_deposit** - Must pay upfront deposit
3. **barber_approval_required** - Barbers must manually approve
4. **booking_cooldown** - Limited bookings per week
5. **account_suspended** - Extreme cases (manual review)

---

## 🛡️ **Barber Protections**

### **Barbers Can:**
1. **View student scores** before accepting bookings
2. **Block problematic students** (permanent or temporary)
3. **Receive system warnings** about low-score students
4. **Decline bookings** from students with restrictions
5. **Report bad behavior** to affect student scores

### **System Recommendations:**
- Barbers see student's:
  - Customer score (0-100)
  - Grade level
  - No-show rate
  - Average rating given
  - Active restrictions
  - Booking history

### **Auto-Blocking:**
- System suggests blocking students who:
  - Have multiple no-shows with this barber
  - Have extremely low scores (<25)
  - Have filed excessive complaints
  - Have been flagged for abuse

---

## 📉 **Example: Problem Student**

### **Sarah's Behavior:**
- 15 total bookings
- **4 no-shows** (27% no-show rate) ⛔
- **3 cancellations** (20% cancel rate)
- Average rating given: **2.8 stars** (harsh reviewer) ⛔
- Only left 3 reviews (20% review rate)
- No repeat bookings
- 0% tips

### **Sarah's Score Calculation:**

**Review Fairness (40%):**
- Avg rating 2.8 < 3.5 threshold
- Distance from 3.5 = 0.7
- Score = 50 - (0.7 × 30) = **29/100** ⛔

**Attendance (40%):**
- No-show rate 27% > 15% threshold
- Excess = 0.12
- Score = 20 - (0.12 × 100) = **8/100** ⛔⛔⛔

**Engagement (20%):**
- No loyalty, no tips, infrequent
- Score = **35/100**

**Customer Score:**
```
(29 × 0.40) + (8 × 0.40) + (35 × 0.20)
= 11.6 + 3.2 + 7.0
= 21.8/100 ⛔⛔⛔
```

### **Sarah's Grade:** Poor Customer (Red Badge)

### **Sarah's Restrictions:**
- ⛔ Instant book **DISABLED**
- ⛔ Request-book only
- ⛔ **Higher deposit required** ($20 upfront)
- ⛔ Most barbers will **decline** her requests
- ⛔ Auto-restricted by system
- ⚠️ Flagged for account review
- ⚠️ Warning email sent

### **What Barbers See:**
```
⚠️ WARNING: Low-Score Customer

Sarah J. - Customer Score: 22/100 (Poor Customer)
- 27% no-show rate (4 out of 15 bookings)
- Harsh reviewer (2.8 avg rating given)
- 0 repeat bookings
- RESTRICTED ACCOUNT

Recommendation: DECLINE booking request
```

---

## ✅ **Example: Excellent Student**

### **Marcus's Behavior:**
- 45 total bookings
- **0 no-shows** ✅
- **1 cancellation** (2 days advance notice)
- Average rating given: **4.2 stars** (fair) ✅
- Left 38 reviews (84% review rate) ✅
- 18 repeat bookings with favorite barbers
- Average 15% tips ✅

### **Marcus's Score:**

**Review Fairness:** **95/100** ✅
**Attendance:** **98/100** ✅
**Engagement:** **90/100** ✅

**Customer Score:** **94.6/100** ✅

### **Marcus's Grade:** Excellent Customer (Gold Badge)

### **Marcus's Benefits:**
- ✅ Instant book with ALL barbers
- ✅ **5% loyalty discount**
- ✅ Priority support
- ✅ Skip waitlists
- ✅ Preferred customer status

---

## 📊 **Comparison: Barber vs Student Grading**

| Aspect | Barber Grading | Student Grading |
|--------|----------------|-----------------|
| **Quality/Fairness** | 70% weight | 40% weight |
| **Reliability/Attendance** | 20% weight | **40% weight** ⚠️ |
| **Demand/Engagement** | 10% weight | 20% weight |
| **No-Show Penalty** | Moderate | **VERY HARSH** ⚠️ |
| **Auto-Restrictions** | Score < 50 | **Score < 20** ⚠️ |
| **Cancellation Penalty** | Minimal | **Harsh** ⚠️ |
| **New User Grace** | 5 bookings | 3 bookings |

### **Why Students Are Graded Harsher:**

1. **No-shows are MORE damaging**
   - Barbers lose income + time
   - Can't fill slot last minute
   - More severe impact

2. **Unfair reviews are MORE harmful**
   - Can destroy a barber's reputation
   - Harder for barbers to recover
   - More visible impact

3. **Bad customers hurt MORE**
   - Drive away good barbers
   - Damage marketplace quality
   - Easier to replace customers than barbers

4. **Higher accountability needed**
   - Barbers are running businesses
   - Students are consumers
   - Consumers must respect provider time

---

## 🔄 **How Scores Update**

- **Daily recompute** at 2 AM (same as barber pricing)
- Scores update based on recent behavior
- 30-day rolling window for metrics
- Lifetime stats also tracked
- Restrictions auto-apply/remove based on score changes

---

## 🎮 **Gamification Elements**

### **Badges:**
- Platinum, Gold, Silver, Bronze, Gray, Red
- Displayed on student profile
- Visible to barbers

### **Progress Tracking:**
- Students see their score trend
- Clear path to improvement
- Actionable tips (like barbers get)

### **Rewards for Improvement:**
- Score increases = restrictions lifted
- Reach VIP = discounts unlock
- Maintain excellence = priority access

---

## 🛠️ **Admin Controls**

### **Admins Can:**
- View all student scores
- Manually adjust restrictions
- Review flagged accounts
- Override auto-blocks
- See complaint history
- Ban abusive students

### **Admin Dashboard Shows:**
- Distribution of student scores
- Flagged students requiring review
- Recent restrictions applied
- Student complaint log
- Barber blocking patterns

---

## 🚀 **Implementation Status**

### ✅ **COMPLETE:**
- Database schema (7 tables)
- Scoring engine service
- Harsh penalty algorithms
- Auto-restriction system
- Grade level definitions

### ⏳ **TODO:**
- Metrics aggregation service
- API endpoints
- Frontend student dashboard
- Barber view of student scores
- Admin student management UI

---

## 💡 **Key Takeaways**

1. **Students are graded HARSHER than barbers** (40% weight on attendance vs 20%)
2. **No-shows are SEVERELY penalized** (>15% = near-zero score)
3. **Harsh reviewers are HEAVILY penalized** (<3.5 avg = very low score)
4. **Auto-restrictions kick in FASTER** (score < 20 vs score < 50)
5. **Barbers are PROTECTED** (can view scores, block students)
6. **Good students get REWARDS** (VIP customers get 10% off)
7. **Two-sided accountability** ensures marketplace quality

---

## 🎯 **Bottom Line**

**CampusCuts now protects barbers from problem customers while rewarding excellent students.**

Students who:
- Show up on time ✅
- Leave fair reviews ✅
- Book regularly ✅
- Tip generously ✅

Get **VIP treatment, discounts, and priority access.**

Students who:
- No-show frequently ⛔
- Trash barbers unfairly ⛔
- Cancel last minute ⛔

Get **restricted, flagged, and eventually blocked.**

**Result:** A healthy, balanced marketplace where both sides are accountable! 🎉

---

## 📱 **Student Dashboard: "My Score" Tab**

### **Full Transparency**

Students can view their own customer score in real-time via the **"My Score"** tab in the Consumer Dashboard.

### **What Students See:**

1. **Overall Customer Score (0-100)** with grade badge (🌟 VIP, 🥇 Excellent, etc.)
2. **Score Breakdown:**
   - Review Fairness Score (40%)
   - Attendance Score (40%)
   - Engagement Score (20%)
3. **Detailed Metrics:**
   - Total bookings, no-shows, cancellations
   - Average rating given, reviews left
   - Total spent, avg tip percentage
4. **Benefits & Restrictions:**
   - Current perks (discounts, instant book access)
   - Active restrictions (if any)
5. **Review Impact Weight:**
   - How much their reviews count (1.2x for VIP, 0.0x for Poor)
6. **Path to Next Level:**
   - What they need to do to improve their score
   - Tips for reaching VIP status
7. **Grade Level Explanation:**
   - All 6 customer grades with benefits/restrictions

### **Why This Matters:**

- **No Surprises:** Students know exactly where they stand
- **Motivation:** Clear path to VIP benefits
- **Fairness:** Understanding why restrictions exist
- **Improvement:** Actionable tips to raise their score
- **Accountability:** Real-time feedback on behavior

### **Example Scenarios:**

**🌟 VIP Customer (Score: 97)**
- Sees: "Your reviews count 20% MORE" + "10% discount on all bookings"
- Goal: Maintain VIP status, keep no-show rate at 0%

**🥈 Good Customer (Score: 78)**
- Sees: "Improve to 85+ for 5% discount" + tips to increase engagement
- Goal: Book more frequently, leave more reviews

**⚪ Below Average (Score: 42)**
- Sees: "⚠️ Request-book only" + "Your reviews count 50% less"
- Goal: Show up to ALL appointments, stop harsh reviews

**🔴 Poor Customer (Score: 18)**
- Sees: "⛔ SEVERE RESTRICTIONS" + "Your reviews are IGNORED"
- Action: Major behavior change required or account suspension

---

