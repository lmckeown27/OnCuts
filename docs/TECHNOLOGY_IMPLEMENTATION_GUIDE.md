# CampusKinect Technology Implementation Guide

## 🎯 Implementation Summary

This guide documents the **essential technologies** transferred from CampusKinect to CampusCuts. All implementations are **necessary** for the MVP to function according to specifications.

---

## ✅ Implemented Technologies

### **1. iOS Keychain Manager** ✅

**Location:** `ios-app/CampusCuts/Services/KeychainManager.swift`

**Purpose:** Secure storage for JWT tokens and sensitive data

**Features:**
- ✅ Access token storage (replaces UserDefaults)
- ✅ Refresh token storage
- ✅ User ID persistence
- ✅ User type (student/barber) storage
- ✅ Biometric authentication toggle
- ✅ Secure iOS Keychain API usage
- ✅ Batch token clearing on logout

**Integration:**
- `NetworkManager` now uses `KeychainManager` for token retrieval
- More secure than UserDefaults for sensitive data
- Follows iOS security best practices

---

### **2. iOS Push Notification Manager** ✅

**Location:** `ios-app/CampusCuts/Services/PushNotificationManager.swift`

**Purpose:** Handle push notifications for bookings, messages, and reminders

**Features:**
- ✅ Permission request and management
- ✅ Device token registration
- ✅ Notification handling by type (booking, message, reminder, payment, review, system)
- ✅ Badge count management
- ✅ Interactive notification categories
- ✅ iOS 16+ API support with fallback

**Notification Types:**
- `booking_confirmation` - Booking confirmed by barber
- `booking_reminder` - Appointment reminder (1-2 hours before)
- `message` - New chat message
- `payment_received` - Payment received (for barbers)
- `review` - New review received (for barbers)
- `system` - System announcements

---

### **3. Backend: Redis Configuration** ✅

**Location:** `backend/src/config/redis.ts`

**Purpose:** Caching, session management, and performance optimization

**Features:**
- ✅ Connection management with auto-reconnect
- ✅ Cache helper functions (get, set, delete, exists, incr, expire)
- ✅ Cache key generation utilities
- ✅ TTL configuration by data type
- ✅ Graceful degradation if Redis unavailable
- ✅ Production vs development handling

**Cache TTLs:**
- User data: 1 hour
- Barber profiles: 30 minutes
- Bookings: 15 minutes
- Campus data: 24 hours
- Sessions: 2 hours
- Search results: 10 minutes

---

### **4. Backend: Email Service** ✅

**Location:** `backend/src/services/email.service.ts`

**Purpose:** Send transactional emails for verification and bookings

**Features:**
- ✅ .edu email verification emails
- ✅ Booking confirmation emails
- ✅ Appointment reminder emails
- ✅ Password reset emails
- ✅ Verification code emails (6-digit)
- ✅ Generic notification emails
- ✅ Beautiful HTML templates with CampusCuts branding
- ✅ Gmail SMTP integration
- ✅ Email service health check

**Email Types:**
- Verification email with token link
- Booking confirmation with appointment details
- Appointment reminders (1-2 hours before)
- Password reset with secure token
- Verification codes for alternative flow

---

### **5. Backend: Image Processing Service** ✅

**Location:** `backend/src/services/image.service.ts`

**Purpose:** Process and optimize barber portfolio and profile images

**Features:**
- ✅ Sharp library integration for high-performance processing
- ✅ Automatic resizing with aspect ratio maintenance
- ✅ Thumbnail generation (300x300 for quick loading)
- ✅ Multiple format support (JPEG, PNG, WebP)
- ✅ Progressive JPEG for better loading
- ✅ Image validation (dimensions, file size)
- ✅ Orphaned image cleanup (24h old files)
- ✅ Multer integration for multipart uploads

**Image Specs:**
- **Portfolio images:** 1200x1200px, 90% quality
- **Profile pictures:** 600x600px, 85% quality
- **Chat images:** 800x800px, 80% quality
- **Thumbnails:** 300x300px, 70% quality
- **Max file size:** 10MB per image

---

### **6. Backend: Educational Domain Validation** ✅

**Location:** `backend/src/services/educationalDomain.service.ts`

**Purpose:** Validate .edu and international educational email domains

**Features:**
- ✅ Multi-country support (US, UK, Canada, Australia, Germany, France)
- ✅ Three-tier validation:
  1. Database check for known universities
  2. External API validation (optional)
  3. Pattern-based fallback
- ✅ Auto-discovery and database insertion of new universities
- ✅ Confidence scoring (high/medium/low)
- ✅ Support for multiple TLDs (.edu, .ac.uk, .edu.au, etc.)

**Supported Patterns:**
- `.edu` (USA)
- `.ac.uk` (United Kingdom)
- `.ca` (Canada)
- `.edu.au` (Australia)
- `.de` (Germany)
- `.fr` (France)

---

### **7. Backend: Push Notification Service** ✅

**Location:** `backend/src/services/pushNotification.service.ts`

**Purpose:** Send push notifications to iOS and Android devices

**Features:**
- ✅ iOS push notifications via Apple Push Notification (APN)
- ✅ Android push notifications via Firebase Cloud Messaging (FCM)
- ✅ Device token management with auto-cleanup
- ✅ Notification templates for different event types
- ✅ User notification preferences
- ✅ Quiet hours support
- ✅ Badge count management
- ✅ Notification logging for analytics
- ✅ Graceful degradation if credentials missing

**Notification Templates:**
- `sendBookingConfirmationNotification()` - Booking confirmed
- `sendAppointmentReminderNotification()` - Appointment reminder
- `sendMessageNotification()` - New chat message
- `sendPaymentReceivedNotification()` - Payment received (barbers)
- `sendReviewNotification()` - New review (barbers)
- `sendSystemNotification()` - System announcements

---

### **8. Backend: Real-time Messaging Service** ✅

**Location:** `backend/src/services/message.service.ts`

**Purpose:** Manage conversations and messages between students and barbers

**Features:**
- ✅ Booking-centric conversations (adapted from CampusKinect's post-centric model)
- ✅ Conversation management with pagination
- ✅ Message sending with read receipts
- ✅ Unread message counting for badges
- ✅ Conversation deletion/archiving
- ✅ Integration with push notifications
- ✅ Real-time message delivery via Socket.IO
- ✅ Message statistics

**Key Adaptations:**
- Changed from **post-centric** (CampusKinect) to **booking-centric** (CampusCuts)
- Conversations can be tied to specific bookings
- Messages integrated with barber/student context

---

### **9. Backend: Socket.IO Integration** ✅

**Location:** `backend/src/index.ts` (lines with Socket.IO setup)

**Purpose:** Real-time bidirectional communication for chat

**Features:**
- ✅ WebSocket server with fallback to polling
- ✅ Room-based architecture:
  - `user-{userId}` - Personal rooms for direct messages
  - `campus-{campusId}` - Campus-wide updates
- ✅ CORS configuration for allowed origins
- ✅ Connection state management
- ✅ Error handling and logging
- ✅ Auto-reconnection support
- ✅ Ping/pong for connection health

**Socket Events:**
- `join-personal` - Join user's personal room
- `join-campus` - Join campus room
- `new-message` - Receive real-time messages
- `disconnect` - Handle disconnections

---

### **10. API Routes** ✅

**New Routes Added:**

#### Message Routes (`/api/messages`)
- `GET /conversations` - Get user's conversations
- `POST /conversations` - Start new conversation
- `GET /conversations/:id/messages` - Get messages
- `POST /conversations/:id/messages` - Send message
- `PUT /conversations/:id/read` - Mark as read
- `DELETE /conversations/:id` - Delete conversation
- `GET /unread-count` - Get unread count for badge
- `GET /stats` - Get message statistics

#### Notification Routes (`/api/notifications`)
- `POST /register-device` - Register device for push notifications
- `DELETE /unregister-device` - Unregister device
- `GET /preferences` - Get notification preferences
- `PUT /preferences` - Update notification preferences
- `POST /test` - Send test notification (dev only)

#### Upload Routes (`/api/upload`)
- `POST /portfolio` - Upload barber portfolio images (multiple)
- `POST /profile-picture` - Upload profile picture
- `POST /chat-image` - Upload image in chat

---

## 📦 Dependencies Added

### Backend (`package.json`)

```json
{
  "dependencies": {
    "redis": "^4.6.8",
    "socket.io": "^4.8.1",
    "sharp": "^0.32.5",
    "node-cron": "^3.0.2",
    "compression": "^1.7.4",
    "apn": "^2.2.0"
  },
  "devDependencies": {
    "@types/redis": "^4.0.11",
    "@types/compression": "^1.7.5",
    "@types/sharp": "^0.31.1"
  }
}
```

**Already Had:**
- ✅ `nodemailer` (for email)
- ✅ `multer` (for file uploads)
- ✅ `firebase-admin` (for FCM)
- ✅ `uuid` (for unique IDs)
- ✅ `express-rate-limit` (for rate limiting)

---

## 🗄️ Database Schema Updates

### New Tables Added:

**1. `conversations`**
- Stores student ↔ barber conversations
- Can be tied to specific bookings
- Tracks last message time for sorting

**2. `messages`**
- Stores chat messages
- Supports text, images, and system messages
- Read receipt tracking

**3. `mobile_devices`**
- Stores device tokens for push notifications
- Platform tracking (iOS/Android)
- Active/inactive status

**4. `notification_logs`**
- Logs all sent notifications
- Analytics and debugging
- Delivery result tracking

**5. `bookings`** (if not exists)
- Reference table for booking-centric messaging

### Schema Updates:

**`users` table:**
- Added `notification_preferences` JSONB column
- Added `username` VARCHAR(50) column
- Added `user_type` VARCHAR(20) column

---

## 🐳 Docker Configuration

### Updated `docker-compose.yml`

**Changes:**
- ✅ Redis dependency added to backend service
- ✅ `REDIS_URL` environment variable
- ✅ Volume mapping for uploads directory
- ✅ Redis service already existed (no changes needed)

---

## 🔧 Environment Variables

### New Variables Required (see `backend/env.example`)

#### Email (Required for .edu verification)
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-app-email@gmail.com
SMTP_PASS=your-gmail-app-password
```

#### Redis (Required for caching)
```bash
REDIS_URL=redis://localhost:6379
```

#### iOS Push Notifications (Required for bookings)
```bash
APN_KEY_ID=your-apn-key-id
APN_TEAM_ID=your-apple-team-id
APN_PRIVATE_KEY=./path/to/AuthKey_XXXXXXXX.p8
APN_BUNDLE_ID=com.campuscuts.ios
```

#### Android Push Notifications (Optional for Android app)
```bash
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
```

#### File Uploads
```bash
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads
```

---

## 🚀 Next Steps

### **1. Install Dependencies**

```bash
cd backend
npm install
```

This will install:
- Redis client
- Socket.IO
- Sharp (image processing)
- APN (iOS push notifications)
- Node-cron
- Compression

---

### **2. Setup Environment Variables**

1. Copy `backend/env.example` to `backend/.env`
2. Fill in the required values:
   - Gmail app password for SMTP
   - iOS APN credentials (from Apple Developer)
   - Redis URL (if not using Docker)
   - Other existing variables

---

### **3. Run Database Migration**

The schema updates are in `backend/src/database/schema.sql`. Run:

```bash
cd backend
npm run migrate
```

This creates the new tables:
- `conversations`
- `messages`
- `mobile_devices`
- `notification_logs`
- `bookings` (if not exists)

---

### **4. Start Redis**

#### Using Docker:
```bash
docker-compose up redis -d
```

#### Local Installation:
```bash
# macOS
brew install redis
brew services start redis

# Linux
sudo apt-get install redis-server
sudo systemctl start redis
```

---

### **5. Test Email Service**

Create a test endpoint or use the auth routes:

```typescript
import emailService from './services/email.service';

// Test email sending
const success = await emailService.testEmailService();
console.log('Email service working:', success);
```

---

### **6. Setup iOS Push Notifications**

#### Get APN Credentials:
1. Go to Apple Developer Portal
2. Create an **App ID** for `com.campuscuts.ios`
3. Create an **APNs Key** (.p8 file)
4. Note your **Key ID** and **Team ID**
5. Save the `.p8` file to your project
6. Update `.env` with these credentials

#### Register Device in App:
- The `PushNotificationManager` will automatically request permissions
- Device tokens are sent to backend via `/api/notifications/register-device`
- Backend stores tokens in `mobile_devices` table

---

### **7. Test Socket.IO Connection**

Start the backend:
```bash
npm run dev
```

The Socket.IO server will be available at:
- `http://localhost:3000/socket.io/`
- Supports both WebSocket and polling transports

Test connection:
```javascript
const io = require('socket.io-client');
const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('Connected:', socket.id);
  socket.emit('join-personal', 123); // Replace with user ID
});
```

---

### **8. Update iOS App Delegate**

Add push notification handling to `AppDelegate` or `CampusCutsApp`:

```swift
func application(
    _ application: UIApplication,
    didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
) {
    PushNotificationManager.shared.handleDeviceToken(deviceToken)
}

func application(
    _ application: UIApplication,
    didFailToRegisterForRemoteNotificationsWithError error: Error
) {
    PushNotificationManager.shared.handleRegistrationError(error)
}

func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void
) {
    PushNotificationManager.shared.handleNotification(response.notification.request.content.userInfo)
    completionHandler()
}
```

---

### **9. Integrate with Authentication**

Update `AuthViewModel` to use `KeychainManager`:

```swift
// On successful login
await KeychainManager.shared.saveAccessToken(token)
await KeychainManager.shared.saveUserID(userId)
await KeychainManager.shared.saveUserType(userType)

// On logout
await KeychainManager.shared.clearAllTokens()
PushNotificationManager.shared.clearBadge()
```

---

### **10. Test Image Upload**

Test portfolio image upload:

```bash
curl -X POST http://localhost:3000/api/upload/portfolio \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "images=@photo1.jpg" \
  -F "images=@photo2.jpg"
```

Expected response:
```json
{
  "success": true,
  "message": "Portfolio images uploaded successfully",
  "data": {
    "images": [
      {
        "url": "http://localhost:3000/uploads/uuid-timestamp.jpeg",
        "thumbnailUrl": "http://localhost:3000/uploads/thumb-uuid-timestamp.jpeg",
        "filename": "uuid-timestamp.jpeg"
      }
    ]
  }
}
```

---

## 🎨 Key Adaptations from CampusKinect

### **1. Post-Centric → Booking-Centric**
- CampusKinect: Conversations tied to posts
- CampusCuts: Conversations tied to bookings
- Schema adapted with `booking_id` instead of `post_id`

### **2. Branding Updates**
- Color scheme changed from purple gradient to brown/orange (barber theme)
- Email templates updated with CampusCuts branding
- Notification categories adapted for booking types

### **3. User Types**
- CampusKinect: All users are students
- CampusCuts: Students vs Barbers
- Added `user_type` tracking in Keychain and database

### **4. Notification Types**
- Added booking-specific notifications
- Added payment notifications for barbers
- Removed social features (likes, follows, reposts)

---

## 🧪 Testing Checklist

### Backend Services
- [ ] Redis connection and caching
- [ ] Email sending (verification, booking confirmation)
- [ ] Image upload and processing
- [ ] .edu email validation
- [ ] Push notification sending (iOS/Android)
- [ ] Socket.IO connection and messaging
- [ ] Message persistence and retrieval

### iOS App
- [ ] Keychain token storage and retrieval
- [ ] Push notification permission request
- [ ] Device token registration
- [ ] Notification handling and routing
- [ ] Badge count updates
- [ ] Secure API requests with Keychain tokens

### Integration
- [ ] Complete booking flow with email + push notification
- [ ] Real-time chat between student and barber
- [ ] Image upload for barber portfolio
- [ ] .edu email verification flow
- [ ] Badge count accuracy (unread messages + pending bookings)

---

## 📊 Performance Considerations

### Redis Caching Strategy

**Cache frequently accessed data:**
- Barber profiles (30 min TTL)
- Campus data (24 hour TTL)
- User sessions (2 hour TTL)
- Search results (10 min TTL)

**Don't cache:**
- Booking status (needs real-time accuracy)
- Payment transactions (security)
- Real-time messages (use Socket.IO instead)

### Image Optimization

**For best performance:**
- Serve thumbnails in list views
- Lazy load full images in detail views
- Use progressive JPEGs for gradual rendering
- Consider WebP format for modern browsers/apps

### Socket.IO Rooms

**Use rooms efficiently:**
- Join `user-{userId}` on login
- Join `campus-{campusId}` for campus updates
- Leave rooms on logout/disconnect
- Limit room memberships to active contexts

---

## 🔐 Security Notes

### Keychain Security
- Uses `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`
- Tokens never stored in UserDefaults or plaintext
- Automatically cleared on logout

### Push Notification Security
- Device tokens validated before use
- Invalid tokens automatically deactivated
- Notification content validated before sending
- User preferences respected (quiet hours, opt-outs)

### Image Upload Security
- File type validation (images only)
- File size limits enforced
- Sharp processing prevents malicious images
- Automatic cleanup of orphaned files

---

## 📱 Mobile Device Table Schema

```sql
CREATE TABLE mobile_devices (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_token TEXT NOT NULL UNIQUE,
    platform VARCHAR(20) NOT NULL CHECK (platform IN ('ios', 'android')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Usage:**
- One user can have multiple devices
- Same device token can only belong to one user
- Inactive devices are automatically cleaned up
- Platform tracking enables APN vs FCM routing

---

## 🎯 Success Metrics

After implementing these technologies, CampusCuts has:

✅ **Secure authentication** with Keychain-based token storage  
✅ **Real-time chat** via Socket.IO + message service  
✅ **Push notifications** for iOS and Android  
✅ **Email notifications** for bookings and verification  
✅ **Image processing** for barber portfolios  
✅ **.edu validation** for student authentication  
✅ **Performance optimization** with Redis caching  
✅ **Production-ready** infrastructure  

---

## 🔗 Related Documentation

- [CampusKinect Technology Transfer Analysis](./CAMPUSKINECT_TECHNOLOGY_TRANSFER.md)
- [MVP Specification](./MVP_SPECIFICATION.md)
- [API Documentation](./API_DOCUMENTATION.md)
- [Architecture Overview](./ARCHITECTURE.md)
- [Getting Started](./GETTING_STARTED.md)

---

**Note:** All transferred technologies maintain the same proven patterns from CampusKinect while adapting to CampusCuts' unique requirements (blockchain, payments, booking-centric architecture).

