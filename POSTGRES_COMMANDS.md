# CampusCuts PostgreSQL Commands Reference

Quick reference for accessing and managing all database tables.

---

## Connect to Database

```bash
sudo -u postgres psql -d campuscuts
```

---

## Role Hierarchy

CampusCuts uses a role-based permission system with the following hierarchy:

| Role | Description | Privileges | University Affiliation |
|------|-------------|------------|------------------------|
| **ADMIN** | Platform administrator | Highest privileges. Campus manager at ALL campuses. Manages platform via PostgreSQL commands. No admin UI pages (security measure). | **All Universities** (platform-wide) |
| **CAMPUS_MANAGER** | Campus-specific manager | Manages barber applications, campus metrics, incidents for their specific campus. Typically 2 per campus (1 dedicated + admin). | **One University** (their campus) |
| **BARBER** | Service provider | Can offer haircut services, manage bookings, set availability and pricing. | **One University** (their campus) |
| **CONSUMER** | Customer | Can browse barbers, book services, make payments. Also referred to as "student" in frontend. | **None** (not tied to any university) |

### University Affiliation Rules
- **CONSUMER**: Never tied to a specific university, even if they were once a barber (demoted barbers lose campus affiliation)
- **BARBER**: Tied to one specific university where they provide services
- **CAMPUS_MANAGER**: Tied to one specific university that they manage
- **ADMIN**: Has privileges at ALL universities (platform-wide access)

### Admin Privileges
- Admin users have **campus manager privileges at ALL campuses**
- Each campus typically has 2 campus managers: one dedicated campus manager + the admin
- Admin functions are managed via PostgreSQL commands (no UI pages for security)
- When admin logs in, they are redirected to the barber page with full platform access

### Current Admin
- **Email**: `liam.mckeown38415@gmail.com`
- **Role**: `ADMIN`

---

## USERS

## Number of Users
'''bash
sudo -u postgres psql -d campuscuts -c "SELECT COUNT(*) AS total_users FROM users;"
'''

### Number of Users (By Role)
'''bash
sudo -u postgres psql -d campuscuts -c "SELECT role, COUNT(*) FROM users GROUP BY role ORDER BY COUNT(*) DESC;"
'''

### View All Users (Table Format)
```bash
sudo -u postgres psql -d campuscuts -c "SELECT email, first_name, last_name, role, email_verified FROM users;"
```

### View All Users (Expanded/Vertical Format)
```bash
sudo -u postgres psql -d campuscuts -x -c "SELECT id, email, first_name, last_name, role, email_verified, \"createdAt\" FROM users;"
```

### View All Users (Formatted Table)
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT 
    SUBSTRING(email, 1, 30) AS email,
    first_name,
    last_name,
    role,
    CASE WHEN email_verified THEN 'Yes' ELSE 'No' END AS verified
FROM users 
ORDER BY \"createdAt\" DESC;
"
```

### View Specific User by Email
```bash
# Replace EMAIL with actual email address
# Use -x for vertical format (easier to read)
sudo -u postgres psql -d campuscuts -x -c "SELECT * FROM users WHERE email = 'EMAIL';"

# Example:
sudo -u postgres psql -d campuscuts -x -c "SELECT * FROM users WHERE email = 'liam.mckeown38415@gmail.com';"
```

### View User with All Details
```bash
sudo -u postgres psql -d campuscuts -c "SELECT id, email, first_name, last_name, \"displayName\", role, email_verified, \"isVerified\", \"avatarUrl\", \"instagramHandle\", phone_e164, \"createdAt\" FROM users WHERE email = 'user@example.com';"
```

### View user phone numbers (SMS / sign-up)

Phone numbers are stored in **`users.phone_e164`** (E.164, e.g. `+14089219541`) when the user registered with phone verification or supplied a number at sign-up. **Nullable** if they signed up with email only.

```bash
# All users who have a phone on file (admin review)
sudo -u postgres psql -d campuscuts -c "
SELECT id, email, first_name, last_name, role, phone_e164, email_verified, \"createdAt\"
FROM users
WHERE phone_e164 IS NOT NULL
ORDER BY \"createdAt\" DESC;
"

# Compact list: email + phone + role
sudo -u postgres psql -d campuscuts -c "
SELECT email, phone_e164, role
FROM users
WHERE phone_e164 IS NOT NULL
ORDER BY email;
"

# Look up a user by phone (replace with full E.164 including +)
sudo -u postgres psql -d campuscuts -x -c "SELECT id, email, first_name, last_name, role, phone_e164, email_verified FROM users WHERE phone_e164 = '+14085551234';"

# Count users with vs without phone
sudo -u postgres psql -d campuscuts -c "
SELECT
  COUNT(*) FILTER (WHERE phone_e164 IS NOT NULL) AS with_phone,
  COUNT(*) FILTER (WHERE phone_e164 IS NULL) AS without_phone,
  COUNT(*) AS total
FROM users;
"
```

**Pending email verification** may still carry a phone in **`pending_registrations.phone_e164`** before the account is finalized:

```bash
sudo -u postgres psql -d campuscuts -c "
SELECT email, phone_e164, role, created_at
FROM pending_registrations
WHERE phone_e164 IS NOT NULL
ORDER BY created_at DESC
LIMIT 50;
"
```

### Update User Role

**IMPORTANT:** Role changes require updating BOTH the `users` table AND the `barbers` table for full platform consistency.

```bash
# ============================================================================
# PROMOTE TO BARBER
# ============================================================================
# Step 1: Update user role
sudo -u postgres psql -d campuscuts -c "UPDATE users SET role = 'BARBER', \"updatedAt\" = CURRENT_TIMESTAMP WHERE email = 'user@example.com';"

# Step 2: Activate barber record (if exists) or create one
# Check if barber record exists first:
sudo -u postgres psql -d campuscuts -c "SELECT b.id, b.\"isActive\" FROM barbers b JOIN users u ON b.\"userId\" = u.id WHERE u.email = 'user@example.com';"

# If barber record exists, activate it:
sudo -u postgres psql -d campuscuts -c "UPDATE barbers SET \"isActive\" = true, \"updatedAt\" = CURRENT_TIMESTAMP WHERE \"userId\" = (SELECT id FROM users WHERE email = 'user@example.com');"

# ============================================================================
# PROMOTE TO CAMPUS_MANAGER
# ============================================================================
# Step 1: Update user role AND set their campusId
sudo -u postgres psql -d campuscuts -c "UPDATE users SET role = 'CAMPUS_MANAGER', \"campusId\" = 'CAMPUS_UUID_HERE', \"updatedAt\" = CURRENT_TIMESTAMP WHERE email = 'user@example.com';"

# Step 2: Set isCampusManager flag on barber record
sudo -u postgres psql -d campuscuts -c "UPDATE barbers SET \"isCampusManager\" = true, \"isActive\" = true, \"updatedAt\" = CURRENT_TIMESTAMP WHERE \"userId\" = (SELECT id FROM users WHERE email = 'user@example.com');"

# ============================================================================
# DEMOTE TO CONSUMER (from BARBER or CAMPUS_MANAGER)
# ============================================================================
# Step 1: Update user role
sudo -u postgres psql -d campuscuts -c "UPDATE users SET role = 'CONSUMER', \"updatedAt\" = CURRENT_TIMESTAMP WHERE email = 'user@example.com';"

# Step 2: Deactivate barber record and remove campus manager flag
sudo -u postgres psql -d campuscuts -c "UPDATE barbers SET \"isActive\" = false, \"isCampusManager\" = false, \"updatedAt\" = CURRENT_TIMESTAMP WHERE \"userId\" = (SELECT id FROM users WHERE email = 'user@example.com');"

# Step 3: Delete any CM-barber direct conversations (optional cleanup)
sudo -u postgres psql -d campuscuts -c "DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE booking_id IS NULL AND (user1_id = (SELECT id FROM users WHERE email = 'user@example.com') OR user2_id = (SELECT id FROM users WHERE email = 'user@example.com'))); DELETE FROM conversations WHERE booking_id IS NULL AND (user1_id = (SELECT id FROM users WHERE email = 'user@example.com') OR user2_id = (SELECT id FROM users WHERE email = 'user@example.com'));"

# ============================================================================
# PROMOTE TO ADMIN
# ============================================================================
# Admins have campus manager privileges at ALL campuses automatically
sudo -u postgres psql -d campuscuts -c "UPDATE users SET role = 'ADMIN', \"updatedAt\" = CURRENT_TIMESTAMP WHERE email = 'user@example.com';"

# ============================================================================
# REVOKE CAMPUS_MANAGER (keep as BARBER)
# ============================================================================
# Step 1: Change role to BARBER
sudo -u postgres psql -d campuscuts -c "UPDATE users SET role = 'BARBER', \"updatedAt\" = CURRENT_TIMESTAMP WHERE email = 'user@example.com';"

# Step 2: Remove isCampusManager flag but keep barber active
sudo -u postgres psql -d campuscuts -c "UPDATE barbers SET \"isCampusManager\" = false, \"updatedAt\" = CURRENT_TIMESTAMP WHERE \"userId\" = (SELECT id FROM users WHERE email = 'user@example.com');"

# ============================================================================
# QUICK REFERENCE: Get Campus IDs
# ============================================================================
sudo -u postgres psql -d campuscuts -c "SELECT id, name FROM campuses WHERE name ILIKE '%cal poly%' OR name ILIKE '%your campus%' LIMIT 10;"
```

### Update User Email Verification
```bash
# Verify email
sudo -u postgres psql -d campuscuts -c "UPDATE users SET email_verified = true WHERE email = 'user@example.com';"

# Unverify email
sudo -u postgres psql -d campuscuts -c "UPDATE users SET email_verified = false WHERE email = 'user@example.com';"
```

### Update User Profile
```bash
# Update display name
sudo -u postgres psql -d campuscuts -c "UPDATE users SET \"displayName\" = 'New Name' WHERE email = 'user@example.com';"

# Update avatar
sudo -u postgres psql -d campuscuts -c "UPDATE users SET \"avatarUrl\" = 'https://example.com/image.jpg' WHERE email = 'user@example.com';"

# Update Instagram
sudo -u postgres psql -d campuscuts -c "UPDATE users SET \"instagramHandle\" = '@username' WHERE email = 'user@example.com';"
```

### Block/Unblock User
```bash
# Block user
sudo -u postgres psql -d campuscuts -c "UPDATE users SET \"isBlocked\" = true WHERE email = 'user@example.com';"

# Unblock user
sudo -u postgres psql -d campuscuts -c "UPDATE users SET \"isBlocked\" = false WHERE email = 'user@example.com';"
```

### Platform ban (`isBanned`) — view, ban, unban

**Different from `isBlocked` above:** `"isBanned"` is the **platform ban** used for trust-and-safety (e.g. admin moderation). When `true`, the user **cannot sign in**. The admin API and Safety tab read/write this column.

In `psql` output, booleans show as **`t`** / **`f`**.

#### View all banned users

```bash
sudo -u postgres psql -d campuscuts -c "
SELECT id, first_name, last_name, email, role, \"campusId\", \"isBanned\", \"updatedAt\"
FROM users
WHERE \"isBanned\" = true
ORDER BY \"updatedAt\" DESC NULLS LAST;
"
```

#### Count banned users

```bash
sudo -u postgres psql -d campuscuts -c "SELECT COUNT(*) AS banned_count FROM users WHERE \"isBanned\" = true;"
```

#### View banned users with campus name

```bash
sudo -u postgres psql -d campuscuts -c "
SELECT u.id, u.first_name, u.last_name, u.email, u.role,
       c.name AS campus_name, u.\"isBanned\", u.\"updatedAt\"
FROM users u
LEFT JOIN campuses c ON c.id = u.\"campusId\"
WHERE u.\"isBanned\" = true
ORDER BY u.\"updatedAt\" DESC NULLS LAST;
"
```

#### Ban a user (by email)

```bash
# Replace user@example.com
sudo -u postgres psql -d campuscuts -c "UPDATE users SET \"isBanned\" = true, \"updatedAt\" = NOW() WHERE email = 'user@example.com';"
```

#### Ban a user (by UUID)

Use **double-quoted** `-c "..."` in bash so the UUID stays inside **single quotes** in SQL. Replace the UUID.

```bash
sudo -u postgres psql -d campuscuts -c "UPDATE users SET \"isBanned\" = true, \"updatedAt\" = NOW() WHERE id = '00000000-0000-0000-0000-000000000000';"
```

#### Unban a user (by email)

```bash
sudo -u postgres psql -d campuscuts -c "UPDATE users SET \"isBanned\" = false, \"updatedAt\" = NOW() WHERE email = 'user@example.com';"
```

#### Unban a user (by UUID)

```bash
sudo -u postgres psql -d campuscuts -c "UPDATE users SET \"isBanned\" = false, \"updatedAt\" = NOW() WHERE id = '00000000-0000-0000-0000-000000000000';"
```

#### Using `DATABASE_URL` (app user / remote host)

If you connect as `campuscuts_user` via URI (e.g. on EC2 from `backend/.env`):

```bash
URL=$(grep '^DATABASE_URL=' ~/CampusCuts/backend/.env | cut -d= -f2- | tr -d '"' | sed 's/?schema=public//')
psql "$URL" -c "SELECT id, email, role, \"isBanned\" FROM users WHERE \"isBanned\" = true;"
psql "$URL" -c "UPDATE users SET \"isBanned\" = false, \"updatedAt\" = NOW() WHERE id = 'YOUR-USER-UUID-HERE';"
```

**Quoting trap:** Do not paste a multi-line `UPDATE ... WHERE id = ...` inside **single-quoted** `-c '...'` with `''uuid''` for the UUID — bash will strip SQL quotes and Postgres will error. Prefer `-c "UPDATE ... WHERE id = 'uuid';"` as above.

### Peer blocks (`user_blocks`) — who blocked whom

**Different from `isBlocked` / `isBanned` above:** `user_blocks` stores **pairwise** blocks (consumer ↔ service provider, etc.). Each row is one direction: **`blocker_user_id`** chose to block **`blocked_user_id`**. Messaging checks **both** directions (if A blocked B or B blocked A, they cannot interact). Created by migration `backend/src/database/migrations/028_ugc_safety_blocks_reports.sql` (table may be absent until that migrate has been applied).

#### Confirm table exists

```bash
sudo -u postgres psql -d campuscuts -c "SELECT to_regclass('public.user_blocks');"
```

#### List all peer blocks (raw IDs)

```bash
sudo -u postgres psql -d campuscuts -c "
SELECT blocker_user_id, blocked_user_id, created_at
FROM user_blocks
ORDER BY created_at DESC
LIMIT 200;
"
```

#### Who blocked whom (with names and emails)

```bash
sudo -u postgres psql -d campuscuts -c "
SELECT
  ub.blocker_user_id,
  blocker.first_name || ' ' || blocker.last_name AS blocker_name,
  blocker.email AS blocker_email,
  ub.blocked_user_id,
  blocked.first_name || ' ' || blocked.last_name AS blocked_name,
  blocked.email AS blocked_email,
  ub.created_at
FROM user_blocks ub
JOIN users blocker ON blocker.id = ub.blocker_user_id
JOIN users blocked ON blocked.id = ub.blocked_user_id
ORDER BY ub.created_at DESC
LIMIT 200;
"
```

#### Everyone a given user has blocked (outgoing blocks)

Replace the UUID with the blocker’s `users.id`.

```bash
sudo -u postgres psql -d campuscuts -c "
SELECT ub.blocked_user_id, u.first_name, u.last_name, u.email, ub.created_at
FROM user_blocks ub
JOIN users u ON u.id = ub.blocked_user_id
WHERE ub.blocker_user_id = '00000000-0000-0000-0000-000000000000'
ORDER BY ub.created_at DESC;
"
```

#### Everyone who has blocked a given user (incoming blocks)

Replace the UUID with the target `users.id` (who might be a service provider).

```bash
sudo -u postgres psql -d campuscuts -c "
SELECT ub.blocker_user_id, u.first_name, u.last_name, u.email, ub.created_at
FROM user_blocks ub
JOIN users u ON u.id = ub.blocker_user_id
WHERE ub.blocked_user_id = '00000000-0000-0000-0000-000000000000'
ORDER BY ub.created_at DESC;
"
```

#### Remove one directed block (admin / support)

Deletes the row **blocker** → **blocked** only (not the reverse, unless that row exists too).

```bash
sudo -u postgres psql -d campuscuts -c "
DELETE FROM user_blocks
WHERE blocker_user_id = '00000000-0000-0000-0000-000000000001'
  AND blocked_user_id = '00000000-0000-0000-0000-000000000002';
"
```

### Delete User (Simple)
```bash
sudo -u postgres psql -d campuscuts -c "DELETE FROM users WHERE email = 'user@example.com';"
```

### Delete User Completely (Handles All Foreign Keys)
Use this when simple delete fails due to foreign key constraints. Deletes all related data first.

```bash
# Replace 'user@example.com' with the actual email
sudo -u postgres psql -d campuscuts -c "
DO \$\$
DECLARE
    target_id UUID;
    target_email TEXT := 'user@example.com';
BEGIN
    -- Get user ID
    SELECT id INTO target_id FROM users WHERE email = target_email;
    
    IF target_id IS NULL THEN
        RAISE NOTICE 'User not found: %', target_email;
        RETURN;
    END IF;
    
    RAISE NOTICE 'Deleting user: % (%)', target_email, target_id;
    
    -- Delete payments linked to user's bookings (as consumer)
    DELETE FROM payments WHERE booking_id IN (
        SELECT id FROM bookings WHERE \"consumerId\" = target_id
    );
    RAISE NOTICE 'Deleted payments for consumer bookings';
    
    -- Delete payments linked to user's bookings (as barber via barbers table)
    DELETE FROM payments WHERE booking_id IN (
        SELECT b.id FROM bookings b
        JOIN barbers bar ON b.\"barberId\" = bar.id
        WHERE bar.\"userId\" = target_id
    );
    RAISE NOTICE 'Deleted payments for barber bookings';
    
    -- Delete bookings (as consumer)
    DELETE FROM bookings WHERE \"consumerId\" = target_id;
    RAISE NOTICE 'Deleted consumer bookings';
    
    -- Delete bookings (as barber)
    DELETE FROM bookings WHERE \"barberId\" IN (
        SELECT id FROM barbers WHERE \"userId\" = target_id
    );
    RAISE NOTICE 'Deleted barber bookings';
    
    -- Delete messages
    DELETE FROM messages WHERE sender_id = target_id;
    RAISE NOTICE 'Deleted messages';
    
    -- Delete conversations (as participant)
    DELETE FROM conversations WHERE user1_id = target_id OR user2_id = target_id;
    RAISE NOTICE 'Deleted conversations';
    
    -- Delete notifications
    DELETE FROM notifications WHERE user_id = target_id;
    RAISE NOTICE 'Deleted notifications';
    
    -- Delete barber applications
    DELETE FROM barber_applications WHERE user_id = target_id;
    RAISE NOTICE 'Deleted barber applications';
    
    -- Delete barber service location assignments
    DELETE FROM barber_service_locations WHERE barber_id IN (
        SELECT id FROM barbers WHERE \"userId\" = target_id
    );
    RAISE NOTICE 'Deleted barber service locations';
    
    -- Delete barber location assignments (old table)
    DELETE FROM barber_locations WHERE barber_id IN (
        SELECT id FROM barbers WHERE \"userId\" = target_id
    );
    RAISE NOTICE 'Deleted barber locations';
    
    -- Delete barber profile
    DELETE FROM barbers WHERE \"userId\" = target_id;
    RAISE NOTICE 'Deleted barber profile';
    
    -- Delete the user
    DELETE FROM users WHERE id = target_id;
    RAISE NOTICE 'User deleted successfully: %', target_email;
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error: %', SQLERRM;
    RAISE;
END \$\$;
"
```

### Delete User (One-Liner Quick Version)
Simpler version that ignores tables that may not exist:

```bash
# Replace EMAIL with the actual email address
EMAIL='user@example.com' && sudo -u postgres psql -d campuscuts -c "
BEGIN;
DELETE FROM payments WHERE booking_id IN (SELECT id FROM bookings WHERE \"consumerId\" = (SELECT id FROM users WHERE email = '$EMAIL'));
DELETE FROM bookings WHERE \"consumerId\" = (SELECT id FROM users WHERE email = '$EMAIL');
DELETE FROM messages WHERE sender_id = (SELECT id FROM users WHERE email = '$EMAIL');
DELETE FROM conversations WHERE user1_id = (SELECT id FROM users WHERE email = '$EMAIL') OR user2_id = (SELECT id FROM users WHERE email = '$EMAIL');
DELETE FROM notifications WHERE user_id = (SELECT id FROM users WHERE email = '$EMAIL');
DELETE FROM barber_applications WHERE user_id = (SELECT id FROM users WHERE email = '$EMAIL');
DELETE FROM barbers WHERE \"userId\" = (SELECT id FROM users WHERE email = '$EMAIL');
DELETE FROM users WHERE email = '$EMAIL';
COMMIT;
"
```

### Delete Account Completely (For Testing)
Use this to fully delete an account so you can test account creation again.
This deletes the user AND all related records in other tables.

```bash
# Step 1: Find the user ID
sudo -u postgres psql -d campuscuts -c "SELECT id, email, first_name, role FROM users WHERE email = 'test@example.com';"

# Step 2: Delete all related records (replace USER_ID with actual UUID)
# Delete in order to avoid foreign key constraints

# Delete notifications
sudo -u postgres psql -d campuscuts -c "DELETE FROM notifications WHERE \"userId\" = 'USER_ID';"

# Delete bookings (as consumer or barber)
sudo -u postgres psql -d campuscuts -c "DELETE FROM bookings WHERE \"consumerId\" = 'USER_ID' OR \"barberId\" = 'USER_ID';"

# Delete messages
sudo -u postgres psql -d campuscuts -c "DELETE FROM messages WHERE \"senderId\" = 'USER_ID' OR \"receiverId\" = 'USER_ID';"

# Delete conversations
sudo -u postgres psql -d campuscuts -c "DELETE FROM conversations WHERE \"consumerId\" = 'USER_ID' OR \"barberId\" = 'USER_ID';"

# Delete barber application (if any)
sudo -u postgres psql -d campuscuts -c "DELETE FROM barber_applications WHERE \"userId\" = 'USER_ID';"

# Delete barber profile (if any)
sudo -u postgres psql -d campuscuts -c "DELETE FROM barbers WHERE \"userId\" = 'USER_ID';"

# Delete the user
sudo -u postgres psql -d campuscuts -c "DELETE FROM users WHERE id = 'USER_ID';"
```

### Delete Account by Email (One Command)
Deletes everything in the correct order using the email address directly.
Replace `test@example.com` with the actual email.

```bash
sudo -u postgres psql -d campuscuts -c "
DO \$\$
DECLARE
    target_user_id UUID;
BEGIN
    -- Get user ID
    SELECT id INTO target_user_id FROM users WHERE email = 'test@example.com';
    
    IF target_user_id IS NULL THEN
        RAISE NOTICE 'User not found';
        RETURN;
    END IF;
    
    RAISE NOTICE 'Deleting user: %', target_user_id;
    
    -- Delete related records (using correct column names)
    DELETE FROM notifications WHERE user_id = target_user_id;
    DELETE FROM bookings WHERE \"consumerId\" = target_user_id OR \"barberId\" = target_user_id;
    DELETE FROM messages WHERE sender_id = target_user_id;
    DELETE FROM barber_applications WHERE user_id = target_user_id;
    DELETE FROM barbers WHERE \"userId\" = target_user_id;
    DELETE FROM users WHERE id = target_user_id;
    
    RAISE NOTICE 'User deleted successfully';
END \$\$;
"
```

### Quick Delete Test Account
```bash
# Replace EMAIL with the test email address
EMAIL='test@example.com' && sudo -u postgres psql -d campuscuts -c "
DO \$\$
DECLARE uid UUID;
BEGIN
    SELECT id INTO uid FROM users WHERE email = '$EMAIL';
    IF uid IS NOT NULL THEN
        DELETE FROM notifications WHERE user_id = uid;
        DELETE FROM bookings WHERE \"consumerId\" = uid OR \"barberId\" = uid;
        DELETE FROM messages WHERE sender_id = uid;
        DELETE FROM barber_applications WHERE user_id = uid;
        DELETE FROM barbers WHERE \"userId\" = uid;
        DELETE FROM users WHERE id = uid;
        RAISE NOTICE 'Deleted: %', uid;
    ELSE
        RAISE NOTICE 'User not found: $EMAIL';
    END IF;
END \$\$;
"
```

### Count Users by Role
```bash
sudo -u postgres psql -d campuscuts -c "SELECT role, COUNT(*) FROM users GROUP BY role;"
```

### Find User ID by Email
```bash
sudo -u postgres psql -d campuscuts -c "SELECT id FROM users WHERE email = 'user@example.com';"
```

---

## CONSUMERS

> **Note:** Consumers are not tied to any university. The `campusId` stored is just where they signed up, not an operational restriction.

### View All Consumers
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT 
  u.first_name || ' ' || u.last_name AS name,
  u.email,
  u.email_verified AS verified,
  u.\"createdAt\"::date AS joined
FROM users u
WHERE u.role = 'CONSUMER'
ORDER BY u.\"createdAt\" DESC;
"
```

### View All Consumers (Detailed)
```bash
sudo -u postgres psql -d campuscuts -x -c "
SELECT 
  u.id,
  u.first_name,
  u.last_name,
  u.email,
  u.\"displayName\",
  u.\"avatarUrl\",
  u.email_verified,
  u.\"createdAt\",
  c.name AS signup_campus
FROM users u
LEFT JOIN campuses c ON u.\"campusId\" = c.id
WHERE u.role = 'CONSUMER'
ORDER BY u.\"createdAt\" DESC
LIMIT 20;
"
```

### View Consumers by Signup Campus
```bash
# Replace 'Cal Poly SLO' with campus name
sudo -u postgres psql -d campuscuts -c "
SELECT 
  u.first_name || ' ' || u.last_name AS name,
  u.email,
  u.email_verified AS verified,
  u.\"createdAt\"::date AS joined
FROM users u
JOIN campuses c ON u.\"campusId\" = c.id
WHERE u.role = 'CONSUMER'
  AND c.name ILIKE '%Cal Poly SLO%'
ORDER BY u.\"createdAt\" DESC;
"
```

### View Demoted Barbers (Now Consumers)
```bash
# Shows consumers who were previously barbers (have barber record with isActive=false)
sudo -u postgres psql -d campuscuts -c "
SELECT 
  u.first_name || ' ' || u.last_name AS name,
  u.email,
  u.role,
  b.\"avgRating\" AS prev_rating,
  b.\"totalBookings\" AS prev_bookings,
  c.name AS prev_campus
FROM users u
JOIN barbers b ON u.id = b.\"userId\"
JOIN campuses c ON u.\"campusId\" = c.id
WHERE u.role = 'CONSUMER'
  AND b.\"isActive\" = false
ORDER BY u.\"createdAt\" DESC;
"
```

### Count Consumers
```bash
sudo -u postgres psql -d campuscuts -c "SELECT COUNT(*) AS total_consumers FROM users WHERE role = 'CONSUMER';"
```

### Count Consumers by Signup Campus
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT 
  c.name AS campus,
  COUNT(*) AS consumer_count
FROM users u
JOIN campuses c ON u.\"campusId\" = c.id
WHERE u.role = 'CONSUMER'
GROUP BY c.name
ORDER BY consumer_count DESC;
"
```

---

## BARBERS

### View Barber Info Requirements (NOT NULL columns)
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'barbers' AND is_nullable = 'NO'
ORDER BY ordinal_position;
"
```

### View All Active Barbers (System-Wide)
```bash
# Shows all active barbers. Consumers are not tied to any campus.
# ADMIN = All Campuses, CAMPUS_MANAGER/BARBER = their specific campus
sudo -u postgres psql -d campuscuts -c "
SELECT 
  u.first_name || ' ' || u.last_name AS name,
  u.email,
  u.role,
  CASE 
    WHEN u.role = 'ADMIN' THEN 'All Campuses'
    WHEN u.role = 'CONSUMER' THEN 'N/A'
    ELSE c.name 
  END AS campus_scope,
  COALESCE(b.\"avgRating\"::text, '-') AS rating,
  CASE WHEN b.\"isCampusManager\" = true OR u.role IN ('CAMPUS_MANAGER', 'ADMIN') THEN 'Yes' ELSE 'No' END AS campus_mgr
FROM barbers b 
JOIN users u ON b.\"userId\" = u.id 
JOIN campuses c ON u.\"campusId\" = c.id
WHERE b.\"isActive\" = true 
  AND u.role IN ('BARBER', 'CAMPUS_MANAGER', 'ADMIN')
ORDER BY u.role = 'ADMIN' DESC, u.role = 'CAMPUS_MANAGER' DESC, c.name, u.first_name;
"
```

### View All Campus Managers (System-Wide)
```bash
# Shows all campus managers and admins (who have CM privileges at all campuses)
sudo -u postgres psql -d campuscuts -c "
SELECT 
  u.first_name || ' ' || u.last_name AS name,
  u.email,
  u.role,
  CASE 
    WHEN u.role = 'ADMIN' THEN 'All Campuses'
    ELSE c.name 
  END AS scope,
  COALESCE(b.\"avgRating\"::text, '-') AS rating
FROM users u
LEFT JOIN barbers b ON u.id = b.\"userId\"
LEFT JOIN campuses c ON u.\"campusId\" = c.id
WHERE u.role IN ('CAMPUS_MANAGER', 'ADMIN')
   OR b.\"isCampusManager\" = true
ORDER BY u.role = 'ADMIN' DESC, c.name, u.first_name;
"
```

### Count Campus Managers by Campus
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT 
  c.name AS campus,
  COUNT(*) AS manager_count
FROM users u
JOIN campuses c ON u.\"campusId\" = c.id
WHERE u.role = 'CAMPUS_MANAGER'
GROUP BY c.name
ORDER BY manager_count DESC, c.name;
"
```

### View Barbers at a Specific University (by Campus Name)
```bash
# Replace 'University of Florida' with the campus name
# Note: ADMINs appear for ALL campuses since they have platform-wide privileges
sudo -u postgres psql -d campuscuts -c "
SELECT 
  u.first_name || ' ' || u.last_name AS name,
  u.email,
  u.role,
  CASE 
    WHEN u.role = 'ADMIN' THEN 'All Campuses'
    WHEN u.role = 'CONSUMER' THEN 'N/A'
    ELSE c.name 
  END AS campus_scope,
  COALESCE(b.\"avgRating\"::text, '-') AS rating,
  CASE WHEN b.\"isActive\" THEN 'Yes' ELSE 'No' END AS active,
  CASE WHEN b.\"isCampusManager\" = true OR u.role IN ('CAMPUS_MANAGER', 'ADMIN') THEN 'Yes' ELSE 'No' END AS campus_mgr
FROM barbers b 
JOIN users u ON b.\"userId\" = u.id 
JOIN campuses c ON u.\"campusId\" = c.id
WHERE c.name ILIKE '%University of Florida%' OR u.role = 'ADMIN'
ORDER BY u.role = 'ADMIN' DESC, (b.\"isCampusManager\" = true OR u.role = 'CAMPUS_MANAGER') DESC, u.first_name;
"
```

### View Barbers at a Specific University (by Campus ID)
```bash
# Replace the UUID with the actual campus ID
# Note: ADMINs appear for ALL campuses since they have platform-wide privileges
sudo -u postgres psql -d campuscuts -c "
SELECT 
  u.first_name || ' ' || u.last_name AS name,
  u.email,
  u.role,
  CASE 
    WHEN u.role = 'ADMIN' THEN 'All Campuses'
    WHEN u.role = 'CONSUMER' THEN 'N/A'
    ELSE 'This Campus' 
  END AS campus_scope,
  COALESCE(b.\"avgRating\"::text, '-') AS rating,
  CASE WHEN b.\"isActive\" THEN 'Yes' ELSE 'No' END AS active,
  CASE WHEN b.\"isCampusManager\" = true OR u.role IN ('CAMPUS_MANAGER', 'ADMIN') THEN 'Yes' ELSE 'No' END AS campus_mgr
FROM barbers b 
JOIN users u ON b.\"userId\" = u.id 
WHERE u.\"campusId\" = '9de371b8-6ce6-492e-a716-93cb03ae2f82' OR u.role = 'ADMIN'
ORDER BY u.role = 'ADMIN' DESC, (b.\"isCampusManager\" = true OR u.role = 'CAMPUS_MANAGER') DESC, u.first_name;
"
```

### View All Active Barbers at a University (Excludes Inactive/Demoted)
```bash
# Replace 'University of Florida' with the campus name
# Note: ADMINs appear for ALL campuses, Consumers show N/A
sudo -u postgres psql -d campuscuts -c "
SELECT 
  u.first_name || ' ' || u.last_name AS name,
  u.email,
  u.role,
  CASE 
    WHEN u.role = 'ADMIN' THEN 'All Campuses'
    ELSE c.name 
  END AS campus_scope,
  COALESCE(b.\"avgRating\"::text, '-') AS rating,
  CASE WHEN b.\"isCampusManager\" = true OR u.role IN ('CAMPUS_MANAGER', 'ADMIN') THEN 'Yes' ELSE 'No' END AS campus_mgr
FROM barbers b 
JOIN users u ON b.\"userId\" = u.id 
JOIN campuses c ON u.\"campusId\" = c.id
WHERE (c.name ILIKE '%Cal Poly SLO%' OR u.role = 'ADMIN')
  AND b.\"isActive\" = true
  AND u.role IN ('BARBER', 'CAMPUS_MANAGER', 'ADMIN')
ORDER BY u.role = 'ADMIN' DESC, (b.\"isCampusManager\" = true OR u.role = 'CAMPUS_MANAGER') DESC, b.\"avgRating\" DESC NULLS LAST;
"
```

### View Campus Manager for a University
```bash
# Replace 'University of Florida' with the campus name
# Note: ADMINs appear for ALL campuses (platform-wide privileges)
sudo -u postgres psql -d campuscuts -c "
SELECT 
  u.first_name || ' ' || u.last_name AS name,
  u.email,
  u.role,
  CASE WHEN u.role = 'ADMIN' THEN 'All Campuses' ELSE c.name END as scope
FROM barbers b 
JOIN users u ON b.\"userId\" = u.id 
JOIN campuses c ON u.\"campusId\" = c.id
WHERE (c.name ILIKE '%University of Florida%' AND (b.\"isCampusManager\" = true OR u.role = 'CAMPUS_MANAGER'))
   OR u.role = 'ADMIN'
ORDER BY u.role = 'ADMIN' DESC, u.first_name;
"
```

### View Specific Barber by Email
```bash
sudo -u postgres psql -d campuscuts -c "SELECT b.*, u.role, u.first_name, u.last_name FROM barbers b JOIN users u ON b.\"userId\" = u.id WHERE u.email = 'barber@example.com';"
```

### View Barber Schedule
```bash
sudo -u postgres psql -d campuscuts -c "SELECT u.email, b.\"weeklySchedule\" FROM barbers b JOIN users u ON b.\"userId\" = u.id WHERE u.email = 'barber@example.com';"
```

### View Barber Specialties
```bash
sudo -u postgres psql -d campuscuts -c "SELECT u.email, b.specialties FROM barbers b JOIN users u ON b.\"userId\" = u.id WHERE u.email = 'barber@example.com';"
```

### Update Barber Bio
```bash
sudo -u postgres psql -d campuscuts -c "UPDATE barbers SET bio = 'New bio text here' FROM users WHERE barbers.\"userId\" = users.id AND users.email = 'barber@example.com';"
```

### Activate/Deactivate Barber
```bash
# Deactivate
sudo -u postgres psql -d campuscuts -c "UPDATE barbers SET \"isActive\" = false FROM users WHERE barbers.\"userId\" = users.id AND users.email = 'barber@example.com';"

# Activate
sudo -u postgres psql -d campuscuts -c "UPDATE barbers SET \"isActive\" = true FROM users WHERE barbers.\"userId\" = users.id AND users.email = 'barber@example.com';"
```

### Delete Barber Profile
```bash
sudo -u postgres psql -d campuscuts -c "DELETE FROM barbers USING users WHERE barbers.\"userId\" = users.id AND users.email = 'barber@example.com';"
```

### Describe Barbers Table
```bash
sudo -u postgres psql -d campuscuts -c "\d barbers"
```

---

## BARBER APPLICATIONS

### View All Applications (Table Format)
```bash
sudo -u postgres psql -d campuscuts -c "SELECT ba.id, u.email, u.first_name, ba.status, ba.years_experience, ba.created_at FROM barber_applications ba JOIN users u ON ba.user_id = u.id ORDER BY ba.created_at DESC;"
```

### View All Applications (Expanded/Readable Format)
```bash
sudo -u postgres psql -d campuscuts -x -c "
SELECT 
    ba.id,
    u.first_name || ' ' || u.last_name as full_name,
    u.email,
    c.name as campus,
    ba.status,
    array_to_string(ba.specialties, ', ') as specialties,
    ba.years_experience,
    ba.has_license,
    ba.has_own_tools,
    ba.available_hours,
    ba.why_be_barber,
    ba.social_media,
    ba.created_at::date as applied_date
FROM barber_applications ba
JOIN users u ON ba.user_id = u.id
LEFT JOIN campuses c ON ba.campus_id = c.id
ORDER BY ba.created_at DESC;
"
```

### View Pending Applications
```bash
sudo -u postgres psql -d campuscuts -c "SELECT ba.*, u.email FROM barber_applications ba JOIN users u ON ba.user_id = u.id WHERE ba.status = 'pending';"
```

### View Pending Applications (Expanded)
```bash
sudo -u postgres psql -d campuscuts -x -c "
SELECT 
    ba.id,
    u.first_name || ' ' || u.last_name as full_name,
    u.email,
    c.name as campus,
    array_to_string(ba.specialties, ', ') as specialties,
    ba.years_experience,
    ba.has_license,
    ba.has_own_tools,
    ba.available_hours,
    ba.why_be_barber,
    ba.social_media,
    ba.created_at
FROM barber_applications ba
JOIN users u ON ba.user_id = u.id
LEFT JOIN campuses c ON ba.campus_id = c.id
WHERE ba.status = 'pending'
ORDER BY ba.created_at DESC;
"
```

### Approve Application
```bash
sudo -u postgres psql -d campuscuts -c "UPDATE barber_applications SET status = 'approved', reviewed_at = NOW() WHERE id = 'UUID_HERE';"
```

### Reject Application
```bash
sudo -u postgres psql -d campuscuts -c "UPDATE barber_applications SET status = 'rejected', reviewed_at = NOW(), review_notes = 'Reason here' WHERE id = 'UUID_HERE';"
```

### Delete Application
```bash
sudo -u postgres psql -d campuscuts -c "DELETE FROM barber_applications WHERE id = 'UUID_HERE';"
```

### Count Applications by Status
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT status, COUNT(*) FROM barber_applications GROUP BY status
UNION ALL
SELECT status || ' (guest)', COUNT(*) FROM guest_barber_applications GROUP BY status;
"
```

### Describe Barber Applications Table
```bash
sudo -u postgres psql -d campuscuts -c "\d barber_applications"
```

---

## GUEST BARBER APPLICATIONS

Guest applications are from unauthenticated users who want to become barbers. They must create an account after approval.

### View All Guest Applications (Expanded)
```bash
sudo -u postgres psql -d campuscuts -x -c "
SELECT 
    gba.id,
    gba.full_name,
    gba.email,
    gba.phone,
    c.name as campus,
    gba.status,
    array_to_string(gba.specialties, ', ') as specialties,
    gba.years_experience,
    gba.linked_user_id,
    gba.created_at::date as applied_date
FROM guest_barber_applications gba
LEFT JOIN campuses c ON gba.campus_id = c.id
ORDER BY gba.created_at DESC;
"
```

### View Pending Guest Applications
```bash
sudo -u postgres psql -d campuscuts -x -c "
SELECT 
    gba.id,
    gba.full_name,
    gba.email,
    gba.phone,
    c.name as campus,
    array_to_string(gba.specialties, ', ') as specialties,
    gba.years_experience,
    gba.created_at
FROM guest_barber_applications gba
LEFT JOIN campuses c ON gba.campus_id = c.id
WHERE gba.status = 'pending'
ORDER BY gba.created_at DESC;
"
```

### Approve Guest Application
```bash
sudo -u postgres psql -d campuscuts -c "UPDATE guest_barber_applications SET status = 'approved', reviewed_at = NOW() WHERE id = 'UUID_HERE';"
```

### Reject Guest Application
```bash
sudo -u postgres psql -d campuscuts -c "UPDATE guest_barber_applications SET status = 'rejected', reviewed_at = NOW(), review_notes = 'Reason here' WHERE id = 'UUID_HERE';"
```

### Delete Guest Application
```bash
sudo -u postgres psql -d campuscuts -c "DELETE FROM guest_barber_applications WHERE id = 'UUID_HERE';"
```

### Describe Guest Barber Applications Table
```bash
sudo -u postgres psql -d campuscuts -c "\d guest_barber_applications"
```

---

## CAMPUSES

### View All Campuses
```bash
sudo -u postgres psql -d campuscuts -c "SELECT id, name, city, state, \"isActive\" FROM campuses ORDER BY name;"
```

### View Campuses (Formatted)
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT 
    name,
    city,
    state,
    slug,
    \"basePriceUsdCents\" / 100.0 as base_price,
    \"platformFeePercent\" as fee_pct,
    \"isActive\"
FROM campuses 
ORDER BY state, city;
"
```

### View Campus Count
```bash
sudo -u postgres psql -d campuscuts -c "SELECT COUNT(*) as total_campuses FROM campuses;"
```

### Find Campus by Name
```bash
sudo -u postgres psql -d campuscuts -c "SELECT * FROM campuses WHERE name ILIKE '%poly%';"
```

### Find Campuses by State
```bash
sudo -u postgres psql -d campuscuts -c "SELECT name, city FROM campuses WHERE state = 'CA' ORDER BY name;"
```

### Add New Campus
```bash
sudo -u postgres psql -d campuscuts -c "
INSERT INTO campuses (id, slug, name, city, state, timezone, \"updatedAt\")
VALUES (gen_random_uuid(), 'new-university', 'New University Name', 'City', 'ST', 'America/New_York', CURRENT_TIMESTAMP);
"
```

### Update Campus
```bash
# Activate/Deactivate campus
sudo -u postgres psql -d campuscuts -c "UPDATE campuses SET \"isActive\" = false WHERE slug = 'campus-slug';"

# Update pricing
sudo -u postgres psql -d campuscuts -c "UPDATE campuses SET \"basePriceUsdCents\" = 2500, \"averagePriceUsdCents\" = 4000 WHERE slug = 'campus-slug';"
```

### Delete Invalid Campuses
```bash
# Delete non-university entries (like GMAIL, ICLOUD)
sudo -u postgres psql -d campuscuts -c "DELETE FROM campuses WHERE name IN ('GMAIL', 'ICLOUD');"
```

### View Campus Timezones
```bash
# View timezones for all active campuses
sudo -u postgres psql -d campuscuts -c "
SELECT name, city, state, timezone 
FROM campuses 
WHERE \"isActive\" = true 
ORDER BY timezone, state, name;
"
```

### Update Campus Timezone
```bash
# Update timezone for a specific campus (e.g., fix a campus set to wrong timezone)
sudo -u postgres psql -d campuscuts -c "
UPDATE campuses 
SET timezone = 'America/Los_Angeles' 
WHERE slug = 'cal-poly';
"

# Common US timezones:
# - America/Los_Angeles (Pacific: CA, WA, OR, NV)
# - America/Denver (Mountain: CO, UT, AZ*, MT, NM, WY)
# - America/Chicago (Central: TX, IL, MN, WI, OK, NE, KS, IA, MO, AR, LA, MS, TN, AL)
# - America/New_York (Eastern: NY, MA, PA, FL, GA, NC, SC, VA, MD, NJ, CT, OH, MI, IN, KY, WV)
# - Pacific/Honolulu (Hawaii)
# - America/Phoenix (Arizona - no DST)
# * Arizona uses America/Phoenix (no daylight saving)
```

### Seed All Universities
```bash
# Run the seed script (after git pull)
# Option 1: Pipe the file (recommended - avoids permission issues)
cat ~/CampusCuts/backend/src/database/seed_campuses.sql | sudo -u postgres psql -d campuscuts

# Option 2: Copy to tmp first
cp ~/CampusCuts/backend/src/database/seed_campuses.sql /tmp/
sudo -u postgres psql -d campuscuts -f /tmp/seed_campuses.sql

# Option 3: Fix permissions then run directly
chmod 644 ~/CampusCuts/backend/src/database/seed_campuses.sql
sudo -u postgres psql -d campuscuts -f ~/CampusCuts/backend/src/database/seed_campuses.sql
```

### Describe Campuses Table
```bash
sudo -u postgres psql -d campuscuts -c "\d campuses"
```

### View All Campus Coordinates
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT name, city, state, latitude, longitude 
FROM campuses 
WHERE latitude IS NOT NULL 
ORDER BY state, name;
"
```

### View Campus Coordinates by State
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT name, city, latitude, longitude 
FROM campuses 
WHERE state = 'CA' AND latitude IS NOT NULL 
ORDER BY name;
"
```

### Find Campuses Near Coordinates
```bash
# Find campuses within ~50km of coordinates (approximate)
sudo -u postgres psql -d campuscuts -c "
SELECT 
    name, 
    city, 
    state,
    latitude, 
    longitude,
    ROUND((
        6371 * acos(
            cos(radians(35.3050)) * cos(radians(latitude)) * 
            cos(radians(longitude) - radians(-120.6625)) + 
            sin(radians(35.3050)) * sin(radians(latitude))
        )
    )::numeric, 2) as distance_km
FROM campuses 
WHERE latitude IS NOT NULL
ORDER BY distance_km 
LIMIT 10;
"
```

### Update Campus Coordinates
```bash
sudo -u postgres psql -d campuscuts -c "
UPDATE campuses 
SET latitude = 35.3050, longitude = -120.6625 
WHERE slug = 'cal-poly';
"
```

### Add Coordinates Columns (if not exists)
```bash
sudo -u postgres psql -d campuscuts -c "
ALTER TABLE campuses ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 6);
ALTER TABLE campuses ADD COLUMN IF NOT EXISTS longitude DECIMAL(10, 6);
CREATE INDEX IF NOT EXISTS idx_campuses_coordinates ON campuses(latitude, longitude);
"
```

---

## LOCATIONS

### View All Locations
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT 
    l.id,
    l.name,
    l.type,
    c.name as campus_name,
    l.\"isVerified\"
FROM locations l
JOIN campuses c ON l.\"campusId\" = c.id
ORDER BY c.name, l.name;
"
```

### View Locations for Campus
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT l.* FROM locations l
JOIN campuses c ON l.\"campusId\" = c.id
WHERE c.slug = 'cal-poly';
"
```

### Create Default Location for Campus
```bash
sudo -u postgres psql -d campuscuts -c "
INSERT INTO locations (id, \"campusId\", name, \"normalizedName\", type, cohort, \"usageCount\", confidence, \"isVerified\", \"updatedAt\")
SELECT 
    gen_random_uuid(),
    id,
    'Campus Default',
    'campus-default',
    'DORM'::\"LocationType\",
    'UNKNOWN'::\"LocationCohort\",
    1,
    0.50,
    false,
    CURRENT_TIMESTAMP
FROM campuses
WHERE slug = 'cal-poly';
"
```

### Describe Locations Table
```bash
sudo -u postgres psql -d campuscuts -c "\d locations"
```

---

## CAMPUS LOCATIONS (New System)

The new campus locations system allows campus managers to define predefined locations where barbers can offer services.

### Create Campus Locations Tables (Run Once)
```bash
sudo -u postgres psql -d campuscuts -c "
-- Campus locations table: stores locations available at each campus
CREATE TABLE IF NOT EXISTS campus_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_id UUID NOT NULL REFERENCES campuses(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  address TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(campus_id, name)
);

-- Barber locations: junction table linking barbers to their available locations
CREATE TABLE IF NOT EXISTS barber_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id UUID NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES campus_locations(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(barber_id, location_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_campus_locations_campus ON campus_locations(campus_id);
CREATE INDEX IF NOT EXISTS idx_campus_locations_active ON campus_locations(campus_id, is_active);
CREATE INDEX IF NOT EXISTS idx_barber_locations_barber ON barber_locations(barber_id);
CREATE INDEX IF NOT EXISTS idx_barber_locations_location ON barber_locations(location_id);
"
```

### View All Campus Locations
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT 
    cl.id,
    cl.name,
    cl.description,
    c.name as campus_name,
    cl.is_active,
    cl.created_at
FROM campus_locations cl
JOIN campuses c ON cl.campus_id = c.id
ORDER BY c.name, cl.name;
"
```

### View Locations for a Specific Campus
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT cl.id, cl.name, cl.description, cl.is_active
FROM campus_locations cl
JOIN campuses c ON cl.campus_id = c.id
WHERE c.slug = 'cal-poly'
ORDER BY cl.name;
"
```

### Add a Location to a Campus
```bash
sudo -u postgres psql -d campuscuts -c "
INSERT INTO campus_locations (campus_id, name, description, address)
SELECT id, 'Dexter Lawn', 'Popular outdoor meetup area', 'Near Kennedy Library'
FROM campuses WHERE slug = 'cal-poly';
"
```

### View Barber Location Assignments
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT 
    u.first_name || ' ' || u.last_name as barber_name,
    cl.name as location_name,
    bl.is_primary,
    bl.created_at as assigned_at
FROM barber_locations bl
JOIN barbers b ON bl.barber_id = b.id
JOIN users u ON b.\"userId\" = u.id
JOIN campus_locations cl ON bl.location_id = cl.id
ORDER BY barber_name, cl.name;
"
```

### Assign Location to a Barber
```bash
sudo -u postgres psql -d campuscuts -c "
INSERT INTO barber_locations (barber_id, location_id, is_primary)
SELECT b.id, cl.id, true
FROM barbers b
JOIN users u ON b.\"userId\" = u.id
JOIN campus_locations cl ON cl.campus_id = b.\"campusId\"
WHERE u.email = 'barber@example.com'
AND cl.name = 'Dexter Lawn';
"
```

### Remove Location from a Barber
```bash
sudo -u postgres psql -d campuscuts -c "
DELETE FROM barber_locations bl
USING barbers b, users u, campus_locations cl
WHERE bl.barber_id = b.id
AND b.\"userId\" = u.id
AND bl.location_id = cl.id
AND u.email = 'barber@example.com'
AND cl.name = 'Dexter Lawn';
"
```

### Delete a Campus Location
```bash
sudo -u postgres psql -d campuscuts -c "
DELETE FROM campus_locations
WHERE name = 'Dexter Lawn'
AND campus_id = (SELECT id FROM campuses WHERE slug = 'cal-poly');
"
```

### Describe Campus Locations Tables
```bash
sudo -u postgres psql -d campuscuts -c "\d campus_locations"
sudo -u postgres psql -d campuscuts -c "\d barber_locations"
```

---

## AVAILABILITY

### View All Availability Slots
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT 
    a.id,
    u.email as barber_email,
    a.\"startTime\",
    a.\"endTime\",
    a.status,
    a.\"priceUsdCents\" / 100.0 as price
FROM availability a
JOIN barbers b ON a.\"barberId\" = b.id
JOIN users u ON b.\"userId\" = u.id
ORDER BY a.\"startTime\" DESC
LIMIT 20;
"
```

### View Open Slots
```bash
sudo -u postgres psql -d campuscuts -c "SELECT * FROM availability WHERE status = 'OPEN' ORDER BY \"startTime\";"
```

### View Booked Slots
```bash
sudo -u postgres psql -d campuscuts -c "SELECT * FROM availability WHERE status = 'BOOKED' ORDER BY \"startTime\" DESC;"
```

### Describe Availability Table
```bash
sudo -u postgres psql -d campuscuts -c "\d availability"
```

---

## BOOKINGS

### View All Bookings
```bash
sudo -u postgres psql -d campuscuts -c "SELECT id, \"barberId\", \"consumerId\", \"serviceType\", status, \"requestedAt\" FROM bookings ORDER BY \"requestedAt\" DESC LIMIT 20;"
```

### View All Bookings (Expanded)
```bash
sudo -u postgres psql -d campuscuts -x -c "SELECT * FROM bookings ORDER BY \"requestedAt\" DESC LIMIT 10;"
```

### View Bookings by Status
```bash
# Status values: PENDING, ACCEPTED, REJECTED, COMPLETED, CANCELLED
sudo -u postgres psql -d campuscuts -c "SELECT * FROM bookings WHERE status = 'PENDING';"
sudo -u postgres psql -d campuscuts -c "SELECT * FROM bookings WHERE status = 'ACCEPTED';"
sudo -u postgres psql -d campuscuts -c "SELECT * FROM bookings WHERE status = 'REJECTED';"
sudo -u postgres psql -d campuscuts -c "SELECT * FROM bookings WHERE status = 'COMPLETED';"
sudo -u postgres psql -d campuscuts -c "SELECT * FROM bookings WHERE status = 'CANCELLED';"
```

### Booking Lifecycle Stages

#### Stage 1: PENDING (Consumer requested, waiting for barber response)
```bash
# View all pending booking requests
sudo -u postgres psql -d campuscuts -c "
SELECT 
    bar_u.first_name || ' ' || bar_u.last_name AS barber,
    c.first_name || ' ' || c.last_name AS consumer,
    b.\"serviceType\" AS service,
    '\$' || (b.\"priceUsdCents\" / 100.0)::numeric(10,2) AS price,
    TO_CHAR(b."requestedAt" AT TIME ZONE 'America/Los_Angeles', 'Mon DD, YYYY') AS date,
    TO_CHAR(b."requestedAt" AT TIME ZONE 'America/Los_Angeles', 'HH12:MI AM') AS time
FROM bookings b
JOIN users c ON b.\"consumerId\" = c.id
LEFT JOIN users bar_u ON b.\"barberId\" = bar_u.id
WHERE b.status = 'PENDING'
ORDER BY b."requestedAt" DESC;
"
```

#### Stage 2: ACCEPTED (Barber accepted the booking)
```bash
# View all accepted bookings awaiting service
sudo -u postgres psql -d campuscuts -c "
SELECT 
    bar_u.first_name || ' ' || bar_u.last_name AS barber,
    c.first_name || ' ' || c.last_name AS consumer,
    b.\"serviceType\" AS service,
    '\$' || (b.\"priceUsdCents\" / 100.0)::numeric(10,2) AS price,
    TO_CHAR(b."requestedAt" AT TIME ZONE 'America/Los_Angeles', 'Mon DD, YYYY') AS date,
    TO_CHAR(b."requestedAt" AT TIME ZONE 'America/Los_Angeles', 'HH12:MI AM') AS time
FROM bookings b
JOIN users c ON b.\"consumerId\" = c.id
LEFT JOIN users bar_u ON b.\"barberId\" = bar_u.id
WHERE b.status = 'ACCEPTED'
ORDER BY b."requestedAt" DESC;
"
```

#### Stage 3: REJECTED (Barber declined the booking)
```bash
# View all rejected bookings
sudo -u postgres psql -d campuscuts -c "
SELECT 
    bar_u.first_name || ' ' || bar_u.last_name AS barber,
    c.first_name || ' ' || c.last_name AS consumer,
    b.\"serviceType\" AS service,
    TO_CHAR(b."requestedAt" AT TIME ZONE 'America/Los_Angeles', 'Mon DD, YYYY') AS date,
    TO_CHAR(b."requestedAt" AT TIME ZONE 'America/Los_Angeles', 'HH12:MI AM') AS time,
    TO_CHAR(b.\"updatedAt\" AT TIME ZONE 'America/Los_Angeles', 'Mon DD HH12:MI AM') AS rejected_at
FROM bookings b
JOIN users c ON b.\"consumerId\" = c.id
LEFT JOIN users bar_u ON b.\"barberId\" = bar_u.id
WHERE b.status = 'REJECTED'
ORDER BY b.\"updatedAt\" DESC;
"
```

#### Stage 4: COMPLETED (Service finished)
```bash
# View all completed bookings
sudo -u postgres psql -d campuscuts -c "
SELECT 
    bar_u.first_name || ' ' || bar_u.last_name AS barber,
    c.first_name || ' ' || c.last_name AS consumer,
    b.\"serviceType\" AS service,
    '\$' || (b.\"priceUsdCents\" / 100.0)::numeric(10,2) AS price,
    TO_CHAR(b."requestedAt" AT TIME ZONE 'America/Los_Angeles', 'Mon DD, YYYY') AS date,
    TO_CHAR(b."requestedAt" AT TIME ZONE 'America/Los_Angeles', 'HH12:MI AM') AS time
FROM bookings b
JOIN users c ON b.\"consumerId\" = c.id
LEFT JOIN users bar_u ON b.\"barberId\" = bar_u.id
WHERE b.status = 'COMPLETED'
ORDER BY b.\"completedAt\" DESC;
"
```

#### Stage 5: CANCELLED (Booking was cancelled)
```bash
# View all cancelled bookings
sudo -u postgres psql -d campuscuts -c "
SELECT 
    bar_u.first_name || ' ' || bar_u.last_name AS barber,
    c.first_name || ' ' || c.last_name AS consumer,
    b.\"serviceType\" AS service,
    TO_CHAR(b."requestedAt" AT TIME ZONE 'America/Los_Angeles', 'Mon DD, YYYY') AS date,
    TO_CHAR(b."requestedAt" AT TIME ZONE 'America/Los_Angeles', 'HH12:MI AM') AS time,
    TO_CHAR(b.\"cancelledAt\" AT TIME ZONE 'America/Los_Angeles', 'Mon DD HH12:MI AM') AS cancelled_at
FROM bookings b
JOIN users c ON b.\"consumerId\" = c.id
LEFT JOIN users bar_u ON b.\"barberId\" = bar_u.id
WHERE b.status = 'CANCELLED'
ORDER BY b.\"cancelledAt\" DESC;
"
```

### View Booking with Linked Conversation
```bash
# See booking and its linked conversation status
sudo -u postgres psql -d campuscuts -c "
SELECT 
    b.id as booking_id,
    b.status as booking_status,
    b.\"serviceType\",
    c.id as conversation_id,
    c.booking_status as conv_status,
    c.service_name,
    c.scheduled_time
FROM bookings b
LEFT JOIN conversations c ON c.booking_id = b.id
WHERE b.id = 'BOOKING_UUID_HERE';
"
```

### Booking Status Summary
```bash
# Count bookings by status
sudo -u postgres psql -d campuscuts -c "
SELECT 
    status,
    COUNT(*) as count,
    SUM(\"priceUsdCents\") / 100.0 as total_value_usd
FROM bookings
GROUP BY status
ORDER BY count DESC;
"
```

### View Barber's Booking Pipeline
```bash
# See all booking stages for a specific barber
sudo -u postgres psql -d campuscuts -c "
SELECT 
    b.status,
    COUNT(*) as count,
    b.\"serviceType\"
FROM bookings b
JOIN users u ON b.\"barberId\" = u.id
WHERE u.email = 'barber@example.com'
GROUP BY b.status, b.\"serviceType\"
ORDER BY 
    CASE b.status 
        WHEN 'PENDING' THEN 1 
        WHEN 'ACCEPTED' THEN 2 
        WHEN 'COMPLETED' THEN 3 
        WHEN 'REJECTED' THEN 4 
        WHEN 'CANCELLED' THEN 5 
    END;
"
```

### View Bookings with User Details
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT 
    b.id,
    b.\"serviceType\",
    b.status,
    b.\"priceUsdCents\" / 100.0 as price_usd,
    u.email as consumer,
    b.\"requestedAt\"
FROM bookings b
JOIN users u ON b.\"consumerId\" = u.id
ORDER BY b.\"requestedAt\" DESC
LIMIT 20;
"
```

### Update Booking Status
```bash
sudo -u postgres psql -d campuscuts -c "UPDATE bookings SET status = 'ACCEPTED', \"acceptedAt\" = NOW() WHERE id = 'UUID_HERE';"
sudo -u postgres psql -d campuscuts -c "UPDATE bookings SET status = 'COMPLETED', \"completedAt\" = NOW() WHERE id = 'UUID_HERE';"
sudo -u postgres psql -d campuscuts -c "UPDATE bookings SET status = 'CANCELLED', \"cancelledAt\" = NOW() WHERE id = 'UUID_HERE';"
```

### Delete Booking
```bash
sudo -u postgres psql -d campuscuts -c "DELETE FROM bookings WHERE id = 'UUID_HERE';"
```

### View BookingStatus Enum Values
```bash
sudo -u postgres psql -d campuscuts -c "SELECT unnest(enum_range(NULL::\"BookingStatus\"));"
```

### Describe Bookings Table
```bash
sudo -u postgres psql -d campuscuts -c "\d bookings"
```

---

## CONVERSATIONS

### View All Conversations
```bash
sudo -u postgres psql -d campuscuts -c "SELECT id, user1_id, user2_id, service_name, booking_status, created_at, last_message_at FROM conversations ORDER BY last_message_at DESC;"
```

### View Conversations for a User
```bash
sudo -u postgres psql -d campuscuts -c "SELECT * FROM conversations WHERE user1_id = 'UUID_HERE' OR user2_id = 'UUID_HERE';"
```

### Delete Conversation
```bash
sudo -u postgres psql -d campuscuts -c "DELETE FROM conversations WHERE id = 123;"
```

### Describe Conversations Table
```bash
sudo -u postgres psql -d campuscuts -c "\d conversations"
```

---

## MESSAGES

### View Recent Messages
```bash
sudo -u postgres psql -d campuscuts -c "SELECT id, conversation_id, content, message_type, is_read, created_at FROM messages ORDER BY created_at DESC LIMIT 50;"
```

### View Messages in a Conversation
```bash
sudo -u postgres psql -d campuscuts -c "SELECT m.id, u.email as sender, m.content, m.is_read, m.created_at FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.conversation_id = 123 ORDER BY m.created_at;"
```

### Mark Messages as Read
```bash
sudo -u postgres psql -d campuscuts -c "UPDATE messages SET is_read = true WHERE conversation_id = 123;"
```

### Delete Message
```bash
sudo -u postgres psql -d campuscuts -c "DELETE FROM messages WHERE id = 123;"
```

### Describe Messages Table
```bash
sudo -u postgres psql -d campuscuts -c "\d messages"
```

---

## USER LOCATIONS

### View All Users with Location Data
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT 
    email,
    first_name,
    last_name,
    role,
    latitude,
    longitude,
    location_permission,
    location_updated_at
FROM users 
WHERE latitude IS NOT NULL 
ORDER BY location_updated_at DESC;
"
```

### View Users Grouped by Approximate Location (Summary)
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT 
    ROUND(latitude::numeric, 2) as lat_zone,
    ROUND(longitude::numeric, 2) as lng_zone,
    COUNT(*) as user_count,
    COUNT(*) FILTER (WHERE role = 'BARBER') as barber_count,
    COUNT(*) FILTER (WHERE role = 'CONSUMER') as consumer_count
FROM users
WHERE latitude IS NOT NULL
GROUP BY lat_zone, lng_zone
ORDER BY user_count DESC;
"
```

### View Users with Names/Emails Grouped by Location
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT 
    email,
    first_name,
    last_name,
    role,
    ROUND(latitude::numeric, 4) as latitude,
    ROUND(longitude::numeric, 4) as longitude,
    ROUND(latitude::numeric, 2) as location_zone
FROM users
WHERE latitude IS NOT NULL
ORDER BY ROUND(latitude::numeric, 2), ROUND(longitude::numeric, 2), email;
"
```

### View All Users in a Specific Location Zone
```bash
# Replace lat_zone and lng_zone with values from the summary query above
sudo -u postgres psql -d campuscuts -c "
SELECT 
    email,
    first_name,
    last_name,
    role,
    latitude,
    longitude
FROM users
WHERE ROUND(latitude::numeric, 2) = 35.31 
  AND ROUND(longitude::numeric, 2) = -120.66;
"
```

### View Users Who Granted Location Permission
```bash
sudo -u postgres psql -d campuscuts -c "SELECT email, first_name, last_name, role, location_permission FROM users WHERE location_permission = 'granted';"
```

### View Users Who Denied Location Permission
```bash
sudo -u postgres psql -d campuscuts -c "SELECT email, first_name, last_name, role, location_permission FROM users WHERE location_permission = 'denied';"
```

### Update User Location (Manual)
```bash
sudo -u postgres psql -d campuscuts -c "UPDATE users SET latitude = 37.2395, longitude = -121.9251, location_updated_at = NOW(), location_permission = 'granted' WHERE email = 'user@example.com';"
```

### Clear User Location
```bash
sudo -u postgres psql -d campuscuts -c "UPDATE users SET latitude = NULL, longitude = NULL, location_updated_at = NULL, location_permission = 'prompt' WHERE email = 'user@example.com';"
```

### View Barbers with Service Location Set
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT 
    u.email,
    u.first_name,
    u.last_name,
    b.service_latitude,
    b.service_longitude,
    b.service_radius_km
FROM barbers b
JOIN users u ON b.\"userId\" = u.id
WHERE b.service_latitude IS NOT NULL;
"
```

### Update Barber Service Location
```bash
sudo -u postgres psql -d campuscuts -c "
UPDATE barbers 
SET service_latitude = 37.2395, service_longitude = -121.9251, service_radius_km = 10.0
FROM users 
WHERE barbers.\"userId\" = users.id AND users.email = 'barber@example.com';
"
```

### Find Users Within X km of a Location
```bash
# Find users within 8km of coordinates (37.2395, -121.9251)
sudo -u postgres psql -d campuscuts -c "
SELECT 
    email,
    first_name,
    last_name,
    role,
    (6371 * acos(
        cos(radians(37.2395)) * 
        cos(radians(latitude)) * 
        cos(radians(longitude) - radians(-121.9251)) + 
        sin(radians(37.2395)) * 
        sin(radians(latitude))
    )) as distance_km
FROM users
WHERE latitude IS NOT NULL
HAVING distance_km <= 8
ORDER BY distance_km;
"
```

### Describe Users Table (Location Columns)
```bash
sudo -u postgres psql -d campuscuts -c "\d users" | grep -E "latitude|longitude|location"
```

---

## NOTIFICATIONS

### View User Notifications
```bash
sudo -u postgres psql -d campuscuts -c "SELECT * FROM notifications WHERE user_id = 'UUID_HERE' ORDER BY created_at DESC;"
```

### Mark Notifications as Read
```bash
sudo -u postgres psql -d campuscuts -c "UPDATE notifications SET is_read = true WHERE user_id = 'UUID_HERE';"
```

### Delete Old Notifications
```bash
sudo -u postgres psql -d campuscuts -c "DELETE FROM notifications WHERE created_at < NOW() - INTERVAL '30 days';"
```

### Describe Notifications Table
```bash
sudo -u postgres psql -d campuscuts -c "\d notifications"
```

---

## STRIPE CONNECT (Barber Payouts)

> **Note:** Stripe Connect lives on the `users` table (not `barbers`). Barbers must complete Express onboarding and have **both** `stripe_charges_enabled` and `stripe_payouts_enabled` true before payouts work.

**Production schema:** EC2 may not have every column from older migrations. Run [Describe Stripe columns](#describe-stripe-columns-on-users) first. Standard queries below use only:
- `stripe_account_id` (always)
- `stripe_charges_enabled`, `stripe_payouts_enabled` (required for Connect status — add if missing)

| Column | Meaning |
|--------|---------|
| `stripe_account_id` | Connect Express account (`acct_...`). NULL = no saved connection. |
| `stripe_charges_enabled` | Stripe says this account can accept destination charges. |
| `stripe_payouts_enabled` | Stripe says this account can receive payouts. |
| `stripe_connect_onboarded` | **Optional** — only on some DBs; webhooks may set it. Trust charges/payouts flags instead. |

**Common failure:** Stripe onboarding shows *"Something went wrong. There was an error during authentication"* while the platform still has an old `acct_*` (test mode, deleted account, or wrong platform Stripe keys). The app now auto-clears stale IDs on status/load; use the queries below to confirm and fix manually if needed.

### Troubleshooting cheat sheet

| Symptom | Likely cause | Start with |
|---------|--------------|------------|
| Stripe auth error on onboarding | Stale `acct_*` in DB | [Full Connect profile](#view-full-stripe-connect-profile-for-one-user-by-email) → [Clear stale account](#clear-stale-stripe-connect-account-manual-reset) |
| `acct_*` set but both flags `f` | Incomplete onboarding or stale account | [Suspected stale accounts](#find-suspected-stale-connect-accounts) |
| Payments fail / "No such destination" | Barber `acct_*` invalid for live keys | [Validate against server keys](#validate-connect-accounts-against-current-server-stripe-keys) |
| Capability flags missing in DB | Migration not applied on EC2 | [Add missing Stripe columns](#add-missing-stripe-columns-on-ec2) |
| Barber can't get paid | Not fully enabled | [Ready for payouts](#barbers-ready-to-receive-payouts) |
| Wrong platform (Intera vs Pismo keys) | `acct_*` from old Stripe platform account | [Pismo migration](#pismo-platforms-stripe-connect-migration-de-link-intera) |

### Pismo Platforms Stripe Connect migration (de-link Intera)

When moving from **Intera Platforms LLC** Stripe keys to **Pismo Platforms**, you cannot rename old `acct_*` IDs — clear them in Postgres, point the server at Pismo live keys, then re-onboard each provider.

**1. EC2 backend `.env` (live) — only swap Stripe platform keys**

You do **not** need new `FRONTEND_URL`, `STRIPE_CONNECT_BUSINESS_URL`, or `STRIPE_STATEMENT_DESCRIPTOR` lines unless you want to change them. Keep whatever `FRONTEND_URL` you already use for email links and Connect return URLs.

```bash
STRIPE_SECRET_KEY=sk_live_…          # Pismo Dashboard (replaces Intera platform secret)
STRIPE_WEBHOOK_SECRET=whsec_…          # Live webhook for this Stripe account
STRIPE_MODE=live
# pk_live_… in web-app env (VITE_STRIPE_PUBLISHABLE_KEY) — same Pismo account as sk_live above
```
Restart PM2 after editing.

**2. Clear test provider Connect IDs in Postgres**
```bash
sudo -u postgres psql -d campuscuts -c "
UPDATE users
SET stripe_account_id = NULL,
    stripe_charges_enabled = false,
    stripe_payouts_enabled = false
WHERE email IN ('liam.mckeown38415@gmail.com', 'calpolyblockchain@gmail.com')
RETURNING email, stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled;
"
```

**3. Or use the backend script (from repo on EC2)**
```bash
cd ~/CampusCuts/backend
npm run clear-stripe-connect -- liam.mckeown38415@gmail.com calpolyblockchain@gmail.com
# Or auto-detect IDs invalid for current keys:
npm run clear-stripe-connect -- --validate-stale
```

**4. Re-onboard** — Provider opens Stripe hub → **Continue with Stripe** (calls `POST /api/barber/connect/create` or `/connect/reset` if stale).

**5. Verify**
```bash
npm run sync-stripe-status
sudo -u postgres psql -d campuscuts -c "
SELECT email, stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled
FROM users WHERE email IN ('liam.mckeown38415@gmail.com', 'calpolyblockchain@gmail.com');
"
```

### Describe Stripe columns on users
```bash
sudo -u postgres psql -d campuscuts -c "\d users" | grep stripe
```

### Add missing Stripe columns on EC2
Run once if queries fail with `column ... does not exist` (safe to re-run — uses `IF NOT EXISTS`):
```bash
sudo -u postgres psql -d campuscuts -c "
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_account_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_charges_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_payouts_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_connect_onboarded BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_users_stripe_account_id ON users(stripe_account_id);
"
```

### View All Barbers with Stripe Connect Status
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT 
    u.email,
    u.first_name,
    u.last_name,
    b.\"isActive\",
    u.stripe_account_id,
    u.stripe_charges_enabled,
    u.stripe_payouts_enabled,
    CASE
        WHEN u.stripe_account_id IS NULL THEN 'no_account'
        WHEN u.stripe_charges_enabled AND u.stripe_payouts_enabled THEN 'live_ready'
        WHEN u.stripe_account_id IS NOT NULL THEN 'incomplete_or_stale'
        ELSE 'unknown'
    END AS connect_state
FROM barbers b
JOIN users u ON b.\"userId\" = u.id
ORDER BY connect_state, u.first_name;
"
```

### View Full Stripe Connect Profile for One User (by email)
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT
    u.id,
    u.email,
    u.first_name,
    u.last_name,
    u.role,
    u.stripe_account_id,
    u.stripe_charges_enabled,
    u.stripe_payouts_enabled,
    u.\"updatedAt\"
FROM users u
WHERE u.email = 'barber@example.com';
"
```

### View Full Stripe Connect Profile (by user UUID)
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT
    u.id,
    u.email,
    u.stripe_account_id,
    u.stripe_charges_enabled,
    u.stripe_payouts_enabled
FROM users u
WHERE u.id = 'USER_UUID_HERE';
"
```

### Check Specific Barber's Stripe Status (minimal)
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT
    stripe_account_id,
    stripe_charges_enabled,
    stripe_payouts_enabled
FROM users
WHERE email = 'barber@example.com';
"
```

### View Barbers WITHOUT Stripe Connect
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT u.email, u.first_name, u.last_name, b.\"isActive\"
FROM barbers b
JOIN users u ON b.\"userId\" = u.id
WHERE u.stripe_account_id IS NULL;
"
```

### View Barbers WITH Stripe Connect (any saved acct_*)
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT u.email, u.first_name, u.last_name, b.\"isActive\", u.stripe_account_id,
       u.stripe_charges_enabled, u.stripe_payouts_enabled
FROM barbers b
JOIN users u ON b.\"userId\" = u.id
WHERE u.stripe_account_id IS NOT NULL;
"
```

### Barbers Ready to Receive Payouts
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT u.email, u.first_name, u.last_name, u.stripe_account_id
FROM barbers b
JOIN users u ON b.\"userId\" = u.id
WHERE u.stripe_account_id IS NOT NULL
  AND u.stripe_charges_enabled = true
  AND u.stripe_payouts_enabled = true
ORDER BY u.email;
"
```

### Barbers with Saved Account but NOT Ready (incomplete or restricted)
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT u.email, u.stripe_account_id,
       u.stripe_charges_enabled, u.stripe_payouts_enabled
FROM barbers b
JOIN users u ON b.\"userId\" = u.id
WHERE u.stripe_account_id IS NOT NULL
  AND (u.stripe_charges_enabled = false OR u.stripe_payouts_enabled = false)
ORDER BY u.email;
"
```

### Find Suspected Stale Connect Accounts
Accounts saved in Postgres but both capability flags false — common when onboarding failed, test/live keys changed, or the account was deleted in Stripe.
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT u.email, u.stripe_account_id,
       u.stripe_charges_enabled, u.stripe_payouts_enabled,
       u.\"updatedAt\"
FROM barbers b
JOIN users u ON b.\"userId\" = u.id
WHERE u.stripe_account_id IS NOT NULL
  AND u.stripe_charges_enabled = false
  AND u.stripe_payouts_enabled = false
ORDER BY u.\"updatedAt\" DESC;
"
```

### Find Onboarded Flag Mismatch (only if `stripe_connect_onboarded` column exists)
Skip this query if `\d users | grep stripe_connect_onboarded` returns nothing.
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT u.email, u.stripe_account_id,
       u.stripe_connect_onboarded,
       u.stripe_charges_enabled, u.stripe_payouts_enabled
FROM users u
JOIN barbers b ON b.\"userId\" = u.id
WHERE u.stripe_connect_onboarded = true
  AND (u.stripe_charges_enabled = false OR u.stripe_payouts_enabled = false);
"
```

### Lookup User by Stripe Account ID
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT u.id, u.email, u.first_name, u.last_name,
       u.stripe_charges_enabled, u.stripe_payouts_enabled
FROM users u
WHERE u.stripe_account_id = 'acct_XXXXXXXXXXXXX';
"
```

### Find Duplicate Stripe Account IDs (should be empty — column is UNIQUE)
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT stripe_account_id, COUNT(*) AS user_count,
       array_agg(email ORDER BY email) AS emails
FROM users
WHERE stripe_account_id IS NOT NULL
GROUP BY stripe_account_id
HAVING COUNT(*) > 1;
"
```

### Count Barbers by Connect State
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT
    CASE
        WHEN u.stripe_account_id IS NULL THEN 'no_account'
        WHEN u.stripe_charges_enabled AND u.stripe_payouts_enabled THEN 'live_ready'
        ELSE 'saved_but_not_ready'
    END AS connect_state,
    COUNT(*) AS barber_count
FROM barbers b
JOIN users u ON b.\"userId\" = u.id
GROUP BY 1
ORDER BY 1;
"
```

### Validate Connect accounts against current server Stripe keys

Postgres alone **cannot** tell if an `acct_*` belongs to the platform Stripe account your server uses. You must call the Stripe API with the same secret key the backend uses (`STRIPE_SECRET_KEY`, or `STRIPE_SECRET_KEY_LIVE` / `STRIPE_SECRET_KEY_TEST` when split).

| API result | Meaning |
|------------|---------|
| HTTP **200** + account JSON | `acct_*` belongs to **this** server key's Stripe platform (valid destination). |
| **404** / `resource_missing` / `No such account` | Wrong platform, deleted account, or never connected to these keys — **stale** (clear DB + re-onboard). |
| Live/test mismatch error | Account created under `sk_test_…` but server uses `sk_live_…` (or vice versa). |

#### List all saved Connect account IDs (Postgres)
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT u.email, u.stripe_account_id, u.stripe_charges_enabled, u.stripe_payouts_enabled
FROM users u
WHERE u.stripe_account_id IS NOT NULL
ORDER BY u.email;
"
```

#### Show which Stripe key the backend is using (fingerprint only — safe to paste)
Run from the backend directory so `.env` / PM2 env loads. Does **not** print the full secret.
```bash
cd ~/CampusCuts/backend
node -e "
require('dotenv').config();
const sk =
  process.env.STRIPE_SECRET_KEY ||
  process.env.STRIPE_SECRET_KEY_LIVE ||
  process.env.STRIPE_LIVE_SECRET_KEY ||
  '';
if (!sk) { console.log('(no STRIPE_SECRET_KEY in env)'); process.exit(1); }
const kind = sk.startsWith('sk_live') ? 'live' : sk.startsWith('sk_test') ? 'test' : 'other';
console.log('Server key:', kind + ':' + sk.slice(0, 10) + '…' + sk.slice(-4));
"
```

#### Show the platform Stripe account (the Connect "parent" for this key)
```bash
cd ~/CampusCuts/backend
set -a && [ -f .env ] && . ./.env; set +a
curl -s -u "${STRIPE_SECRET_KEY}:" https://api.stripe.com/v1/account \
  | python3 -m json.tool 2>/dev/null \
  | grep -E '"id"|"display_name"|"business_profile"' | head -20
```
Connected accounts that pass validation below are owned by this platform account.

#### Validate one Connect account (curl)
Replace `acct_XXXXXXXXXXXXX` and ensure `STRIPE_SECRET_KEY` is exported (same as PM2 backend).
```bash
cd ~/CampusCuts/backend
set -a && [ -f .env ] && . ./.env; set +a

ACCT=acct_XXXXXXXXXXXXX
curl -s -w "\nHTTP %{http_code}\n" -u "${STRIPE_SECRET_KEY}:" \
  "https://api.stripe.com/v1/accounts/${ACCT}" \
  | python3 -m json.tool 2>/dev/null || true
```
- **HTTP 200** → valid for current server keys.  
- **HTTP 404** (or error message *No such account* / *does not exist*) → **stale** for this server.

#### Validate one Connect account (Stripe CLI)
```bash
cd ~/CampusCuts/backend
set -a && [ -f .env ] && . ./.env; set +a

stripe accounts retrieve acct_XXXXXXXXXXXXX --api-key "$STRIPE_SECRET_KEY"
```

#### Validate ALL saved Connect accounts (batch — recommended on EC2)
Checks every saved `stripe_account_id` against the **live** platform key. One line per user: **`t`** = connected to current live keys, **`f`** = stale / wrong platform / wrong mode.
```bash
cd ~/CampusCuts/backend
set -a && [ -f .env ] && . ./.env; set +a
LIVE_KEY="${STRIPE_SECRET_KEY_LIVE:-${STRIPE_LIVE_SECRET_KEY:-$STRIPE_SECRET_KEY}}"

echo "email|connected_to_live_keys"
sudo -u postgres psql -d campuscuts -t -A -c "
SELECT email || '|' || stripe_account_id
FROM users
WHERE stripe_account_id IS NOT NULL
ORDER BY email;
" | while IFS='|' read -r email acct; do
  [ -z "$acct" ] && continue
  http=$(curl -s -o /dev/null -w "%{http_code}" -u "${LIVE_KEY}:" \
    "https://api.stripe.com/v1/accounts/${acct}")
  if [ "$http" = "200" ]; then echo "${email}|t"; else echo "${email}|f"; fi
done
```
Clear any `|f` row using [Clear stale account](#clear-stale-stripe-connect-account-manual-reset), then have the barber use **Continue with Stripe**.

#### Validate one user by email (`t` or `f`)
```bash
cd ~/CampusCuts/backend
set -a && [ -f .env ] && . ./.env; set +a
LIVE_KEY="${STRIPE_SECRET_KEY_LIVE:-${STRIPE_LIVE_SECRET_KEY:-$STRIPE_SECRET_KEY}}"
EMAIL='barber@example.com'

ACCT=$(sudo -u postgres psql -d campuscuts -t -A -c \
  "SELECT stripe_account_id FROM users WHERE email = '${EMAIL}' LIMIT 1;")
if [ -z "$ACCT" ]; then echo "f"; exit 0; fi
http=$(curl -s -o /dev/null -w "%{http_code}" -u "${LIVE_KEY}:" \
  "https://api.stripe.com/v1/accounts/${ACCT}")
[ "$http" = "200" ] && echo "t" || echo "f"
```

#### Diagnose test Connect account on live server (example: `liam.mckeown38415@gmail.com`)

Stripe Express auth fails when Postgres still holds an `acct_*` from **test** onboarding or an **old platform** while EC2 runs **live** keys. Postgres shows the saved id and flags; use the steps below in order.

**Step 1 — Postgres: saved account and capability flags**
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT
    u.email,
    u.stripe_account_id,
    u.stripe_charges_enabled,
    u.stripe_payouts_enabled,
    CASE
        WHEN u.stripe_account_id IS NULL THEN 'no_account'
        WHEN u.stripe_charges_enabled AND u.stripe_payouts_enabled THEN 'live_ready'
        ELSE 'incomplete_or_stale'
    END AS connect_state
FROM users u
WHERE u.email = 'liam.mckeown38415@gmail.com';
"
```
Typical auth-failure pattern: `stripe_account_id` is set, both flags are **`f`**, `connect_state` = **`incomplete_or_stale`**.

**Step 2 — Postgres: barber row + saved `acct_*` (same user)**
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT u.email, u.stripe_account_id, b.\"isActive\"
FROM users u
LEFT JOIN barbers b ON b.\"userId\" = u.id
WHERE u.email ILIKE 'liam.mckeown%';
"
```

**Step 3 — Confirm valid for current live keys (`t` / `f`)**
Uses the `acct_*` from Step 1. **`f`** = not on live keys (test account, wrong platform, or deleted) → explains Stripe auth errors.
```bash
cd ~/CampusCuts/backend
set -a && [ -f .env ] && . ./.env; set +a
LIVE_KEY="${STRIPE_SECRET_KEY_LIVE:-${STRIPE_LIVE_SECRET_KEY:-$STRIPE_SECRET_KEY}}"
EMAIL='liam.mckeown38415@gmail.com'

ACCT=$(sudo -u postgres psql -d campuscuts -t -A -c \
  "SELECT stripe_account_id FROM users WHERE email = '${EMAIL}' LIMIT 1;")
if [ -z "$ACCT" ]; then echo "${EMAIL}|f (no stripe_account_id)"; exit 0; fi
http=$(curl -s -o /dev/null -w "%{http_code}" -u "${LIVE_KEY}:" \
  "https://api.stripe.com/v1/accounts/${ACCT}")
if [ "$http" = "200" ]; then echo "${EMAIL}|t"; else echo "${EMAIL}|f"; fi
```

**Step 4 — If Step 3 is `f`, check test vs live (which key owns the saved `acct_*`)**
Postgres stores the id only; this tells you if it is a **test** Connect account.
```bash
cd ~/CampusCuts/backend
set -a && [ -f .env ] && . ./.env; set +a
ACCT=$(sudo -u postgres psql -d campuscuts -t -A -c \
  "SELECT stripe_account_id FROM users WHERE email = 'liam.mckeown38415@gmail.com' LIMIT 1;")

echo "acct: ${ACCT}"
echo -n "live key: "
curl -s -o /dev/null -w "%{http_code}\n" -u "${STRIPE_SECRET_KEY_LIVE:-${STRIPE_LIVE_SECRET_KEY:-$STRIPE_SECRET_KEY}}:" \
  "https://api.stripe.com/v1/accounts/${ACCT}"
echo -n "test key: "
curl -s -o /dev/null -w "%{http_code}\n" -u "${STRIPE_SECRET_KEY_TEST:-${STRIPE_TEST_SECRET_KEY:-}}:" \
  "https://api.stripe.com/v1/accounts/${ACCT}"
```
- **live = 404, test = 200** → test Connect account on a live server (clear DB + re-onboard on live).  
- **both 404** → wrong platform or deleted in Stripe (clear DB + re-onboard).

**Step 5 — Postgres: clear stale account (then re-onboard in app)**
```bash
sudo -u postgres psql -d campuscuts -c "
UPDATE users
SET stripe_account_id = NULL,
    stripe_charges_enabled = false,
    stripe_payouts_enabled = false
WHERE email = 'liam.mckeown38415@gmail.com'
RETURNING email, stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled;
"
```
Provider should use **Continue with Stripe** on the sign-in step (not **Open Stripe tab** alone).

**Step 6 — Postgres: confirm cleared**
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT email, stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled
FROM users
WHERE email = 'liam.mckeown38415@gmail.com';
"
```
Expect `stripe_account_id` **NULL**, both flags **`f`**, until live onboarding completes.

#### Compare test vs live keys (mode mismatch)
If unsure whether an `acct_*` is test or live, try both keys (only if you have both configured):
```bash
cd ~/CampusCuts/backend
set -a && [ -f .env ] && . ./.env; set +a
ACCT=acct_XXXXXXXXXXXXX

echo "=== LIVE key ==="
curl -s -o /dev/null -w "HTTP %{http_code}\n" -u "${STRIPE_SECRET_KEY_LIVE:-$STRIPE_SECRET_KEY}:" \
  "https://api.stripe.com/v1/accounts/${ACCT}"

echo "=== TEST key ==="
curl -s -o /dev/null -w "HTTP %{http_code}\n" -u "${STRIPE_SECRET_KEY_TEST:-}:" \
  "https://api.stripe.com/v1/accounts/${ACCT}"
```
Whichever returns **200** owns that connected account. The server must use that same mode in production.

#### Sync DB flags from Stripe (valid accounts only)
After validation, refresh `stripe_charges_enabled` / `stripe_payouts_enabled` from Stripe for all saved accounts (skips invalid with a warning):
```bash
cd ~/CampusCuts/backend
npm run sync-stripe-status
```

### Clear Stale Stripe Connect Account (manual reset)
Use when Stripe onboarding auth fails and the platform still holds an invalid `acct_*`. After this, the barber should use **Continue with Stripe** in the hub (creates a fresh live account).
```bash
sudo -u postgres psql -d campuscuts -c "
UPDATE users
SET stripe_account_id = NULL,
    stripe_charges_enabled = false,
    stripe_payouts_enabled = false
WHERE email = 'barber@example.com'
RETURNING email, stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled;
"
```

If capability columns do not exist yet, clear only the account id:
```bash
sudo -u postgres psql -d campuscuts -c "
UPDATE users SET stripe_account_id = NULL WHERE email = 'barber@example.com'
RETURNING email, stripe_account_id;
"
```

### Clear Stale Connect Account (by user UUID)
```bash
sudo -u postgres psql -d campuscuts -c "
UPDATE users
SET stripe_account_id = NULL,
    stripe_charges_enabled = false,
    stripe_payouts_enabled = false
WHERE id = 'USER_UUID_HERE'
RETURNING id, email, stripe_account_id;
"
```

### Manually Set Connect Capability Flags (after confirming in Stripe Dashboard)
Only use when Stripe Dashboard shows charges/payouts enabled but Postgres is stale.
```bash
sudo -u postgres psql -d campuscuts -c "
UPDATE users
SET stripe_charges_enabled = true,
    stripe_payouts_enabled = true
WHERE email = 'barber@example.com'
RETURNING email, stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled;
"
```

### Assign Stripe Account ID Manually (rare — prefer in-app onboarding)
```bash
sudo -u postgres psql -d campuscuts -c "
UPDATE users
SET stripe_account_id = 'acct_XXXXXXXXXXXXX'
WHERE email = 'barber@example.com'
RETURNING email, stripe_account_id;
"
```

### Barber Connect + Recent Payment Activity
See whether a barber with a saved `acct_*` has successful charges.
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT
    u.email AS barber_email,
    u.stripe_account_id,
    u.stripe_charges_enabled,
    u.stripe_payouts_enabled,
    COUNT(pt.id) FILTER (WHERE pt.status = 'succeeded') AS succeeded_payments,
    COUNT(pt.id) FILTER (WHERE pt.status = 'failed') AS failed_payments,
    MAX(pt.created_at) AS last_payment_at
FROM barbers b
JOIN users u ON b.\"userId\" = u.id
LEFT JOIN payment_transactions pt ON pt.barber_id = b.id
WHERE u.email = 'barber@example.com'
GROUP BY u.email, u.stripe_account_id, u.stripe_charges_enabled, u.stripe_payouts_enabled;
"
```

### Escrows Linked to Barber Stripe Account
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT e.id, e.booking_id, e.status, e.stripe_payment_intent_id,
       e.stripe_transfer_id, u.email AS barber_email, u.stripe_account_id
FROM escrows e
JOIN bookings bk ON e.booking_id = bk.id
JOIN barbers b ON bk.\"barberId\" = b.id
JOIN users u ON b.\"userId\" = u.id
WHERE u.email = 'barber@example.com'
ORDER BY e.created_at DESC
LIMIT 20;
"
```

---

## BARBER AVAILABILITY (Weekly Schedule)

> **Note:** The `weeklySchedule` column is stored as JSONB in the `barbers` table. Each day has `enabled`, `start`, `end`, and optionally `intervals` for multi-slot schedules.

### View All Barbers' Availability Settings
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT 
    u.first_name,
    u.last_name,
    u.email,
    b.\"weeklySchedule\"
FROM barbers b
JOIN users u ON b.\"userId\" = u.id
ORDER BY u.first_name;
"
```

### View Barbers' Availability (Pretty Printed)
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT 
    u.first_name || ' ' || u.last_name AS barber_name,
    jsonb_pretty(b.\"weeklySchedule\") AS schedule
FROM barbers b
JOIN users u ON b.\"userId\" = u.id
ORDER BY u.first_name;
"
```

### View Specific Barber's Availability by Email
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT jsonb_pretty(b.\"weeklySchedule\") AS schedule
FROM barbers b
JOIN users u ON b.\"userId\" = u.id
WHERE u.email = 'barber@example.com';
"
```

### View Barbers WITH Availability Configured (At Least One Day Enabled)
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT 
    u.first_name,
    u.last_name,
    u.email
FROM barbers b
JOIN users u ON b.\"userId\" = u.id
WHERE b.\"weeklySchedule\" IS NOT NULL
  AND (
    (b.\"weeklySchedule\"->>'monday')::jsonb->>'enabled' = 'true' OR
    (b.\"weeklySchedule\"->>'tuesday')::jsonb->>'enabled' = 'true' OR
    (b.\"weeklySchedule\"->>'wednesday')::jsonb->>'enabled' = 'true' OR
    (b.\"weeklySchedule\"->>'thursday')::jsonb->>'enabled' = 'true' OR
    (b.\"weeklySchedule\"->>'friday')::jsonb->>'enabled' = 'true' OR
    (b.\"weeklySchedule\"->>'saturday')::jsonb->>'enabled' = 'true' OR
    (b.\"weeklySchedule\"->>'sunday')::jsonb->>'enabled' = 'true'
  );
"
```

### View Barbers WITHOUT Availability (No Days Enabled or NULL Schedule)
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT 
    u.first_name,
    u.last_name,
    u.email
FROM barbers b
JOIN users u ON b.\"userId\" = u.id
WHERE b.\"weeklySchedule\" IS NULL
   OR NOT (
    (b.\"weeklySchedule\"->>'monday')::jsonb->>'enabled' = 'true' OR
    (b.\"weeklySchedule\"->>'tuesday')::jsonb->>'enabled' = 'true' OR
    (b.\"weeklySchedule\"->>'wednesday')::jsonb->>'enabled' = 'true' OR
    (b.\"weeklySchedule\"->>'thursday')::jsonb->>'enabled' = 'true' OR
    (b.\"weeklySchedule\"->>'friday')::jsonb->>'enabled' = 'true' OR
    (b.\"weeklySchedule\"->>'saturday')::jsonb->>'enabled' = 'true' OR
    (b.\"weeklySchedule\"->>'sunday')::jsonb->>'enabled' = 'true'
  );
"
```

### View Monday Availability for All Barbers
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT 
    u.first_name || ' ' || u.last_name AS barber_name,
    b.\"weeklySchedule\"->'monday'->>'enabled' AS monday_enabled,
    b.\"weeklySchedule\"->'monday'->>'start' AS monday_start,
    b.\"weeklySchedule\"->'monday'->>'end' AS monday_end
FROM barbers b
JOIN users u ON b.\"userId\" = u.id
ORDER BY u.first_name;
"
```

---

## PAYMENTS (Stripe Off-Chain)

> **Note:** CampusCuts uses Stripe for all payments. Blockchain payment columns are deprecated.

### View All Payment Transactions (Stripe)
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT 
    pt.id,
    pt.stripe_payment_intent_id,
    pt.stripe_transfer_id,
    u_c.email AS consumer_email,
    u_b.email AS barber_email,
    pt.amount,
    pt.platform_fee,
    pt.barber_payout,
    pt.tip_amount,
    pt.status,
    pt.created_at
FROM payment_transactions pt
LEFT JOIN users u_c ON pt.client_id = u_c.id
LEFT JOIN barbers b ON pt.barber_id = b.id
LEFT JOIN users u_b ON b.\"userId\" = u_b.id
ORDER BY pt.created_at DESC 
LIMIT 20;
"
```

### View Transactions by Status
```bash
# Succeeded transactions
sudo -u postgres psql -d campuscuts -c "SELECT * FROM payment_transactions WHERE status = 'succeeded' ORDER BY created_at DESC;"

# Pending transactions
sudo -u postgres psql -d campuscuts -c "SELECT * FROM payment_transactions WHERE status = 'pending' ORDER BY created_at DESC;"

# Failed transactions
sudo -u postgres psql -d campuscuts -c "SELECT * FROM payment_transactions WHERE status = 'failed' ORDER BY created_at DESC;"
```

### View Payment Summary
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT 
    status,
    COUNT(*) as count,
    SUM(amount) as total_amount,
    SUM(platform_fee) as total_fees,
    SUM(barber_payout) as total_payouts
FROM payment_transactions 
GROUP BY status;
"
```

### View Barber Earnings
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT 
    u.email AS barber_email,
    u.first_name,
    u.last_name,
    SUM(pt.barber_payout) AS total_earned,
    SUM(pt.tip_amount) AS total_tips,
    COUNT(*) AS transaction_count
FROM payment_transactions pt
JOIN barbers b ON pt.barber_id = b.id
JOIN users u ON b.\"userId\" = u.id
WHERE pt.status = 'succeeded'
GROUP BY u.email, u.first_name, u.last_name
ORDER BY total_earned DESC;
"
```

### Describe Payment Transactions Table
```bash
sudo -u postgres psql -d campuscuts -c "\d payment_transactions"
```

### Lookup Payment by Stripe PaymentIntent ID
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT pt.*, u_c.email AS consumer_email, u_b.email AS barber_email, u_b.stripe_account_id
FROM payment_transactions pt
LEFT JOIN users u_c ON pt.client_id = u_c.id
LEFT JOIN barbers b ON pt.barber_id = b.id
LEFT JOIN users u_b ON b.\"userId\" = u_b.id
WHERE pt.stripe_payment_intent_id = 'pi_XXXXXXXXXXXXX';
"
```

### Failed Payments with Barber Connect Context
Useful when debugging "No such destination" or restricted Connect accounts.
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT pt.stripe_payment_intent_id, pt.status, pt.amount, pt.created_at,
       u_b.email AS barber_email, u_b.stripe_account_id,
       u_b.stripe_charges_enabled, u_b.stripe_payouts_enabled
FROM payment_transactions pt
JOIN barbers b ON pt.barber_id = b.id
JOIN users u_b ON b.\"userId\" = u_b.id
WHERE pt.status = 'failed'
ORDER BY pt.created_at DESC
LIMIT 25;
"
```

### Payments Table (alternate audit trail) by PaymentIntent
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT id, booking_id, payment_intent_id, status, failure_reason, amount_cents, created_at
FROM payments
WHERE payment_intent_id = 'pi_XXXXXXXXXXXXX';
"
```

---

## ESCROWS (Stripe PaymentIntent Holds)

### View All Escrows
```bash
sudo -u postgres psql -d campuscuts -c "SELECT * FROM escrows ORDER BY created_at DESC LIMIT 20;"
```

### View Active (Held) Escrows
```bash
sudo -u postgres psql -d campuscuts -c "SELECT * FROM escrows WHERE status = 'held' ORDER BY created_at DESC;"
```

### View Escrow by Booking
```bash
sudo -u postgres psql -d campuscuts -c "SELECT * FROM escrows WHERE booking_id = 'BOOKING_ID_HERE';"
```

### Describe Escrows Table
```bash
sudo -u postgres psql -d campuscuts -c "\d escrows"
```

---

## LEDGER ENTRIES

### View User Ledger
```bash
sudo -u postgres psql -d campuscuts -c "SELECT * FROM ledger_entries WHERE user_id = 'UUID_HERE' ORDER BY created_at DESC;"
```

### View Recent Ledger Entries
```bash
sudo -u postgres psql -d campuscuts -c "SELECT * FROM ledger_entries ORDER BY created_at DESC LIMIT 50;"
```

### Describe Ledger Entries Table
```bash
sudo -u postgres psql -d campuscuts -c "\d ledger_entries"
```

---

## WITHDRAWAL REQUESTS

### View All Withdrawals
```bash
sudo -u postgres psql -d campuscuts -c "SELECT * FROM withdrawal_requests ORDER BY requested_at DESC;"
```

### View Pending Withdrawals
```bash
sudo -u postgres psql -d campuscuts -c "SELECT * FROM withdrawal_requests WHERE status = 'pending';"
```

### Update Withdrawal Status
```bash
sudo -u postgres psql -d campuscuts -c "UPDATE withdrawal_requests SET status = 'completed', completed_at = NOW() WHERE id = 'UUID_HERE';"
```

### Describe Withdrawal Requests Table
```bash
sudo -u postgres psql -d campuscuts -c "\d withdrawal_requests"
```

---

## ANALYTICS EVENTS

### View Recent Events
```bash
sudo -u postgres psql -d campuscuts -c "SELECT event_type, COUNT(*) FROM analytics_events WHERE timestamp > NOW() - INTERVAL '7 days' GROUP BY event_type ORDER BY COUNT(*) DESC;"
```

### View User Activity
```bash
sudo -u postgres psql -d campuscuts -c "SELECT * FROM analytics_events WHERE user_id = 'UUID_HERE' ORDER BY timestamp DESC LIMIT 50;"
```

### Describe Analytics Events Table
```bash
sudo -u postgres psql -d campuscuts -c "\d analytics_events"
```

---

## REFERRALS

### View All Referrals
```bash
sudo -u postgres psql -d campuscuts -c "SELECT * FROM referrals;"
```

### Describe Referrals Table
```bash
sudo -u postgres psql -d campuscuts -c "\d referrals"
```

---

## STRIPE EVENTS (Webhook Logs)

> **`stripe_events`** — rich payment monitoring feed (amounts, booking emails, raw JSON).  
> **`stripe_webhook_events`** — idempotency log (event processed or failed).

### View Recent Stripe Events
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT 
    event_id,
    event_type,
    payment_intent_id,
    amount_usd,
    status,
    student_email,
    barber_email,
    timestamp
FROM stripe_events 
ORDER BY timestamp DESC 
LIMIT 20;
"
```

### View Stripe Connect / Account Webhook Events
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT event_id, event_type, barber_email, status, timestamp
FROM stripe_events
WHERE event_type LIKE 'account.%'
   OR event_type IN ('capability.updated', 'person.updated')
ORDER BY timestamp DESC
LIMIT 30;
"
```

### View Stripe Events for One Barber (by email)
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT event_id, event_type, payment_intent_id, amount_usd, status, timestamp
FROM stripe_events
WHERE barber_email = 'barber@example.com'
ORDER BY timestamp DESC
LIMIT 30;
"
```

### View Stripe Events for One PaymentIntent
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT event_id, event_type, status, amount_usd, barber_email, student_email, timestamp
FROM stripe_events
WHERE payment_intent_id = 'pi_XXXXXXXXXXXXX'
ORDER BY timestamp ASC;
"
```

### View Failed Stripe Webhook Processing
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT event_id, event_type, processing_result, processed_at
FROM stripe_webhook_events
WHERE processing_result = 'failed'
ORDER BY processed_at DESC
LIMIT 30;
"
```

### View Recent Stripe Webhook Events (idempotency table)
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT event_id, event_type, processing_result, processed_at
FROM stripe_webhook_events
ORDER BY processed_at DESC
LIMIT 30;
"
```

### Describe Stripe Webhook Events Table
```bash
sudo -u postgres psql -d campuscuts -c "\d stripe_webhook_events"
```

### View Stripe Events by Type
```bash
# Payment succeeded events
sudo -u postgres psql -d campuscuts -c "SELECT * FROM stripe_events WHERE event_type = 'payment_intent.succeeded' ORDER BY timestamp DESC LIMIT 10;"

# Payment failed events
sudo -u postgres psql -d campuscuts -c "SELECT * FROM stripe_events WHERE event_type = 'payment_intent.payment_failed' ORDER BY timestamp DESC LIMIT 10;"

# Payout events
sudo -u postgres psql -d campuscuts -c "SELECT * FROM stripe_events WHERE event_type LIKE 'payout.%' ORDER BY timestamp DESC LIMIT 10;"

# Connect account updated (onboarding progress)
sudo -u postgres psql -d campuscuts -c "SELECT * FROM stripe_events WHERE event_type = 'account.updated' ORDER BY timestamp DESC LIMIT 10;"
```

### View Stripe Event Summary
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT 
    event_type,
    COUNT(*) as count,
    SUM(amount_usd) as total_amount
FROM stripe_events 
WHERE timestamp > NOW() - INTERVAL '30 days'
GROUP BY event_type
ORDER BY count DESC;
"
```

### Describe Stripe Events Table
```bash
sudo -u postgres psql -d campuscuts -c "\d stripe_events"
```

---

## UTILITY COMMANDS

### List All Tables
```bash
sudo -u postgres psql -d campuscuts -c "\dt"
```

### Describe Any Table
```bash
sudo -u postgres psql -d campuscuts -c "\d TABLE_NAME"
```

### Count Rows in All Key Tables
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT 'users' as table_name, COUNT(*) FROM users
UNION ALL SELECT 'barbers', COUNT(*) FROM barbers
UNION ALL SELECT 'barber_applications', COUNT(*) FROM barber_applications
UNION ALL SELECT 'bookings', COUNT(*) FROM bookings
UNION ALL SELECT 'conversations', COUNT(*) FROM conversations
UNION ALL SELECT 'messages', COUNT(*) FROM messages
UNION ALL SELECT 'campuses', COUNT(*) FROM campuses;
"
```

### Check Database Size
```bash
sudo -u postgres psql -d campuscuts -c "SELECT pg_size_pretty(pg_database_size('campuscuts'));"
```

### Check Table Sizes
```bash
sudo -u postgres psql -d campuscuts -c "SELECT relname as table, pg_size_pretty(pg_total_relation_size(relid)) as size FROM pg_catalog.pg_statio_user_tables ORDER BY pg_total_relation_size(relid) DESC;"
```

### View UserRole Enum Values
```bash
sudo -u postgres psql -d campuscuts -c "SELECT unnest(enum_range(NULL::\"UserRole\"));"
```

---

## BACKUP & RESTORE

### Full Backup
```bash
sudo -u postgres pg_dump campuscuts > ~/campuscuts_backup_$(date +%Y%m%d_%H%M%S).sql
```

### Backup Specific Table
```bash
sudo -u postgres pg_dump -t users campuscuts > ~/users_backup.sql
sudo -u postgres pg_dump -t barbers campuscuts > ~/barbers_backup.sql
```

### Restore from Backup
```bash
sudo -u postgres psql -d campuscuts < ~/campuscuts_backup.sql
```

---

## DANGEROUS COMMANDS (USE WITH CAUTION)

### Delete All Data from Table (Keep Structure)
```bash
sudo -u postgres psql -d campuscuts -c "TRUNCATE TABLE messages CASCADE;"
sudo -u postgres psql -d campuscuts -c "TRUNCATE TABLE conversations CASCADE;"
```

### Drop Table Completely
```bash
sudo -u postgres psql -d campuscuts -c "DROP TABLE IF EXISTS table_name CASCADE;"
```

### Reset Auto-Increment Sequence
```bash
sudo -u postgres psql -d campuscuts -c "ALTER SEQUENCE conversations_id_seq RESTART WITH 1;"
sudo -u postgres psql -d campuscuts -c "ALTER SEQUENCE messages_id_seq RESTART WITH 1;"
```

---

## SERVICE TYPES (ENUM)

### View All ServiceType Enum Values
```bash
sudo -u postgres psql -d campuscuts -c "SELECT unnest(enum_range(NULL::\"ServiceType\"));"
```

### Add New ServiceType to Enum
```bash
# Example: Add TAPER to ServiceType enum
sudo -u postgres psql -d campuscuts -c "ALTER TYPE \"ServiceType\" ADD VALUE IF NOT EXISTS 'TAPER';"
```

---

## BARBER DISCOVERY & VISIBILITY

### Check Why a Barber Isn't Showing to Consumers
```bash
# Check barber record status (isActive, isOnboarded, campusId)
sudo -u postgres psql -d campuscuts -c "
SELECT 
    u.email,
    u.first_name,
    u.last_name,
    u.role,
    u.\"campusId\" as user_campus_id,
    b.id as barber_id,
    b.\"isActive\",
    b.\"isOnboarded\",
    b.\"campusId\" as barber_campus_id
FROM users u
LEFT JOIN barbers b ON u.id = b.\"userId\"
WHERE u.email = 'barber@example.com';
"
```

### View All Active Barbers with Campus Info
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT 
    u.email,
    u.first_name,
    u.last_name,
    b.\"isActive\",
    b.\"campusId\",
    c.name as campus_name
FROM barbers b
JOIN users u ON b.\"userId\" = u.id
LEFT JOIN campuses c ON b.\"campusId\" = c.id
WHERE b.\"isActive\" = true;
"
```

### View Barbers by Campus
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT 
    u.email,
    u.first_name,
    u.last_name,
    b.\"isActive\",
    b.\"isOnboarded\"
FROM barbers b
JOIN users u ON b.\"userId\" = u.id
WHERE b.\"campusId\" = 'CAMPUS_UUID_HERE';
"
```

### Activate a Barber Profile
```bash
sudo -u postgres psql -d campuscuts -c "
UPDATE barbers SET \"isActive\" = true 
WHERE \"userId\" = (SELECT id FROM users WHERE email = 'barber@example.com');
"
```

---

## BARBER & USER LOCATIONS

### View All Barbers with Location Data
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT 
    u.email,
    u.first_name,
    u.latitude,
    u.longitude,
    b.service_latitude,
    b.service_longitude,
    u.location_updated_at
FROM barbers b
JOIN users u ON b.\"userId\" = u.id
WHERE b.\"isActive\" = true;
"
```

### Check Location Auto-Update Status for Barbers
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT 
    email, 
    first_name,
    last_name,
    latitude, 
    longitude, 
    location_permission,
    location_updated_at 
FROM users 
WHERE role IN ('BARBER', 'CAMPUS_MANAGER')
ORDER BY location_updated_at DESC NULLS LAST;
"
```

### Manually Update Barber's Location (When GPS Not Working)
```bash
# Set to specific coordinates (e.g., Cal Poly SLO)
sudo -u postgres psql -d campuscuts -c "
UPDATE users 
SET latitude = 35.30500000, 
    longitude = -120.66250000,
    location_updated_at = NOW(),
    location_permission = 'granted'
WHERE email = 'barber@example.com';
"
```

### Find Barbers Within Distance of Coordinates
```bash
# Find barbers within 8km of Cal Poly SLO (35.3050, -120.6625)
sudo -u postgres psql -d campuscuts -c "
SELECT 
    u.email,
    u.first_name,
    u.last_name,
    u.latitude,
    u.longitude,
    ROUND((
        6371 * acos(
            LEAST(1.0, GREATEST(-1.0,
                cos(radians(35.3050)) * 
                cos(radians(u.latitude)) * 
                cos(radians(u.longitude) - radians(-120.6625)) + 
                sin(radians(35.3050)) * 
                sin(radians(u.latitude))
            ))
        )
    )::numeric, 2) as distance_km
FROM barbers b
JOIN users u ON b.\"userId\" = u.id
WHERE b.\"isActive\" = true
  AND u.latitude IS NOT NULL
ORDER BY distance_km;
"
```

---

## PENDING REGISTRATIONS

The `pending_registrations` table stores user registration data while awaiting email verification.
This table is auto-created by the verification service on startup.

### View Pending Registrations
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT email, first_name, last_name, role, expires_at, created_at
FROM pending_registrations
ORDER BY created_at DESC;
"
```

### Delete Expired Pending Registrations
```bash
sudo -u postgres psql -d campuscuts -c "DELETE FROM pending_registrations WHERE expires_at < NOW();"
```

### Clear All Pending Registrations (Testing Only)
```bash
sudo -u postgres psql -d campuscuts -c "DELETE FROM pending_registrations;"
```

### Create Table Manually (if not auto-created)
```bash
sudo -u postgres psql -d campuscuts -c "
CREATE TABLE IF NOT EXISTS pending_registrations (
  email VARCHAR(255) PRIMARY KEY,
  password_hash TEXT NOT NULL,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  campus_id UUID,
  role VARCHAR(50) NOT NULL,
  verification_code VARCHAR(6) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"
```

---

## SERVICE LOCATIONS (Barber-defined and Campus Manager curated)

This system allows barbers to request new service locations, which campus managers approve/reject.
Campus managers can also create locations directly. Locations can be **universal** (all barbers) or **barber-specific**.

### Create Service Locations Tables (Run this once)
```bash
sudo -u postgres psql -d campuscuts -c "
-- New table for service locations with approval workflow
CREATE TABLE IF NOT EXISTS service_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_id UUID NOT NULL REFERENCES campuses(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  status VARCHAR(20) DEFAULT 'approved',  -- 'pending', 'approved', 'rejected'
  is_universal BOOLEAN DEFAULT true,       -- true = all barbers, false = specific barber
  restricted_to_barber_id UUID REFERENCES barbers(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id),    -- who requested/created it
  reviewed_by UUID REFERENCES users(id),   -- campus manager who approved/rejected
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(campus_id, name)
);

-- Barber assignments to service locations (which barbers use which locations)
CREATE TABLE IF NOT EXISTS barber_service_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id UUID NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES service_locations(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(barber_id, location_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_service_locations_campus ON service_locations(campus_id);
CREATE INDEX IF NOT EXISTS idx_service_locations_status ON service_locations(campus_id, status);
CREATE INDEX IF NOT EXISTS idx_service_locations_active ON service_locations(campus_id, is_active);
CREATE INDEX IF NOT EXISTS idx_barber_service_locations_barber ON barber_service_locations(barber_id);
CREATE INDEX IF NOT EXISTS idx_barber_service_locations_location ON barber_service_locations(location_id);
"
```

### Add Approval Workflow Columns (Migration for existing tables)
If the `service_locations` table already exists without the approval columns:
```bash
sudo -u postgres psql -d campuscuts -c "
ALTER TABLE service_locations ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'approved';
ALTER TABLE service_locations ADD COLUMN IF NOT EXISTS is_universal BOOLEAN DEFAULT true;
ALTER TABLE service_locations ADD COLUMN IF NOT EXISTS restricted_to_barber_id UUID REFERENCES barbers(id) ON DELETE SET NULL;
ALTER TABLE service_locations ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id);
ALTER TABLE service_locations ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE;
CREATE INDEX IF NOT EXISTS idx_service_locations_status ON service_locations(campus_id, status);
"
```

### View All Service Locations
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT 
    sl.id,
    sl.name,
    sl.description,
    sl.status,
    CASE WHEN sl.is_universal THEN 'All Barbers' ELSE 'Specific' END as availability,
    c.name as campus_name,
    sl.is_active,
    u.first_name || ' ' || u.last_name as created_by
FROM service_locations sl
JOIN campuses c ON sl.campus_id = c.id
LEFT JOIN users u ON sl.created_by = u.id
ORDER BY c.name, sl.status, sl.name;
"
```

### View Pending Location Requests
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT 
    sl.id,
    sl.name,
    sl.description,
    c.name as campus_name,
    u.first_name || ' ' || u.last_name as requested_by,
    u.email as requester_email,
    sl.created_at
FROM service_locations sl
JOIN campuses c ON sl.campus_id = c.id
LEFT JOIN users u ON sl.created_by = u.id
WHERE sl.status = 'pending'
ORDER BY sl.created_at DESC;
"
```

### View Barber Location Assignments
```bash
sudo -u postgres psql -d campuscuts -c "
SELECT 
    bsl.id as assignment_id,
    u.first_name || ' ' || u.last_name as barber_name,
    sl.name as location_name,
    bsl.is_primary,
    sl.is_universal
FROM barber_service_locations bsl
JOIN barbers b ON bsl.barber_id = b.id
JOIN users u ON b.\"userId\" = u.id
JOIN service_locations sl ON bsl.location_id = sl.id
WHERE sl.status = 'approved'
ORDER BY barber_name, bsl.is_primary DESC, location_name;
"
```

### Approve a Pending Location Request (Example)
```bash
# Replace LOCATION_ID and REVIEWER_USER_ID with actual UUIDs
sudo -u postgres psql -d campuscuts -c "
UPDATE service_locations 
SET status = 'approved', 
    is_universal = true, 
    reviewed_by = 'REVIEWER_USER_ID', 
    reviewed_at = NOW() 
WHERE id = 'LOCATION_ID';
"
```

---

## PENDING MIGRATIONS

### Add paymentRequestedAt column to bookings (Required for payment flow)
```bash
sudo -u postgres psql -d campuscuts -c 'ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "paymentRequestedAt" TIMESTAMPTZ;'
```

### Add TAPER to ServiceType enum (Required for Taper service bookings)
```bash
sudo -u postgres psql -d campuscuts -c "ALTER TYPE \"ServiceType\" ADD VALUE IF NOT EXISTS 'TAPER';"
```

---
