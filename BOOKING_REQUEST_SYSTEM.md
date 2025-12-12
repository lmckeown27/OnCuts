# Booking Request System (AirBnb-Style)

## Overview

CampusCuts now features a **booking request workflow** similar to AirBnb, where customers send booking requests to barbers, and barbers can review the customer's profile and communicate before accepting or rejecting the request.

---

## Key Features

✅ **Booking Request Workflow** - No automatic bookings
✅ **Customer Profiles** - Barbers can view customer stats, ratings, and history
✅ **Pre-Booking Messaging** - Barbers and customers can message before accepting
✅ **Post-Booking Messaging** - Continued communication after acceptance
✅ **Accept/Reject System** - Barbers have full control over their bookings
✅ **Customer Reviews** - Barbers can review customers (reliability, punctuality, respect)
✅ **Real-time Notifications** - Alerts for new requests, acceptances, rejections, and messages

---

## User Flow

### Customer Flow

1. **Browse Barbers** - View available barbers and their profiles
2. **Request Booking** - Select service, date, time, and add optional message
3. **Wait for Response** - Barber reviews request (status: "pending")
4. **Get Notified** - Receive acceptance or rejection notification
5. **Message Barber** - Chat before and after booking
6. **Complete Booking** - Service is completed
7. **Leave Review** - Review the barber

### Barber Flow

1. **Receive Request** - Notification of new booking request
2. **View Customer Profile** - See customer stats:
   - Total bookings
   - Completion rate
   - No-show history
   - Average rating
   - Previous reviews (if any history with this customer)
3. **Review Initial Message** - Read customer's request message
4. **Message Customer** - Ask questions or clarify details
5. **Accept or Reject**:
   - **Accept**: Booking confirmed, customer notified
   - **Reject**: Include optional reason, customer notified
6. **Complete Service** - Perform haircut
7. **Review Customer** - Leave feedback on customer reliability

---

## Database Schema

### New Tables

#### `customer_profiles`
```sql
- user_id (UUID FK to users)
- display_name, bio, profile_image_url
- total_bookings, completed_bookings, cancelled_bookings, no_show_count
- avg_rating, total_reviews
- is_reliable, response_rate
```

#### `customer_reviews` (from barbers about customers)
```sql
- customer_id, barber_id, booking_id
- rating (1-5)
- showed_up, was_on_time, was_respectful
- comment
```

#### `booking_messages`
```sql
- booking_id, sender_id, sender_type (barber/customer)
- message, message_type
- read, read_at
```

#### `booking_request_notifications`
```sql
- user_id, booking_id
- type (new_request, accepted, rejected, new_message, reminder)
- title, message
- read, read_at
```

### Extended Tables

#### `bookings`
- **status**: 'pending' | 'accepted' | 'rejected' | 'completed' | 'cancelled' | 'disputed'
- **requested_at**: When customer made the request
- **responded_at**: When barber accepted/rejected
- **rejection_reason**: Optional reason for rejection

---

## API Endpoints

### Booking Requests

#### `POST /api/booking-requests`
Create a new booking request

**Body**:
```json
{
  "customerId": "uuid",
  "barberId": "uuid",
  "serviceType": "haircut",
  "requestedDate": "2025-12-15",
  "requestedTime": "14:00",
  "price": 30.00,
  "message": "Optional initial message"
}
```

**Response**:
```json
{
  "success": true,
  "bookingId": "uuid",
  "message": "Booking request sent!"
}
```

#### `GET /api/booking-requests/barber/:barberId/pending`
Get pending requests for a barber

**Response**:
```json
{
  "success": true,
  "count": 3,
  "requests": [
    {
      "bookingId": "uuid",
      "customerId": "uuid",
      "customerName": "John Doe",
      "customerProfile": {
        "displayName": "John",
        "bio": "...",
        "stats": {
          "totalBookings": 15,
          "completedBookings": 14,
          "cancelledBookings": 1,
          "noShowCount": 0,
          "avgRating": 4.8,
          "completionRate": 93,
          "isReliable": true
        }
      },
      "serviceType": "haircut",
      "requestedDate": "2025-12-15",
      "requestedTime": "14:00",
      "price": 30.00,
      "message": "Looking forward to this!",
      "requestedAt": "2025-12-12T10:00:00Z"
    }
  ]
}
```

#### `POST /api/booking-requests/:bookingId/accept`
Accept a booking request

**Body**:
```json
{
  "barberId": "uuid",
  "message": "Looking forward to seeing you!"
}
```

#### `POST /api/booking-requests/:bookingId/reject`
Reject a booking request

**Body**:
```json
{
  "barberId": "uuid",
  "reason": "Already fully booked for that day"
}
```

### Customer Profiles

#### `GET /api/booking-requests/customer/:customerId/profile?barberId=X`
Get customer profile (barber view)

**Response**:
```json
{
  "success": true,
  "profile": {
    "id": "uuid",
    "name": "John Doe",
    "displayName": "John",
    "bio": "Love clean cuts!",
    "profileImageUrl": "...",
    "verified": true,
    "memberSince": "2024-01-15",
    "stats": {
      "totalBookings": 15,
      "completedBookings": 14,
      "cancelledBookings": 1,
      "noShowCount": 0,
      "avgRating": 4.8,
      "completionRate": 93,
      "isReliable": true,
      "responseRate": 98
    },
    "previousReviews": [
      {
        "rating": 5,
        "comment": "Great customer, on time!",
        "showedUp": true,
        "wasOnTime": true,
        "wasRespectful": true,
        "createdAt": "2024-05-20"
      }
    ]
  }
}
```

#### `GET /api/booking-requests/customer/:customerId/status`
Get customer's booking status

### Messaging

#### `POST /api/booking-requests/:bookingId/messages`
Send a message

**Body**:
```json
{
  "senderId": "uuid",
  "senderType": "barber" | "customer",
  "message": "What style are you looking for?"
}
```

#### `GET /api/booking-requests/:bookingId/messages?userId=X`
Get messages for a booking (auto-marks as read)

**Response**:
```json
{
  "success": true,
  "messages": [
    {
      "messageId": "uuid",
      "senderId": "uuid",
      "senderType": "customer",
      "senderName": "John Doe",
      "message": "Looking for a fade",
      "read": true,
      "createdAt": "2025-12-12T10:00:00Z"
    }
  ]
}
```

#### `GET /api/booking-requests/user/:userId/conversations?userType=barber`
Get all conversations for a user

**Response**:
```json
{
  "success": true,
  "conversations": [
    {
      "bookingId": "uuid",
      "status": "pending",
      "serviceType": "haircut",
      "bookingDate": "2025-12-15",
      "otherParty": {
        "id": "uuid",
        "name": "John Doe"
      },
      "lastMessage": "What style are you looking for?",
      "lastMessageAt": "2025-12-12T10:30:00Z",
      "unreadCount": 2
    }
  ]
}
```

#### `GET /api/booking-requests/user/:userId/unread-count`
Get unread message count

**Response**:
```json
{
  "success": true,
  "unreadCount": 5
}
```

---

## Frontend Components (To Be Built)

### For Barbers

1. **`BarberBookingRequests.tsx`** - List of pending requests
   - Customer preview cards
   - Quick stats display
   - Accept/reject buttons
   - Message preview

2. **`CustomerProfileModal.tsx`** - Detailed customer view
   - Full customer stats
   - Previous reviews
   - Booking history
   - Reliability indicators

3. **`BookingMessaging.tsx`** - Chat interface
   - Real-time messaging
   - Message history
   - Typing indicators
   - Read receipts

### For Customers

1. **`CustomerBookingTracker.tsx`** - Track request status
   - Pending requests
   - Accepted bookings
   - Rejected requests (with reasons)
   - Message notifications

2. **`BarberBookingModal.tsx`** - Create request
   - Service selection
   - Date/time picker
   - Initial message input
   - Price display

---

## Notification System

### Notification Types

| Type | Recipient | Trigger | Title | Message |
|------|-----------|---------|-------|---------|
| `new_request` | Barber | Customer sends request | "New Booking Request" | "You have a new booking request from {customer}" |
| `accepted` | Customer | Barber accepts | "Booking Accepted!" | "{barber} has accepted your booking request" |
| `rejected` | Customer | Barber rejects | "Booking Not Available" | "{barber} is unable to accept your booking request" |
| `new_message` | Both | Message sent | "New Message" | "You have a new message about your booking" |
| `reminder` | Both | Upcoming booking | "Booking Reminder" | "Your booking is tomorrow at {time}" |

### Implementation

- Stored in `booking_request_notifications` table
- Can be extended to push notifications (FCM/APNS)
- Badge counts for unread notifications
- In-app notification center

---

## Customer Stats Calculation

### Automatic Updates

**Triggers** (via PostgreSQL triggers):
- Booking completed → `completed_bookings++`, `total_bookings++`
- Booking cancelled → `cancelled_bookings++`
- No-show flagged → `no_show_count++`

### Rating System

- Barbers review customers after bookings
- Average rating calculated from all reviews
- Visible to all barbers
- Helps barbers make informed decisions

### Reliability Indicators

- **Green Badge**: Completion rate > 90%, No-shows = 0
- **Yellow Badge**: Completion rate 70-90%, No-shows < 3
- **Red Badge**: Completion rate < 70%, No-shows ≥ 3

---

## Benefits

### For Barbers

✅ **Control** - Full control over who they accept  
✅ **Risk Management** - Review customer history before accepting  
✅ **Communication** - Clarify details before commitment  
✅ **Quality** - Avoid no-shows and problematic customers  
✅ **Flexibility** - Can reject without penalty  

### For Customers

✅ **Transparency** - Know your request status  
✅ **Communication** - Ask questions before booking  
✅ **Trust** - Build reputation through good behavior  
✅ **Feedback** - Understand why requests are rejected  
✅ **Choice** - Request multiple barbers if needed  

---

## Database Migration

Run the migration:

```bash
cd backend
psql $DATABASE_URL -f migrations/005_booking_requests.sql
```

This creates all required tables, indexes, and triggers.

---

## Testing Checklist

### Booking Request Flow

- [ ] Customer can create booking request
- [ ] Barber receives notification
- [ ] Barber can view customer profile
- [ ] Barber can accept request
- [ ] Customer receives acceptance notification
- [ ] Barber can reject request with reason
- [ ] Customer receives rejection notification

### Messaging

- [ ] Customer can send initial message
- [ ] Barber can reply
- [ ] Messages are delivered in real-time
- [ ] Unread count updates correctly
- [ ] Messages marked as read when viewed

### Customer Profiles

- [ ] Profile created on user signup
- [ ] Stats update after bookings
- [ ] Barber can see customer history
- [ ] Previous reviews display correctly

---

## Future Enhancements

### Potential Additions

1. **Instant Book** - Allow customers to instantly book with barbers who enable it
2. **Auto-Accept Rules** - Barbers set criteria for auto-accepting reliable customers
3. **Request Expiry** - Requests expire after 24 hours if not responded to
4. **Batch Accept/Reject** - Barbers can handle multiple requests at once
5. **Smart Recommendations** - Suggest best customers to barbers
6. **Video Messages** - Allow video introduction from customers
7. **Booking Preferences** - Customers save preferences (style, products)
8. **Multi-Barber Requests** - Request from multiple barbers simultaneously

---

## Security & Privacy

### Customer Profile Visibility

- Full profile visible **only** when customer sends request
- Limited profile (name + basic stats) in search results
- Previous reviews only visible to barber who left them
- No personal contact info shared until booking accepted

### Message Privacy

- Messages tied to specific bookings
- Cannot message barbers without active booking
- Messages deleted after 90 days (configurable)
- Report/block functionality for inappropriate content

---

## Summary

The **Booking Request System** transforms CampusCuts from an automatic booking platform to a relationship-based marketplace where barbers have full control over their clientele and customers can build trust through reliable behavior.

**Status**: ✅ Backend Complete, Frontend In Progress

---

**Next Steps**:
1. Build frontend components
2. Integrate with existing booking UI
3. Add push notifications
4. Test end-to-end flow
5. Deploy to production


