# Campus Manager Implementation

## Overview

Campus Manager is a **role-based overlay** on the existing Barber entity. It's not a separate user type, profile, or page—it's an operational enhancement that appears conditionally for barbers who hold the Campus Manager role.

## Core Design Principles

### 1. Single Entity
- Campus Manager is a **role**, not a new user type
- Uses the same `barbers` table
- No duplicated profiles, routes, or logic

### 2. Role-Based UI Overlay
- Campus Manager sections appear **only when** `barber.isCampusManager === true`
- Non-Campus Managers never see these sections
- 100% of existing Barber UI is preserved and reused

### 3. Zero Market Distortion
- **No ranking boosts**
- **No pricing advantages**
- **No visibility manipulation**
- All enhancements are operational and administrative only

### 4. Single Route Strategy
- Uses `/barber/:barberId` (existing route)
- Conditionally renders Campus Manager dashboard
- No separate `/campus-manager` route

---

## Database Schema

### Barber Table Additions

```sql
ALTER TABLE barbers
ADD COLUMN is_campus_manager BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN campus_manager_since TIMESTAMPTZ;

-- Partial unique index: Only one Campus Manager per campus
CREATE UNIQUE INDEX idx_unique_campus_manager ON barbers(campus_id)
WHERE is_campus_manager = true;
```

### Key Constraints

- **Uniqueness:** Only ONE barber per campus can have `is_campus_manager = true`
- **Validation:** Barber must be `is_active = true` and `is_onboarded = true`
- **Atomicity:** Promotion uses PostgreSQL function for safe concurrent operations

---

## Frontend Components

### 1. CampusManagerBadge
**File:** `web-app/src/components/CampusManagerBadge.tsx`

Non-intrusive badge displayed under barber name in header.

```tsx
<CampusManagerBadge 
  campusName="California Polytechnic State University"
  since={new Date('2024-01-15')}
/>
```

**Styling:**
- Small, neutral design
- Olive green (`primary`) theme
- Shield icon
- "Since" timestamp

---

### 2. CampusManagerDashboard
**File:** `web-app/src/components/CampusManagerDashboard.tsx`

Tabbed dashboard with four sections:

#### A. Barber Applications Panel
- List pending barber applications
- Actions: View, Interview, Approve, Reject
- All decisions logged

#### B. Campus Metrics Panel (Read-Only)
- Active barbers count
- Weekly bookings
- Average rating
- Disputes flagged

#### C. Content Management Panel
- Upload campus content
- Tag content to campus
- Submit for approval
- View posting history

#### D. Incidents Panel
- Flag barber issues
- Escalate to admin
- View past incidents
- Resolution tracking

---

### 3. BarberPage Integration
**File:** `web-app/src/pages/BarberPage.tsx`

**Conditional Rendering Logic:**

```typescript
// Mock data (replace with API call)
const isCampusManager = true;
const campusId = 'campus-1';
const campusName = 'California Polytechnic State University';
const campusManagerSince = new Date('2024-01-15');

// In header
{isCampusManager && (
  <CampusManagerBadge 
    campusName={campusName} 
    since={campusManagerSince}
  />
)}

// In profile dropdown
{isCampusManager && (
  <button onClick={() => setShowCampusManagerDashboard(true)}>
    <Shield /> Campus Manager
  </button>
)}

// Modal
{isCampusManager && showCampusManagerDashboard && (
  <CampusManagerDashboard 
    campusId={campusId} 
    campusName={campusName}
  />
)}
```

---

## Backend Services

### CampusManagerService
**File:** `backend/src/services/campus-manager.service.ts`

**Methods:**

```typescript
// Check Campus Manager status
isCampusManager(barberId: string): Promise<boolean>

// Get Campus Manager for a campus
getCampusManager(campusId: string): Promise<CampusManager | null>

// Promote barber to Campus Manager (Admin only)
promoteToCampusManager(barberId: string, campusId: string): Promise<Result>

// Revoke Campus Manager role (Admin only)
revokeCampusManager(barberId: string): Promise<boolean>

// Get Campus Manager permissions list
getCampusManagerPermissions(): string[]

// Verify permission for action
verifyPermission(barberId: string, campusId: string, action: string): Promise<boolean>
```

---

### API Routes
**File:** `backend/src/routes/campus-manager.routes.ts`

| Endpoint | Method | Description | Auth |
|----------|--------|-------------|------|
| `/api/campus-manager/check/:barberId` | GET | Check if barber is Campus Manager | Required |
| `/api/campus-manager/campus/:campusId` | GET | Get Campus Manager for campus | Required |
| `/api/campus-manager/promote` | POST | Promote barber (Admin only) | Admin |
| `/api/campus-manager/revoke` | POST | Revoke role (Admin only) | Admin |
| `/api/campus-manager/permissions` | GET | List permissions | Required |
| `/api/campus-manager/verify-permission` | POST | Verify permission | Required |

---

## Database Functions

### promote_to_campus_manager()
```sql
CREATE OR REPLACE FUNCTION promote_to_campus_manager(
  p_barber_id UUID,
  p_campus_id UUID
)
RETURNS BOOLEAN
```

**Features:**
- Validates barber belongs to campus
- Checks for existing Campus Manager
- Atomic promotion
- Returns success/failure

### revoke_campus_manager()
```sql
CREATE OR REPLACE FUNCTION revoke_campus_manager(
  p_barber_id UUID
)
RETURNS BOOLEAN
```

**Features:**
- Removes Campus Manager role
- Clears `campus_manager_since` timestamp
- Atomic operation

---

## Permissions System

### Campus Manager Permissions

```typescript
const permissions = [
  'manage_barber_applications',  // Approve/reject barber applications
  'view_campus_metrics',          // View campus performance metrics
  'upload_campus_content',        // Upload photos, videos, posts
  'flag_incidents',               // Flag barber issues
  'escalate_to_admin',            // Escalate issues to platform admin
];
```

### Scope Limitations

Campus Managers can **only** manage their own campus:

```typescript
// ✅ Allowed
await verifyPermission(barberId, campusId, 'manage_barber_applications');

// ❌ Denied (different campus)
await verifyPermission(barberId, otherCampusId, 'manage_barber_applications');
```

### Self-Management Restrictions

Campus Managers **cannot:**
- Approve their own barber applications
- Modify their own BQS score
- Change their own pricing multiplier
- Escalate issues against themselves

---

## Migration Guide

### 1. Run Database Migration

```bash
cd backend
psql campuscuts < prisma/migrations/003_campus_manager_role.sql
```

### 2. Promote First Campus Manager (SQL)

```sql
-- Promote a barber to Campus Manager
SELECT promote_to_campus_manager(
  'barber-id-here',
  'campus-id-here'
);
```

### 3. Verify Installation

```bash
# Check database
psql campuscuts -c "SELECT id, display_name, is_campus_manager FROM barbers b JOIN users u ON b.user_id = u.id WHERE is_campus_manager = true;"

# Test API
curl http://localhost:3001/api/campus-manager/check/barber-1
```

---

## Testing

### Manual Testing Checklist

**Frontend:**
- [ ] Badge appears when `isCampusManager = true`
- [ ] Badge does NOT appear when `isCampusManager = false`
- [ ] "Campus Manager" option in profile dropdown (conditional)
- [ ] Campus Manager modal opens correctly
- [ ] All four tabs render (Applications, Metrics, Content, Incidents)
- [ ] Modal closes when clicking outside
- [ ] Modal closes when clicking X button

**Backend:**
- [ ] Can promote barber to Campus Manager
- [ ] Cannot promote second Campus Manager for same campus
- [ ] Can revoke Campus Manager role
- [ ] Permissions verified correctly
- [ ] Campus-scoped permission checks work

**Edge Cases:**
- [ ] Role revocation → UI disappears immediately
- [ ] Inactive barber cannot be promoted
- [ ] Non-onboarded barber cannot be promoted
- [ ] Campus with no Campus Manager → No errors

---

## Production Rollout Strategy

### Phase 1: Database Migration
```bash
# Run migration on production database
psql $DATABASE_URL < prisma/migrations/003_campus_manager_role.sql
```

### Phase 2: Deploy Backend
```bash
# Deploy backend with Campus Manager service + routes
git push heroku main
```

### Phase 3: Deploy Frontend
```bash
# Deploy frontend with conditional Campus Manager UI
cd web-app && npm run build
# Deploy to Vercel/Netlify
```

### Phase 4: Promote First Campus Managers
```sql
-- Promote one trusted barber per campus
SELECT promote_to_campus_manager('[barber-id]', '[campus-id]');
```

### Phase 5: Monitor
- Watch for permission errors
- Check Campus Manager dashboard usage
- Monitor barber application approvals

---

## Future Enhancements

### Short-Term (Next Sprint)
- [ ] Campus Manager application flow
- [ ] Barber application forms
- [ ] Content upload UI
- [ ] Incident reporting forms

### Medium-Term (Next Quarter)
- [ ] Campus Manager performance metrics
- [ ] AI-assisted application review
- [ ] Automated fraud detection
- [ ] Campus Manager leaderboard (operational metrics)

### Long-Term (6+ Months)
- [ ] Campus Manager training certification
- [ ] Multi-campus Campus Manager (for network growth)
- [ ] Campus Manager revenue share (performance-based)
- [ ] Campus Manager community forum

---

## FAQs

**Q: Can a Campus Manager be a regular barber too?**
A: Yes! Campus Manager is a role overlay. They continue to take bookings, earn money, and compete in rankings like any other barber.

**Q: Do Campus Managers get paid extra?**
A: Not initially. This is a volunteer leadership role. Future versions may include performance-based incentives.

**Q: Can admins override Campus Manager decisions?**
A: Yes. Platform admins retain full control. Campus Managers handle first-line operations.

**Q: What if a Campus Manager leaves?**
A: Admins can revoke the role and promote a new Campus Manager. There's no gap in operations.

**Q: Can Campus Managers see other barbers' earnings?**
A: No. They only see aggregate metrics (total bookings, average rating). Individual earnings are private.

**Q: What prevents Campus Manager abuse?**
A: All actions are logged, auditable, and reviewable by admins. Repeated issues result in role revocation.

---

## Support

For questions or issues:
- **Backend Team:** `backend@campuscuts.com`
- **Database Team:** `dba@campuscuts.com`
- **Product Team:** `product@campuscuts.com`

---

**Built with care for the CampusCuts community** 🚀

