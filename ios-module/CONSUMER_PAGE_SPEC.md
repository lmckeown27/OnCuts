# CampusCuts Consumer Page - Detailed Specification

> Complete specification for the iOS implementation of the Consumer Home experience.

---

## Table of Contents

1. [Overview](#overview)
2. [Page Structure](#page-structure)
3. [Header Component](#header-component)
4. [Discovery View](#discovery-view)
5. [Barber Cards](#barber-cards)
6. [Barber Profile Modal](#barber-profile-modal)
7. [Modals & Overlays](#modals--overlays)
8. [State Management](#state-management)
9. [Real-Time Features](#real-time-features)
10. [Responsive Behavior](#responsive-behavior)

---

## Overview

The Consumer Page is the main hub for students looking to book haircuts. It provides:
- A grid of available barbers at the selected university
- Quick access to messages and notifications
- Profile management
- Barber application flow (for students wanting to become barbers)

### Entry Conditions

Before rendering the Consumer Page, the app should check:

1. **University Selection**: If no university is selected (stored in local storage), redirect to landing/university selection
2. **Active Booking**: If user has a PENDING or ACCEPTED booking, redirect to Booking Status Page
3. **Authentication**: Page works for both authenticated and guest users (with limited features for guests)

---

## Page Structure

```
┌────────────────────────────────────────────────────────────────┐
│                         HEADER                                  │
│  [Become Barber/Barber View]  [Logo]  [Messages] [Profile ▼]   │
├────────────────────────────────────────────────────────────────┤
│                     FILTER HEADER                               │
│         "Barbers at Cal Poly SLO • Haircut [Clear]"            │
│                    "5 barbers found"                            │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│                     BARBER GRID                                 │
│                                                                 │
│   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐           │
│   │  Photo  │  │  Photo  │  │  Photo  │  │  Photo  │           │
│   │  $25    │  │ $20-30  │  │  $35    │  │  $28    │           │
│   └─────────┘  └─────────┘  └─────────┘  └─────────┘           │
│                                                                 │
│              "Prices are set by individual barbers"             │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

## Header Component

### Layout

| Position | Unauthenticated | Authenticated (Consumer) | Authenticated (Has Barber Profile) |
|----------|-----------------|--------------------------|-----------------------------------|
| Left | "Become a Barber" button | "Become a Barber" button | "Barber View" button |
| Center | CampusCuts Logo (tappable → home) | CampusCuts Logo | CampusCuts Logo |
| Right | "Sign In" button | Messages + Profile dropdown | Messages + Profile dropdown |

### Left Section Logic

```swift
if user.hasBarberProfile || user.userType == .barber || user.userType == .admin {
    // Show "Barber View" button
    Button("Barber View") {
        navigate(to: .barberDashboard)
    }
    .style(.outlined, .primary)
} else {
    // Show "Become a Barber" button
    Button("Become a Barber") {
        handleBecomeBarberClick()
    }
    .style(.filled, .primary)
}
```

### "Become a Barber" Click Logic

```swift
func handleBecomeBarberClick() {
    guard let user = authStore.user else {
        // Not authenticated - show login prompt
        showLoginPrompt(action: .becomeBarber)
        return
    }
    
    // Check application status
    let application = await barberApplicationService.getMyApplication()
    
    switch application?.status {
    case .pending, .underReview, .interviewScheduled:
        showPendingApplicationPopup()
    case .rejected:
        showRejectedApplicationPopup()
    default:
        showBarberApplicationModal()
    }
}
```

### Messages Button (Authenticated)

```
┌─────────┐
│   💬    │ ← MessageCircle icon
│   (3)   │ ← Red badge if unread > 0
└─────────┘
```

- Tap → Navigate to `/consumer/messages`
- Badge shows unread count (caps at 99+)

### Profile Dropdown (Authenticated)

```
┌──────────────────────────┐
│ 👤 Avatar    ▼           │
└──────────────────────────┘
         ↓ (tap)
┌──────────────────────────┐
│ 🔔 Notifications    (2)  │
├──────────────────────────┤
│ ⚙️ Edit Profile          │
├──────────────────────────┤
│ 📄 Privacy Policy        │
│ 📄 Terms of Service      │
├──────────────────────────┤
│ 🚪 Sign Out         RED  │
└──────────────────────────┘
```

### Sign In Button (Unauthenticated)

```swift
Button {
    navigate(to: .auth)
} label: {
    HStack {
        Image(systemName: "person")
        Text("Sign In")
    }
}
.style(.filled, .primary)
```

---

## Discovery View

The main content area showing barbers.

### Filter Header

Displays current filters and university:

```
"Barbers at [University Short Name]"
• [Service Type] [Clear]  ← Only if filter applied
• [Change] ← Opens university selector

"X barber(s) found"
```

### Empty States

**No Barbers at University:**
```
┌────────────────────────────────────────────┐
│                                            │
│   No barbers at Cal Poly SLO              │
│                                            │
│   There are no barbers registered at      │
│   this campus yet. Check back soon!       │
│                                            │
│   [Try a different university]            │
│                                            │
│   ─────────────────────────────────────   │
│                                            │
│   Want to be a barber at Cal Poly SLO?   │
│                                            │
│   ┌────────────────────────┐              │
│   │   Become a Barber      │              │
│   └────────────────────────┘              │
│                                            │
└────────────────────────────────────────────┘
```

**No Barbers Match Filter:**
```
┌────────────────────────────────────────────┐
│                                            │
│   No barbers match your criteria          │
│                                            │
│   Try adjusting your filters or           │
│   check back later                        │
│                                            │
└────────────────────────────────────────────┘
```

### Barber Loading

Barbers are randomly shuffled on each page load using Fisher-Yates shuffle algorithm. This ensures fair visibility for all barbers.

```swift
func shuffleBarbers(_ barbers: [Barber]) -> [Barber] {
    var shuffled = barbers
    for i in stride(from: shuffled.count - 1, to: 0, by: -1) {
        let j = Int.random(in: 0...i)
        shuffled.swapAt(i, j)
    }
    return shuffled
}
```

### Self-Filtering

Users cannot see their own barber profile in the list (prevents self-booking):

```swift
filteredBarbers = barbers.filter { barber in
    barber.userId != currentUser?.id
}
```

---

## Barber Cards

### Portrait Mobile Layout (Horizontal Card)

```
┌──────────────────────────────────────────────────┐
│ ┌──────────┐                                     │
│ │          │  Business Name          $25-35  →  │
│ │  Photo   │                                     │
│ │  112x112 │  📸 @instagram_handle              │
│ └──────────┘                                     │
└──────────────────────────────────────────────────┘
```

### Tablet/Desktop Layout (Vertical Card)

```
┌─────────────────────────┐
│ ┌─────────────────────┐ │
│ │    Business Name    │ │  ← Name overlay at top
│ │                     │ │
│ │                     │ │
│ │       Photo         │ │
│ │      224x224        │ │
│ │                     │ │
│ │                     │ │
│ │ ┌─────┐             │ │
│ │ │ $25 │             │ │  ← Price overlay bottom-left
│ │ └─────┘             │ │
│ └─────────────────────┘ │
└─────────────────────────┘
```

### Card Data Model

```swift
struct BarberCardData {
    let id: String
    let name: String                    // Business name or display_name
    let profilePictureUrl: String?
    let instagramHandle: String?
    let pricing: [ServicePricing]       // For price range calculation
    let distanceMiles: Double?          // Optional, not currently displayed
}

// Price display logic
var priceDisplay: String {
    let prices = pricing.map { $0.price }
    guard let min = prices.min(), let max = prices.max() else { return "" }
    return min == max ? "$\(min)" : "$\(min) - $\(max)"
}
```

### Card Interactions

- **Tap** → Open Barber Profile Modal
- **Haptic** → Light impact on tap
- **Animation** → Scale down to 98% on press

---

## Barber Profile Modal

Full-screen modal showing complete barber details.

### Modal Structure

```
┌────────────────────────────────────────────────────────┐
│ HEADER (sticky)                                        │
│  "Business Name"             [Instagram] [×]           │
├────────────────────────────────────────────────────────┤
│ CONTENT (scrollable)                                   │
│                                                        │
│  ┌────────────────┐                                    │
│  │                │    SERVICES                        │
│  │    Photo       │    ┌──────────────────────────┐   │
│  │    256x256     │    │ Haircut • $25            │   │
│  │                │    │ Fade • $30               │   │
│  │                │    │ Beard Trim • $15         │   │
│  └────────────────┘    └──────────────────────────┘   │
│                                                        │
│                        AVAILABILITY                    │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐             │
│  │ Mon │ │ Tue │ │ Wed │ │ Thu │ │ Fri │             │
│  │9-5pm│ │9-5pm│ │9-5pm│ │9-5pm│ │9-5pm│             │
│  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘             │
│                                                        │
│  ─────────────────────────────────────────────────    │
│                                                        │
│  LOCATIONS                                             │
│  ┌────────────┐ ┌────────────┐                        │
│  │ Dorm Room  │ │ Library    │                        │
│  │ (Primary)  │ │            │                        │
│  └────────────┘ └────────────┘                        │
│                                                        │
│  ─────────────────────────────────────────────────    │
│                                                        │
│  ABOUT                                                 │
│  "Professional barber with 5 years experience..."     │
│                                                        │
│  ─────────────────────────────────────────────────    │
│                                                        │
│  REVIEWS ▼                    ⭐ 4.8 (42)             │
│  (collapsible)                                         │
│  ┌─────────────────────────────────────────────────┐  │
│  │ John D.        Haircut           ⭐⭐⭐⭐⭐       │  │
│  │ "Great cut! Very professional."                 │  │
│  │ Mar 5, 2026                                     │  │
│  └─────────────────────────────────────────────────┘  │
│                                                        │
├────────────────────────────────────────────────────────┤
│ FOOTER (sticky)                                        │
│  ┌──────────────────────────────────────────────────┐ │
│  │            SCHEDULE SERVICE                       │ │
│  └──────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

### Modal Header

```swift
HStack {
    Text(barber.name)
        .font(.title2.bold())
    
    Spacer()
    
    if let instagram = barber.instagramHandle {
        Link(destination: URL(string: "https://instagram.com/\(instagram)")!) {
            HStack {
                Image("instagram")
                Text("@\(instagram)")
            }
        }
        .buttonStyle(.instagram)
    }
    
    Button(action: dismiss) {
        Image(systemName: "xmark")
    }
}
```

### Services Section

Shows services with prices as pill badges:

```swift
FlowLayout(spacing: 8) {
    ForEach(barber.pricing) { service in
        HStack(spacing: 4) {
            Text(service.name)
            Text("•")
            Text("$\(service.price)")
                .fontWeight(.bold)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(Color.primary.opacity(0.1))
        .cornerRadius(20)
    }
}
```

### Availability Section

Grid of available days with time slots:

```swift
struct AvailabilityDay {
    let dayAbbrev: String       // "Mon", "Tue", etc.
    let timeSlots: [String]     // ["9am-12pm", "2pm-6pm"]
}

// Display as grid
LazyVGrid(columns: [GridItem(.adaptive(minimum: 80))], spacing: 8) {
    ForEach(availableDays) { day in
        VStack(spacing: 4) {
            Text(day.dayAbbrev)
                .fontWeight(.semibold)
            ForEach(day.timeSlots, id: \.self) { slot in
                Text(slot)
                    .font(.caption)
            }
        }
        .padding(8)
        .background(Color.gray.opacity(0.1))
        .cornerRadius(8)
    }
}
```

### Time Formatting

Convert 24h time to 12h display:

```swift
func formatTime(_ time24: String) -> String {
    // "09:00" → "9am", "17:30" → "5:30pm"
    let parts = time24.split(separator: ":")
    guard let hour = Int(parts[0]), let minute = Int(parts[1]) else { return "N/A" }
    
    let ampm = hour >= 12 ? "pm" : "am"
    let hour12 = hour % 12 == 0 ? 12 : hour % 12
    
    if minute == 0 {
        return "\(hour12)\(ampm)"
    } else {
        return "\(hour12):\(String(format: "%02d", minute))\(ampm)"
    }
}
```

### Locations Section

Shows barber's service locations with primary highlighted:

```swift
FlowLayout(spacing: 8) {
    ForEach(barber.serviceLocations) { location in
        Text(location.name)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(location.isPrimary ? Color.primary.opacity(0.1) : Color.gray.opacity(0.1))
            .foregroundColor(location.isPrimary ? .primary : .secondary)
            .overlay(
                RoundedRectangle(cornerRadius: 20)
                    .stroke(location.isPrimary ? Color.primary : Color.clear, lineWidth: 1)
            )
            .cornerRadius(20)
    }
}
```

### Reviews Section

Collapsible section with star ratings:

```swift
@State private var reviewsExpanded = false

DisclosureGroup(isExpanded: $reviewsExpanded) {
    ForEach(barber.reviews) { review in
        ReviewCard(review: review)
    }
} label: {
    HStack {
        Text("Reviews")
        Spacer()
        StarRating(rating: barber.averageRating, count: barber.reviewCount)
    }
}
```

### Review Card

```swift
struct ReviewCard: View {
    let review: Review
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("\(review.firstName) \(review.lastName?.first.map { String($0) + "." } ?? "")")
                    .fontWeight(.medium)
                
                if let service = review.serviceName {
                    Text(service.formatted)
                        .font(.caption)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.gray.opacity(0.2))
                        .cornerRadius(8)
                }
                
                Spacer()
                
                StarRating(rating: Double(review.rating), showCount: false)
            }
            
            if let text = review.reviewText {
                Text(text)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
            
            Text(review.createdAt, style: .date)
                .font(.caption)
                .foregroundColor(.tertiary)
        }
        .padding()
        .background(Color.gray.opacity(0.05))
        .cornerRadius(12)
    }
}
```

### Schedule Button

```swift
Button("Schedule Service") {
    handleScheduleClick(barber)
}
.buttonStyle(.primaryFull)
```

**Schedule Click Logic:**

```swift
func handleScheduleClick(_ barber: Barber) {
    guard authStore.isAuthenticated else {
        // Store barber for post-login redirect
        loginRedirectBarber = barber
        showLoginPrompt(action: .schedule)
        return
    }
    
    navigate(to: .scheduleService(barber: barber, filters: filterCriteria))
}
```

---

## Modals & Overlays

### 1. Profile Editor Modal

Full-screen modal for editing user profile:

```
┌────────────────────────────────────────┐
│ Edit Profile           [Delete] [×]    │
├────────────────────────────────────────┤
│                                        │
│  [Profile Photo]                       │
│  [Change Photo]                        │
│                                        │
│  First Name: [______________]          │
│  Last Name:  [______________]          │
│  Email:      [______________] (readonly)│
│  Phone:      [______________]          │
│                                        │
│  [Save Changes]                        │
│                                        │
└────────────────────────────────────────┘
```

### 2. Barber Application Modal

Form for applying to become a barber:

```
┌────────────────────────────────────────┐
│ Become a Barber                   [×]  │
├────────────────────────────────────────┤
│                                        │
│  Business Name: [______________]       │
│  Years of Experience: [____]           │
│  Instagram Handle: [______________]    │
│  Why do you want to join? (textarea)   │
│  [___________________________________] │
│  [___________________________________] │
│  [___________________________________] │
│                                        │
│  [Submit Application]                  │
│                                        │
└────────────────────────────────────────┘
```

### 3. Pending Application Popup

```
┌────────────────────────────────────────┐
│                                        │
│       Application Under Review         │
│                                        │
│  Please be patient as the campus       │
│  manager goes over your application.   │
│                                        │
│  If you suspect your application was   │
│  not sent, please contact              │
│  campuscuthelp@gmail.com              │
│                                        │
│           [Got it]                     │
│                                        │
└────────────────────────────────────────┘
```

### 4. Rejected Application Popup

```
┌────────────────────────────────────────┐
│            ✂️ (scissors icon)          │
│                                        │
│     Previous Application Rejected      │
│                                        │
│  Your previous application was not     │
│  approved. You can submit a new        │
│  application with updated information. │
│                                        │
│  Questions? Contact:                   │
│  campuscuthelp@gmail.com              │
│                                        │
│  [Maybe Later]  [Apply Again]          │
│                                        │
└────────────────────────────────────────┘
```

### 5. Login Prompt Modal

```
┌────────────────────────────────────────┐
│           Sign In Required             │
├────────────────────────────────────────┤
│                                        │
│  You need to sign in to [action]       │
│                                        │
│  [Sign In]  [Create Account]           │
│                                        │
│           [Cancel]                     │
│                                        │
└────────────────────────────────────────┘
```

**Actions:**
- `schedule`: "schedule a service with this barber"
- `becomeBarber`: "apply to become a barber"
- `general`: "continue"

### 6. Notifications Modal

```
┌────────────────────────────────────────┐
│ Notifications         [Mark all read]  │
│ 2 unread              [Delete all] [×] │
├────────────────────────────────────────┤
│                                        │
│ ┌────────────────────────────────────┐ │
│ │ ✓ Booking Confirmed          🔵   │ │
│ │   John accepted your booking      │ │
│ │   2h ago                          │ │
│ └────────────────────────────────────┘ │
│                                        │
│ ┌────────────────────────────────────┐ │
│ │ 💬 New Message                    │ │
│ │   Hey, I'll be there at 2pm!      │ │
│ │   Yesterday                       │ │
│ └────────────────────────────────────┘ │
│                                        │
│           [Close]                      │
│                                        │
└────────────────────────────────────────┘
```

**Notification Types & Icons:**

| Type | Icon | Color |
|------|------|-------|
| `booking_accepted` | ✓ (Check) | Green |
| `booking_rejected` | ⚠️ (Alert) | Red |
| `booking_cancelled` | ⚠️ (Alert) | Red |
| `new_booking_request` | 📅 (Calendar) | Primary |
| `new_message` | 💬 (Message) | Primary |
| `payment_request` | 💵 (Dollar) | Primary |
| Default | 🔔 (Bell) | Primary |

### 7. Payment Request Modal

Triggered by WebSocket when barber marks service complete:

```
┌────────────────────────────────────────┐
│        Payment Requested          [×]  │
├────────────────────────────────────────┤
│                                        │
│  [Barber Name] completed your          │
│  [Service Name]                        │
│                                        │
│  Amount Due: $30.00                    │
│                                        │
│  [Pay Now]                             │
│                                        │
└────────────────────────────────────────┘
```

### 8. Booking Declined Modal

```
┌────────────────────────────────────────┐
│         Booking Declined          [×]  │
├────────────────────────────────────────┤
│                                        │
│  [Barber Name] was unable to accept    │
│  your booking request.                 │
│                                        │
│  ┌─ Reason ────────────────────────┐  │
│  │ "Sorry, I have a conflict at   │  │
│  │  that time."                    │  │
│  └─────────────────────────────────┘  │
│                                        │
│  Think a mistake was made?             │
│  Contact: campuscuthelp@gmail.com     │
│                                        │
│       [Find Another Barber]            │
│                                        │
└────────────────────────────────────────┘
```

### 9. Alternative Barbers Modal

Shown when a barber cancels - offers other available barbers:

```
┌────────────────────────────────────────┐
│        Booking Cancelled          [×]  │
│   Find an available barber for this    │
├────────────────────────────────────────┤
│                                        │
│  [Barber Name] has cancelled your      │
│  appointment: "Had an emergency"       │
│                                        │
│  Original Time Slot                    │
│  Monday, March 15 at 2:00 PM           │
│                                        │
│  2 barbers available at this time:     │
│                                        │
│  ┌────────────────────────────────────┐│
│  │ 👤 Mike's Cuts     ⭐ 4.8    →   ││
│  └────────────────────────────────────┘│
│  ┌────────────────────────────────────┐│
│  │ 👤 Fresh Fades     ⭐ 4.5    →   ││
│  └────────────────────────────────────┘│
│                                        │
│  [Browse all barbers]                  │
│                                        │
│           [Close]                      │
│                                        │
└────────────────────────────────────────┘
```

---

## State Management

### Main State Variables

```swift
@Observable class ConsumerPageState {
    // Auth & User
    var user: User?
    var isAuthenticated: Bool
    
    // UI State
    var showProfileDropdown = false
    var showProfileEditor = false
    var showBarberApplication = false
    var showNotifications = false
    var showLoginPrompt = false
    var showPaymentModal = false
    var showDeclinedModal = false
    var showAlternativeBarbersModal = false
    
    // Application State
    var hasPendingApplication = false
    var hasRejectedApplication = false
    
    // Selected Data
    var selectedBarber: Barber?
    var paymentModalData: PaymentModalData?
    var declinedModalData: DeclinedModalData?
    var alternativeBarbersData: AlternativeBarbersData?
    
    // Notifications
    var notifications: [Notification] = []
    var unreadNotifications = 0
    var unreadMessages = 0
}
```

### Discovery View State

```swift
@Observable class DiscoveryViewState {
    // Data
    var barbers: [Barber] = []
    var filteredBarbers: [Barber] = []
    var selectedUniversity: University?
    
    // Filters
    var filterCriteria: FilterCriteria
    
    // UI
    var loading = true
    var selectedBarber: Barber?
    var loadingBarberDetails = false
    var reviewsExpanded = false
    var showLoginPrompt = false
    var loginPromptAction: LoginPromptAction = .general
    var loginRedirectBarber: Barber?
}

struct FilterCriteria {
    var serviceType: String?
    var date: Date?
    var time: String?
    var location: String?
    var locationDetails: String?
}
```

---

## Real-Time Features

### WebSocket Events

Connect on mount, disconnect on unmount:

```swift
override func viewDidAppear() {
    socketService.connect()
    
    socketService.on(.bookingCompleted) { [weak self] data in
        // Show payment modal
        self?.paymentModalData = PaymentModalData(
            bookingId: data.bookingId,
            barberName: data.barberName,
            serviceName: data.serviceName,
            amount: data.price
        )
        self?.showPaymentModal = true
    }
}

override func viewDidDisappear() {
    socketService.off(.bookingCompleted)
}
```

### Active Booking Check

On app launch/foreground, check for active bookings:

```swift
func checkActiveBookings() async {
    guard let user = authStore.user else { return }
    
    do {
        let bookings = try await api.get("/bookings-simple", role: "consumer")
        
        if let active = bookings.first(where: { $0.status == .pending || $0.status == .accepted }) {
            navigate(to: .bookingStatus(booking: active))
        }
    } catch {
        print("Failed to check active bookings: \(error)")
    }
}
```

---

## Responsive Behavior

### Grid Layout

```swift
var gridColumns: [GridItem] {
    if viewport.isMobilePortrait {
        return [GridItem(.flexible())]  // 1 column, horizontal cards
    } else if viewport.isMobile {
        return [GridItem(.flexible()), GridItem(.flexible())]  // 2 columns
    } else if viewport.isTablet {
        return Array(repeating: GridItem(.flexible()), count: 3)  // 3 columns
    } else {
        return Array(repeating: GridItem(.flexible()), count: 4)  // 4-5 columns
    }
}
```

### Modal Sizing

```swift
var modalMaxWidth: CGFloat {
    let hasRichContent = barber.weeklySchedule != nil || 
                         barber.bio != nil || 
                         barber.specialties.count > 3
    
    if hasRichContent {
        return min(screenWidth - 32, 768)
    } else {
        return min(screenWidth - 32, 448)
    }
}
```

### Pull-to-Refresh

Disabled when any modal is open:

```swift
var pullToRefreshDisabled: Bool {
    showProfileEditor || 
    showBarberApplication || 
    showNotifications || 
    showLoginPrompt || 
    showPaymentModal || 
    showDeclinedModal || 
    showAlternativeBarbersModal
}
```

---

## Animation Specifications

### Modal Transitions

```swift
// Fade background
.opacity(isVisible ? 1 : 0)
.animation(.easeOut(duration: 0.15), value: isVisible)

// Modal slide up
.offset(y: isVisible ? 0 : 20)
.scaleEffect(isVisible ? 1 : 0.95)
.opacity(isVisible ? 1 : 0)
.animation(.easeOut(duration: 0.15), value: isVisible)
```

### Card Press Effect

```swift
Button { ... }
    .scaleEffect(isPressed ? 0.98 : 1.0)
    .animation(.easeInOut(duration: 0.1), value: isPressed)
```

---

*Last updated: March 2026*
*Version: 1.0*

