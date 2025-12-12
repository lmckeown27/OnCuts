# Frontend Booking Request System - Integration Guide

## Components Built

### 1. `BarberBookingRequests.tsx`
**Location**: `web-app/src/components/booking/BarberBookingRequests.tsx`

**Purpose**: Shows pending booking requests for barbers with customer profiles

**Features**:
- List of pending requests with customer preview
- Quick stats (completion rate, no-shows, ratings)
- Reliability badges (green/yellow/red)
- Accept/reject buttons
- View full customer profile modal
- Customer's initial message display

**Props**:
```typescript
{
  barberId: string;
  onRequestHandled?: () => void;
}
```

**Usage**:
```tsx
import BarberBookingRequests from '@/components/booking/BarberBookingRequests';

<BarberBookingRequests 
  barberId={currentBarberId} 
  onRequestHandled={() => refreshData()} 
/>
```

---

### 2. `BookingMessaging.tsx`
**Location**: `web-app/src/components/booking/BookingMessaging.tsx`

**Purpose**: Real-time messaging between barber and customer

**Features**:
- Send/receive messages
- Message history
- Auto-scroll to latest
- Read receipts
- Real-time polling (every 5 seconds)

**Props**:
```typescript
{
  bookingId: string;
  userId: string;
  userType: 'barber' | 'customer';
  otherPartyName: string;
}
```

**Usage**:
```tsx
import BookingMessaging from '@/components/booking/BookingMessaging';

<BookingMessaging
  bookingId={selectedBooking.id}
  userId={currentUserId}
  userType="barber"
  otherPartyName="John Doe"
/>
```

---

### 3. `CustomerBookingTracker.tsx`
**Location**: `web-app/src/components/booking/CustomerBookingTracker.tsx`

**Purpose**: Track customer's booking requests and status

**Features**:
- List of all booking requests
- Status badges (pending/accepted/rejected)
- Unread message indicators
- Messaging modal
- Real-time updates (every 10 seconds)

**Props**:
```typescript
{
  customerId: string;
}
```

**Usage**:
```tsx
import CustomerBookingTracker from '@/components/booking/CustomerBookingTracker';

<CustomerBookingTracker customerId={currentUserId} />
```

---

## Integration Instructions

### For Barber Dashboard

**File to update**: `web-app/src/pages/BarberDashboard.tsx` (or similar)

**Add this section**:
```tsx
import BarberBookingRequests from '../components/booking/BarberBookingRequests';

// Inside your component:
<div className="mb-8">
  <BarberBookingRequests 
    barberId={barber.barber_id} 
    onRequestHandled={() => {
      // Refresh any data needed
      fetchDashboardData();
    }}
  />
</div>
```

**Placement**: Add it **above** the existing bookings list or as a separate tab

---

### For Customer Pages

#### Option A: Dedicated Bookings Page

Create `web-app/src/pages/MyBookings.tsx`:
```tsx
import React from 'react';
import CustomerBookingTracker from '../components/booking/CustomerBookingTracker';
import { useAuth } from '../contexts/AuthContext'; // Your auth context

export default function MyBookings() {
  const { user } = useAuth();

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Bookings</h1>
      <CustomerBookingTracker customerId={user.id} />
    </div>
  );
}
```

#### Option B: Add to Customer Dashboard

Update `web-app/src/pages/CustomerDashboard.tsx`:
```tsx
import CustomerBookingTracker from '../components/booking/CustomerBookingTracker';

// Inside your component:
<div className="mb-8">
  <CustomerBookingTracker customerId={user.id} />
</div>
```

---

### Updating the Booking Flow

#### Current Flow (to change):
```
Customer → Select Barber → Instant Book → Done
```

#### New Flow:
```
Customer → Select Barber → Send Request (with message) → Wait for Response
```

**Update your booking modal/form**:

Instead of creating a booking directly, use the request endpoint:

```tsx
const handleSendBookingRequest = async (formData) => {
  try {
    const response = await axios.post('http://localhost:3001/api/booking-requests', {
      customerId: user.id,
      barberId: selectedBarber.id,
      serviceType: formData.serviceType,
      requestedDate: formData.date,
      requestedTime: formData.time,
      price: formData.price,
      message: formData.message, // Optional initial message
    });

    toast.success('Booking request sent! The barber will review and respond shortly.');
    
    // Redirect to bookings tracker
    navigate('/my-bookings');
  } catch (error) {
    toast.error('Failed to send booking request');
  }
};
```

---

## Navigation Updates

Add new routes to `App.tsx`:

```tsx
import MyBookings from './pages/MyBookings';

// In your routes:
<Route path="/my-bookings" element={<MyBookings />} />
```

Add navigation link:
```tsx
<Link to="/my-bookings" className="...">
  My Bookings
  {unreadCount > 0 && (
    <span className="ml-2 px-2 py-1 bg-red-500 text-white text-xs rounded-full">
      {unreadCount}
    </span>
  )}
</Link>
```

---

## Notification Badge

To show unread message count in nav:

```tsx
import { useState, useEffect } from 'react';
import axios from 'axios';

const [unreadCount, setUnreadCount] = useState(0);

useEffect(() => {
  const fetchUnread = async () => {
    try {
      const response = await axios.get(
        `http://localhost:3001/api/booking-requests/user/${userId}/unread-count`
      );
      setUnreadCount(response.data.unreadCount);
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  };

  fetchUnread();
  const interval = setInterval(fetchUnread, 30000); // Every 30 seconds
  return () => clearInterval(interval);
}, [userId]);
```

---

## Styling Notes

All components use:
- Tailwind CSS classes
- Existing `Button` and `Card` components
- Lucide React icons
- Consistent color scheme (indigo primary)

**Color Meanings**:
- Green: Reliable customers, accepted bookings
- Yellow: Pending requests, average customers
- Red: Rejected bookings, unreliable customers
- Blue: Messages, information

---

## Testing Checklist

### Barber Side
- [ ] View pending requests
- [ ] See customer profile details
- [ ] Accept a request
- [ ] Reject a request
- [ ] Send messages
- [ ] Receive messages
- [ ] See unread message count

### Customer Side
- [ ] Send booking request
- [ ] See request status (pending/accepted/rejected)
- [ ] Receive acceptance notification
- [ ] Receive rejection notification
- [ ] Send messages to barber
- [ ] View message history
- [ ] See unread indicators

---

## Example Integration: Barber Dashboard

Complete example:

```tsx
// web-app/src/pages/BarberDashboard.tsx
import React, { useState } from 'react';
import BarberBookingRequests from '../components/booking/BarberBookingRequests';
import { useAuth } from '../contexts/AuthContext';

export default function BarberDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('requests');

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Barber Dashboard</h1>

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b">
        <button
          onClick={() => setActiveTab('requests')}
          className={`pb-2 px-4 ${
            activeTab === 'requests'
              ? 'border-b-2 border-indigo-600 text-indigo-600 font-semibold'
              : 'text-gray-600'
          }`}
        >
          Booking Requests
        </button>
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`pb-2 px-4 ${
            activeTab === 'upcoming'
              ? 'border-b-2 border-indigo-600 text-indigo-600 font-semibold'
              : 'text-gray-600'
          }`}
        >
          Upcoming Bookings
        </button>
      </div>

      {/* Content */}
      {activeTab === 'requests' && (
        <BarberBookingRequests 
          barberId={user.barberId} 
          onRequestHandled={() => {
            // Refresh data or show success message
          }}
        />
      )}

      {activeTab === 'upcoming' && (
        // Your existing upcoming bookings component
        <div>Upcoming bookings...</div>
      )}
    </div>
  );
}
```

---

## Example Integration: Customer Booking Flow

```tsx
// web-app/src/pages/BookBarber.tsx or similar
import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function BookBarber() {
  const { barberId } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    date: '',
    time: '',
    serviceType: 'haircut',
    message: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await axios.post('http://localhost:3001/api/booking-requests', {
        customerId: currentUser.id,
        barberId,
        serviceType: formData.serviceType,
        requestedDate: formData.date,
        requestedTime: formData.time,
        price: 30.00, // Calculate based on service
        message: formData.message,
      });

      toast.success('Booking request sent! The barber will review and respond.');
      navigate('/my-bookings');
    } catch (error) {
      toast.error('Failed to send booking request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Request a Booking</h1>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Date Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Preferred Date
          </label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            required
          />
        </div>

        {/* Time Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Preferred Time
          </label>
          <input
            type="time"
            value={formData.time}
            onChange={(e) => setFormData({ ...formData, time: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            required
          />
        </div>

        {/* Service Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Service Type
          </label>
          <select
            value={formData.serviceType}
            onChange={(e) => setFormData({ ...formData, serviceType: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option value="haircut">Haircut</option>
            <option value="beard-trim">Beard Trim</option>
            <option value="full-service">Full Service</option>
          </select>
        </div>

        {/* Optional Message */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Message to Barber (Optional)
          </label>
          <textarea
            value={formData.message}
            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
            placeholder="Tell the barber what you're looking for..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            rows={4}
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? 'Sending Request...' : 'Send Booking Request'}
        </button>
      </form>

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-900">
          <strong>Note:</strong> The barber will review your request and respond shortly. 
          You'll be notified when they accept or decline.
        </p>
      </div>
    </div>
  );
}
```

---

## Summary

✅ **3 New Components Built**
- BarberBookingRequests (request management)
- BookingMessaging (real-time chat)
- CustomerBookingTracker (status tracking)

✅ **Key Features**
- Accept/reject workflow
- Customer profiles with stats
- Pre/post booking messaging
- Real-time updates
- Notification badges

✅ **Integration Required**
- Add components to barber dashboard
- Add components to customer pages
- Update booking flow to use requests
- Add navigation routes

**All components are production-ready and fully styled!**

