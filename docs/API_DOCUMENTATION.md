# CampusCuts API Documentation

Base URL: `https://api.campuscuts.com/api` (Production)  
Dev URL: `http://localhost:3000/api`

## Authentication

All authenticated endpoints require a Bearer token in the Authorization header:

```
Authorization: Bearer <token>
```

---

## Endpoints

### Authentication

#### Register User
```http
POST /auth/register
```

**Request Body:**
```json
{
  "email": "student@harvard.edu",
  "password": "securepassword123",
  "firstName": "John",
  "lastName": "Doe",
  "campusId": 1,
  "role": "student",
  "phone": "+1234567890"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "student@harvard.edu",
      "firstName": "John",
      "lastName": "Doe",
      "role": "student",
      "campusId": 1
    },
    "token": "jwt_token_here",
    "aptosAddress": "0x..."
  },
  "message": "Registration successful"
}
```

#### Login
```http
POST /auth/login
```

**Request Body:**
```json
{
  "email": "student@harvard.edu",
  "password": "securepassword123"
}
```

---

### Barbers

#### Get All Barbers
```http
GET /barbers?campusId=1&minRating=4.0&instantBook=true
```

**Query Parameters:**
- `campusId` (optional): Filter by campus
- `minRating` (optional): Minimum rating (0-5)
- `maxPrice` (optional): Maximum price
- `specialty` (optional): Specialty filter
- `instantBook` (optional): Filter instant book barbers

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "firstName": "Mike",
      "lastName": "Smith",
      "bio": "Professional barber...",
      "pricing": {
        "Haircut": 25,
        "Fade": 30,
        "Beard Trim": 15
      },
      "averageRating": 4.8,
      "totalBookings": 150,
      "instantBook": true,
      "portfolio": [
        {
          "url": "https://...",
          "caption": "Fresh fade"
        }
      ]
    }
  ],
  "count": 1
}
```

#### Get Barber by ID
```http
GET /barbers/:id
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "firstName": "Mike",
    "lastName": "Smith",
    "bio": "Professional barber with 5 years experience",
    "pricing": { "Haircut": 25 },
    "averageRating": 4.8,
    "portfolio": [...],
    "blockchain_rating": {
      "average": 4.75,
      "total": 143
    }
  }
}
```

#### Create Barber Profile
```http
POST /barbers
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "bio": "Professional barber specializing in fades",
  "pricing": {
    "Haircut": 25,
    "Fade": 30,
    "Beard Trim": 15
  },
  "specialties": ["Fades", "Tapers", "Lineups"],
  "yearsExperience": 5,
  "instantBook": true
}
```

---

### Bookings

#### Create Booking
```http
POST /bookings
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "barberId": "uuid",
  "serviceType": "Fade",
  "scheduledTime": "2025-11-30T14:00:00Z",
  "durationMinutes": 45,
  "locationDetails": "Smith Hall, Room 204",
  "specialRequests": "Low fade please"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "booking": {
      "id": "uuid",
      "blockchainBookingId": 123,
      "barberId": "uuid",
      "clientId": "uuid",
      "locationDetails": "Smith Hall, Room 204",
      "createdAt": "2025-11-25T..."
    },
    "transactionHash": "0x..."
  },
  "message": "Booking created successfully"
}
```

#### Get User Bookings
```http
GET /bookings
Authorization: Bearer <token>
```

**Query Parameters:**
- `status` (optional): Filter by status
- `startDate` (optional): Filter by date range
- `endDate` (optional): Filter by date range

#### Confirm Booking (Barber)
```http
PUT /bookings/:id/confirm
Authorization: Bearer <token>
```

#### Complete Booking (Barber)
```http
PUT /bookings/:id/complete
Authorization: Bearer <token>
```

#### Cancel Booking
```http
PUT /bookings/:id/cancel
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "reason": "Schedule conflict"
}
```

---

### Payments

#### Create Payment Intent
```http
POST /payments/create-intent
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "bookingId": 123,
  "amount": 2500
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "clientSecret": "pi_xxx_secret_xxx",
    "paymentIntentId": "pi_xxx"
  }
}
```

#### Get Earnings Summary (Barber)
```http
GET /payments/earnings/summary
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "total_earned": "5000.00",
    "paid_out": "4500.00",
    "pending": "500.00",
    "total_transactions": "150"
  }
}
```

#### Request Payout (Barber)
```http
POST /payments/payout
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "amount": 50000
}
```

---

### Reviews

#### Submit Review
```http
POST /reviews
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "bookingId": 123,
  "rating": 5,
  "reviewText": "Great haircut! Very professional.",
  "images": ["https://..."]
}
```

#### Get Barber Reviews
```http
GET /reviews/barber/:barberId?page=1&limit=20
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "blockchainReviewId": 456,
      "bookingId": 123,
      "reviewText": "Great service!",
      "helpfulCount": 5,
      "createdAt": "2025-11-25T...",
      "clientFirstName": "John",
      "clientLastName": "Doe"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 143,
    "pages": 8
  }
}
```

---

### Campus

#### Get All Campuses
```http
GET /campus
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Harvard University",
      "domain": "harvard.edu",
      "city": "Cambridge",
      "state": "MA"
    }
  ],
  "count": 10
}
```

#### Get Campus Barbers
```http
GET /campus/:id/barbers?sortBy=rating
```

**Query Parameters:**
- `sortBy`: `rating`, `price`, or `bookings`

---

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "error": {
    "message": "Error description"
  }
}
```

### Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

---

## Rate Limiting

- **Window**: 15 minutes
- **Max Requests**: 100 per window
- **Response**: 429 Too Many Requests

---

## Webhooks

### Stripe Webhook
```http
POST /payments/webhook
Content-Type: application/json
Stripe-Signature: <signature>
```

Events handled:
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `transfer.created`

---

## Development

### Testing with cURL

```bash
# Register user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@harvard.edu",
    "password": "password123",
    "firstName": "Test",
    "lastName": "User",
    "campusId": 1,
    "role": "student"
  }'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@harvard.edu",
    "password": "password123"
  }'

# Get barbers (with token)
curl -X GET http://localhost:3000/api/barbers?campusId=1 \
  -H "Authorization: Bearer <your_token>"
```

---

## Support

For API support:
- Email: dev@campuscuts.com
- GitHub Issues: https://github.com/lmckeown27/CampusCuts/issues

