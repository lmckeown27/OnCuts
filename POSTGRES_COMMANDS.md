# CampusCuts PostgreSQL Commands Reference

Quick reference for accessing and managing all database tables.

---

## Connect to Database

```bash
sudo -u postgres psql -d campuscuts
```

---

## USERS

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
sudo -u postgres psql -d campuscuts -c "SELECT id, email, first_name, last_name, \"displayName\", role, email_verified, \"isVerified\", \"avatarUrl\", \"instagramHandle\", \"createdAt\" FROM users WHERE email = 'user@example.com';"
```

### Update User Role
```bash
# Make user a BARBER
sudo -u postgres psql -d campuscuts -c "UPDATE users SET role = 'BARBER' WHERE email = 'user@example.com';"

# Make user a CAMPUS_MANAGER
sudo -u postgres psql -d campuscuts -c "UPDATE users SET role = 'CAMPUS_MANAGER' WHERE email = 'user@example.com';"

# Make user a CONSUMER
sudo -u postgres psql -d campuscuts -c "UPDATE users SET role = 'CONSUMER' WHERE email = 'user@example.com';"

# Make user an ADMIN
sudo -u postgres psql -d campuscuts -c "UPDATE users SET role = 'ADMIN' WHERE email = 'user@example.com';"
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

### Delete User
```bash
sudo -u postgres psql -d campuscuts -c "DELETE FROM users WHERE email = 'user@example.com';"
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

## BARBERS

### View All Barbers
```bash
sudo -u postgres psql -d campuscuts -c "SELECT b.id, u.email, u.first_name, u.last_name, b.bio, b.\"averageRating\", b.\"isActive\" FROM barbers b JOIN users u ON b.\"userId\" = u.id;"
```

### View Specific Barber by Email
```bash
sudo -u postgres psql -d campuscuts -c "SELECT b.* FROM barbers b JOIN users u ON b.\"userId\" = u.id WHERE u.email = 'barber@example.com';"
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

### View All Applications
```bash
sudo -u postgres psql -d campuscuts -c "SELECT ba.id, u.email, u.first_name, ba.status, ba.years_experience, ba.created_at FROM barber_applications ba JOIN users u ON ba.user_id = u.id ORDER BY ba.created_at DESC;"
```

### View Pending Applications
```bash
sudo -u postgres psql -d campuscuts -c "SELECT ba.*, u.email FROM barber_applications ba JOIN users u ON ba.user_id = u.id WHERE ba.status = 'pending';"
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

### Describe Barber Applications Table
```bash
sudo -u postgres psql -d campuscuts -c "\d barber_applications"
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
    b.id,
    b.\"serviceType\",
    b.\"priceUsdCents\" / 100.0 as price_usd,
    c.email as consumer_email,
    c.first_name as consumer_name,
    bar_u.email as barber_email,
    b.\"requestedAt\",
    b.notes
FROM bookings b
JOIN users c ON b.\"consumerId\" = c.id
LEFT JOIN users bar_u ON b.\"barberId\" = bar_u.id
WHERE b.status = 'PENDING'
ORDER BY b.\"requestedAt\" DESC;
"
```

#### Stage 2: ACCEPTED (Barber accepted the booking)
```bash
# View all accepted bookings awaiting service
sudo -u postgres psql -d campuscuts -c "
SELECT 
    b.id,
    b.\"serviceType\",
    b.\"priceUsdCents\" / 100.0 as price_usd,
    c.email as consumer_email,
    bar_u.email as barber_email,
    b.\"requestedAt\",
    b.\"acceptedAt\"
FROM bookings b
JOIN users c ON b.\"consumerId\" = c.id
LEFT JOIN users bar_u ON b.\"barberId\" = bar_u.id
WHERE b.status = 'ACCEPTED'
ORDER BY b.\"acceptedAt\" DESC;
"
```

#### Stage 3: REJECTED (Barber declined the booking)
```bash
# View all rejected bookings
sudo -u postgres psql -d campuscuts -c "
SELECT 
    b.id,
    b.\"serviceType\",
    c.email as consumer_email,
    bar_u.email as barber_email,
    b.\"requestedAt\",
    b.\"updatedAt\" as rejected_at
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
    b.id,
    b.\"serviceType\",
    b.\"priceUsdCents\" / 100.0 as price_usd,
    c.email as consumer_email,
    bar_u.email as barber_email,
    b.\"requestedAt\",
    b.\"completedAt\"
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
    b.id,
    b.\"serviceType\",
    c.email as consumer_email,
    bar_u.email as barber_email,
    b.\"requestedAt\",
    b.\"cancelledAt\"
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

### View Stripe Events by Type
```bash
# Payment succeeded events
sudo -u postgres psql -d campuscuts -c "SELECT * FROM stripe_events WHERE event_type = 'payment_intent.succeeded' ORDER BY timestamp DESC LIMIT 10;"

# Payment failed events
sudo -u postgres psql -d campuscuts -c "SELECT * FROM stripe_events WHERE event_type = 'payment_intent.payment_failed' ORDER BY timestamp DESC LIMIT 10;"

# Payout events
sudo -u postgres psql -d campuscuts -c "SELECT * FROM stripe_events WHERE event_type LIKE 'payout.%' ORDER BY timestamp DESC LIMIT 10;"
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

## PENDING MIGRATIONS

### Add paymentRequestedAt column to bookings (Required for payment flow)
```bash
sudo -u postgres psql -d campuscuts -c 'ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "paymentRequestedAt" TIMESTAMPTZ;'
```

---
