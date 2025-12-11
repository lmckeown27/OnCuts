# PostgreSQL Setup for CampusCuts

## Quick Setup (macOS with Homebrew)

### Step 1: Verify PostgreSQL is Running

```bash
# Check if PostgreSQL is running
lsof -i :5432

# If not running, start it
brew services start postgresql@14
```

### Step 2: Create CampusCuts Database

```bash
# Create the database
createdb campuscuts

# Verify it was created
psql -l | grep campuscuts
```

### Step 3: Initialize Schema & Insert Mock Data

```bash
cd /Users/liammckeown/Desktop/CampusCuts

# Run initialization script
psql campuscuts -f backend/database/init.sql

# Insert mock data
psql campuscuts -f backend/database/seed-mock-data.sql
```

### Step 4: Update Backend .env File

```bash
cd backend

# Check your username
whoami

# Update .env file with your username
# Replace YOUR_USERNAME with output from whoami
```

Edit `backend/.env`:
```env
DATABASE_URL=postgresql://YOUR_USERNAME@localhost:5432/campuscuts
```

For example, if `whoami` returns `liammckeown`:
```env
DATABASE_URL=postgresql://liammckeown@localhost:5432/campuscuts
```

### Step 5: Restart Backend

```bash
cd /Users/liammckeown/Desktop/CampusCuts/backend

# Stop current backend (Ctrl+C)
# Then restart:
npm run dev
```

You should see:
```
✅ Server started on port 3001
✅ PostgreSQL connected successfully
✅ Redis connected
```

---

## How Campus Data Filtering Works

### Database Structure

Mock data is organized by **student address prefix**:

```
Cal Poly (campus-1)  → Student addresses start with 0x1
UCSB (campus-2)      → Student addresses start with 0x2
UCLA (campus-3)      → Student addresses start with 0x3
```

### Example Data

```sql
-- Cal Poly Students
INSERT INTO users (aptos_address, ...) VALUES
('0x1001', 'john.smith@calpoly.edu', 'John Smith', 1, ...),
('0x1002', 'sarah.johnson@calpoly.edu', 'Sarah Johnson', 1, ...);

-- UCSB Students
INSERT INTO users (aptos_address, ...) VALUES
('0x2001', 'chris.anderson@ucsb.edu', 'Chris Anderson', 1, ...),
('0x2002', 'michelle.thomas@ucsb.edu', 'Michelle Thomas', 1, ...);

-- UCLA Students
INSERT INTO users (aptos_address, ...) VALUES
('0x3001', 'tyler.clark@ucla.edu', 'Tyler Clark', 1, ...),
('0x3002', 'rachel.rodriguez@ucla.edu', 'Rachel Rodriguez', 1, ...);
```

### Admin API Filtering

When admin selects a campus:

```
Frontend:
Admin clicks "UCLA"
  ↓
Sends: GET /api/admin/transactions?campus=campus-3&limit=20
  ↓
Backend (admin-transactions.controller.ts):
  ↓
Maps campus ID to student address prefix:
  campus-1 → 0x1%
  campus-2 → 0x2%
  campus-3 → 0x3%
  ↓
SQL Query:
  SELECT * FROM bookings
  WHERE student_address LIKE '0x3%'  ← Filters for UCLA only!
  ORDER BY completed_at DESC
  LIMIT 20
  ↓
Returns: Only UCLA bookings (19 transactions)
```

### Backend Code (How It Works)

```typescript
// From: backend/src/controllers/admin-transactions.controller.ts

const campusPrefix = campus === 'campus-1' ? '0x1%' :
                    campus === 'campus-2' ? '0x2%' :
                    campus === 'campus-3' ? '0x3%' : null;

let query = `
  SELECT 
    b.blockchain_id as id,
    b.student_address as "from",
    b.barber_address as "to",
    b.amount,
    b.status,
    b.created_at,
    b.completed_at,
    us.full_name as student_name,
    ub.full_name as barber_name
  FROM bookings b
  LEFT JOIN users us ON b.student_address = us.aptos_address
  LEFT JOIN users ub ON b.barber_address = ub.aptos_address
`;

// Add campus filter
if (campusPrefix) {
  query += ` WHERE b.student_address LIKE $1`;  // Filters by campus!
  params.push(campusPrefix);
}

query += ` ORDER BY COALESCE(b.completed_at, b.created_at) DESC LIMIT $2`;
params.push(limitNum);

const result = await pool.query(query, params);
```

---

## Verify Everything Works

### Test 1: Check Database Connection

```bash
psql campuscuts -c "SELECT COUNT(*) FROM users;"
```

Expected output:
```
 count 
-------
    50
```

### Test 2: Check Mock Data by Campus

```bash
psql campuscuts -c "
SELECT 
  CASE 
    WHEN aptos_address LIKE '0x1%' THEN 'Cal Poly'
    WHEN aptos_address LIKE '0x2%' THEN 'UCSB'
    WHEN aptos_address LIKE '0x3%' THEN 'UCLA'
  END as campus,
  COUNT(*) as students
FROM users
WHERE role = 1
GROUP BY campus;
"
```

Expected output:
```
  campus  | students 
----------+----------
 Cal Poly |       10
 UCSB     |       10
 UCLA     |       10
```

### Test 3: Check Bookings by Campus

```bash
psql campuscuts -c "
SELECT 
  CASE 
    WHEN student_address LIKE '0x1%' THEN 'Cal Poly'
    WHEN student_address LIKE '0x2%' THEN 'UCSB'
    WHEN student_address LIKE '0x3%' THEN 'UCLA'
  END as campus,
  COUNT(*) as bookings,
  SUM(amount) / 100.0 as total_usd
FROM bookings
GROUP BY campus
ORDER BY total_usd DESC;
"
```

Expected output:
```
  campus  | bookings |   total_usd   
----------+----------+---------------
 UCLA     |       19 | 754.00
 Cal Poly |       14 | 456.00
 UCSB     |       10 | 347.00
```

### Test 4: Test API Directly

```bash
# Test UCLA transactions
curl http://localhost:3001/api/admin/transactions?campus=campus-3&limit=5

# Should return JSON with 5 UCLA transactions
```

---

## Troubleshooting

### Issue: "role postgres does not exist"

**Cause:** Backend is still using old DATABASE_URL

**Fix:**
```bash
# 1. Update .env
cd /Users/liammckeown/Desktop/CampusCuts/backend
nano .env  # or open in editor

# 2. Change this line:
DATABASE_URL=postgresql://postgres:password@localhost:5432/campuscuts

# 3. To this (replace with your username):
DATABASE_URL=postgresql://YOUR_USERNAME@localhost:5432/campuscuts

# 4. Save and restart backend
npm run dev
```

### Issue: "database campuscuts does not exist"

**Fix:**
```bash
createdb campuscuts
psql campuscuts -f backend/database/init.sql
psql campuscuts -f backend/database/seed-mock-data.sql
```

### Issue: Empty transaction feed

**Causes:**
1. Mock data not inserted
2. Backend not restarted
3. Wrong campus selected

**Fix:**
```bash
# Re-insert mock data
psql campuscuts -f backend/database/seed-mock-data.sql

# Restart backend
cd backend && npm run dev

# Select UCLA in admin dashboard (has most transactions)
```

---

## Adding More Campuses

To add a new campus (e.g., Stanford):

### 1. Choose Address Prefix

```
campus-4 (Stanford) → 0x4xxx
```

### 2. Add Mock Data

```sql
-- Stanford Students
INSERT INTO users (aptos_address, email, full_name, role, balance, created_at) VALUES
('0x4001', 'student1@stanford.edu', 'Stanford Student 1', 1, 50000, NOW()),
('0x4002', 'student2@stanford.edu', 'Stanford Student 2', 1, 60000, NOW());

-- Stanford Barbers
INSERT INTO users (aptos_address, email, full_name, role, balance, created_at) VALUES
('0xB041', 'barber1@stanford.edu', 'Stanford Barber 1', 2, 80000, NOW());

-- Stanford Bookings
INSERT INTO bookings (blockchain_id, student_address, barber_address, amount, ...) VALUES
(100, '0x4001', '0xB041', 3000, ...);
```

### 3. Update Backend Filtering

```typescript
// In admin-transactions.controller.ts
const campusPrefix = campus === 'campus-1' ? '0x1%' :
                    campus === 'campus-2' ? '0x2%' :
                    campus === 'campus-3' ? '0x3%' :
                    campus === 'campus-4' ? '0x4%' : null;  // Add this!
```

### 4. Update Frontend

```typescript
// In AdminPage.tsx, add to campuses array
{
  id: 'campus-4',
  name: 'Stanford University',
  city: 'Stanford',
  state: 'CA',
  domain: 'stanford.edu',
  student_count: 16000,
  active_barbers: 8,
  total_bookings: 200,
}
```

---

## Data Isolation Summary

**How each school's data is isolated:**

```
┌─────────────────────────────────────────────────────┐
│ Admin selects "UCLA"                                │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │ Frontend sends:       │
         │ ?campus=campus-3      │
         └───────────┬───────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │ Backend maps:         │
         │ campus-3 → 0x3%       │
         └───────────┬───────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │ PostgreSQL filters:   │
         │ WHERE student_address │
         │ LIKE '0x3%'           │
         └───────────┬───────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │ Returns ONLY UCLA:    │
         │ - 19 bookings         │
         │ - 10 students         │
         │ - 6 barbers           │
         └───────────────────────┘
```

**Key Points:**
- Each campus has a unique address prefix (0x1, 0x2, 0x3)
- SQL LIKE clause filters by prefix
- Frontend never sees other campuses' data
- No cross-campus data leakage
- Scalable to any number of campuses

---

## Quick Reference

**Create database:**
```bash
createdb campuscuts
```

**Load schema:**
```bash
psql campuscuts -f backend/database/init.sql
```

**Load mock data:**
```bash
psql campuscuts -f backend/database/seed-mock-data.sql
```

**Update DATABASE_URL:**
```env
DATABASE_URL=postgresql://YOUR_USERNAME@localhost:5432/campuscuts
```

**Restart backend:**
```bash
cd backend && npm run dev
```

**Test connection:**
```bash
psql campuscuts -c "SELECT COUNT(*) FROM bookings;"
```

---

## Success Checklist

- [ ] PostgreSQL is running (`lsof -i :5432`)
- [ ] Database `campuscuts` exists (`psql -l | grep campuscuts`)
- [ ] Schema is initialized (`psql campuscuts -c "\dt"` shows tables)
- [ ] Mock data is inserted (`psql campuscuts -c "SELECT COUNT(*) FROM bookings;"` = 64)
- [ ] DATABASE_URL uses your username in `.env`
- [ ] Backend restarts successfully
- [ ] Admin dashboard shows transactions for each campus
- [ ] UCLA shows 19 transactions
- [ ] Cal Poly shows 14 transactions
- [ ] UCSB shows 10 transactions

Once all checkboxes are complete, your admin dashboard should display campus-specific transactions! 🎉

