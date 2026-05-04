# Barber dashboard on mobile — view and functionality

## 0. Two different “mobile barber” surfaces in this repo

| Route | Component | What you get on a phone |
|-------|-----------|-------------------------|
| **`/web/barber`** | **`BarberPage.tsx`** | **Full product:** header (Chats, inbox, profile), **Daily / Weekly / Monthly** schedule, real APIs, sockets, modals. Responsive: narrow width uses **list-style weekly** rows, **swipe** between schedule modes, etc. This is the surface **this document focuses on** (§1–§15). |
| **`/app/barber`** | **`MobileBarberPage.tsx`** | **Separate, simplified shell:** fixed layout, **bottom tabs** (Schedule · Requests · Earnings · Profile). **No Daily/Weekly/Monthly calendar**—only “Today’s Schedule” + placeholder **“View Calendar”**. **Booking requests** UI exists but **accept/decline only update local React state** (no `booking-requests` API calls in the handlers). Earnings and some copy are **static/demo**. Treat as **legacy / prototype** unless you wire it to the same APIs as `BarberPage`. See **§16**. |

---

The sections below describe **`BarberPage`** at **`/web/barber`**. Layout uses **Tailwind responsive classes** (`sm:`, `hidden sm:`, `sm:hidden`): phones use the **narrow / stacked** layouts; tablets and desktops often show **wider grids** for the same views.

**Primary source file:** `web-app/src/pages/BarberPage.tsx` (parent shell + header + modals) and the embedded **`DashboardView`** function (schedule: Daily / Weekly / Monthly).

---

## 1. Page shell and global mobile behavior

### Pull-to-refresh

- The page is wrapped in **`PullToRefresh`** (`onRefresh` → **`window.location.reload()`**).
- Pull-to-refresh is **disabled while any modal is open** (`isAnyModalOpen`), so gestures do not fight dialogs.

### Location

- **`useGeolocation()`** runs on the barber dashboard so the barber’s position can stay current for consumer discovery (not a visible “button”; automatic when the dashboard loads).

### Body scroll

- When modals that require it are open, **`useBodyScrollLock`** prevents background scrolling (see modal list in code: profile editor, services, campus manager, admin, chats, bookings, locations, availability, service details, notifications, booking details, payout settings, etc.).

---

## 2. Top header (mobile layout)

The header is a **white bar** with three conceptual zones:

| Zone | Mobile behavior |
|------|------------------|
| **Left** | **Chats** — pill button (`rounded-full`), primary styling, **Send** icon + label **“Chats”**. Navigates to **`/web/barber/messages`** or **`/app/barber/messages`**. Shows a **red badge** with unread count from **`useMessageStore`** (`unreadCount`, capped display **99+**). Tooltip/title: **“Consumer Chat”** (customer conversations). |
| **Center** | **CampusCut logo** — absolutely centered (`left-1/2 -translate-x-1/2`) so it stays centered between left and right clusters. |
| **Right** | **Booking requests inbox** (`BarberBookingRequestsDropdown`) + **Profile** (avatar + chevron). |

**Admin / Campus Manager badge:** the text badge (**Admin** / **Campus Manager**) is **`hidden sm:flex`** — it does **not** show on small phones; those roles still get the extra items **inside the profile dropdown**.

---

## 3. “Chats” button (consumer messages)

- **Action:** `navigate(\`${platformPrefix}/barber/messages\`)`.
- **Purpose:** Full-screen **Messages** experience for **barber ↔ consumer** threads (see `MessagesPage`, `isBarberView`).
- **Unread:** Badge reflects **`/messages/unread-count`** (via message store), not the inbox dropdown count.

---

## 4. Booking requests inbox (header “dropbox” / inbox control)

**Component:** `web-app/src/components/booking/BarberBookingRequestsDropdown.tsx`  
**Not** the profile menu — it is the **Inbox** control next to the avatar.

### Control appearance

- **Inbox icon** (`Inbox` from Lucide) in the header.
- **Badge** on the icon when there are pending requests (shows count, **`9+`** if more than nine).

### Opening the inbox (mobile / tablet)

- **`useViewport()`:** on **`isMobile || isTablet`**, opening the dropdown uses a **full-screen-style backdrop** and **`useBodyScrollLock(true)`** while open so the page does not scroll behind it.
- Desktop: dropdown panel without that backdrop behavior.

### Data and realtime

- **Load:** `GET /booking-requests/barber/:barberId/pending` (with cache-buster query param).
- **Socket:** subscribes to **`socketService.onNewBookingRequest`** — toast **“New booking request…”** and list refresh.

### Per-request actions

- **View** request → opens a **detail modal** (customer summary, service, time, price, location, message).
- **Accept:** `POST /booking-requests/:bookingId/accept` with body **`{ barberId, message: 'Looking forward to seeing you!' }`** (fixed default message in UI).
- **Decline:** opens **decline modal** with preset reasons (*Schedule conflict*, *Fully booked for this day*, *Too far from my service area*, *Service not available at this time*, *Other*) + optional custom text → **`POST /booking-requests/:bookingId/reject`** with **`{ barberId, reason }`**.

### After accept / decline

- List refetches; toasts confirm success (with fallback “mock” copy on error paths in code).

---

## 5. Profile dropdown (avatar + chevron)

**Trigger:** Avatar + **`ChevronDown`** (rotates when open). **Close:** click outside (`dropdownRef`) or after choosing an item.

**Menu items (typical barber):**

1. **Switch to Consumer** → `navigate(\`${platformPrefix}/consumer\`)`.
2. **Edit Profile** → opens **`BarberProfileEditor`** modal (photo, bio, Instagram, specialties, hide profile).
3. **Services** → **`BarberServiceSpecialties`** modal (toggle services, prices).
4. **Locations** → **`BarberLocationsModal`** (assigned / pending / request locations).
5. **Bookings** → **`BookingsModal`** (list with tabs — see §10).
6. **Availability** → weekly **`AvailabilityModal`** (multi-interval per day).
7. **Block Time** → **`BlockTimeModal`** (one-off busy window).
8. **Notifications** → notifications modal; **unread count badge** on the row when `unreadNotifications > 0`.
9. **Payout Settings** → **`PaymentManagementModal`** (Stripe Connect + summary).
10. **Barber Chats** — shown for **non–campus-manager** barbers (and also under CM section for CMs): opens **`BarberChatsModal`** (campus peers); picking someone starts or opens a thread and may **`navigate(.../barber/messages/:conversationId)`**.
11. **Admin Dashboard** / **Campus Manager** entries when roles apply.
12. **Privacy** / **Terms** links.
13. **Sign Out** → `logout()` then **`navigate('/web')`** (fixed path in code, not `platformPrefix`).

---

## 6. Schedule card — Daily, Weekly, Monthly

The main **dashboard card** is the first large **`Card`** inside **`DashboardView`**. The schedule area uses **`touch-pan-y`** and touch handlers for horizontal gestures (see §6.5).

### 6.1 “Jump back” chip

When the barber has navigated away from “now”:

- **Daily** with `dayOffset !== 0`, **Weekly** with `weekOffset !== 0`, or **Monthly** with `monthOffset !== 0` → a button appears: **Today** / **This Week** / **This Month** (resets the corresponding offset to `0`).

### 6.2 Appointment summary line

Centered text, counts **visible** confirmed bookings (respects **hidden paid** IDs — see §10):

- **Daily:** `N appointment(s)` for the **selected calendar day** (campus timezone).
- **Weekly:** `N appointment(s) this week` or **`that week`** when `weekOffset ≠ 0`.
- **Monthly:** `N appointment(s) this month` / **`that month`** when `monthOffset ≠ 0`.

### 6.3 View toggle (Daily | Weekly | Monthly)

- **Three equal buttons** in a `grid-cols-3` row (`Daily`, `Weekly`, `Monthly`).
- Active view: **primary** background; inactive: gray.

### 6.4 Date navigation (chevrons)

- **Daily:** **Previous / next day** (`dayOffset` ±1). Title shows **Today -** / **Tomorrow -** / **Yesterday -** when applicable, plus **full weekday + date** (campus-local).
- **Weekly:** **Previous / next week** (`weekOffset` ±1). Title shows **week range** (e.g. `January 6 - 12, 2025` or cross-month variant).
- **Monthly:** **Previous / next month** (`monthOffset` ±1). Title shows **month + year**.

All date logic for “today” and labels uses **`getTodayInCampusTimezone()`** derived from the barber profile’s **`campusTimezone`** (default `America/Los_Angeles`).

### 6.5 Mobile gestures and hints

- **Swipe on schedule container:** **`handleTouchStart` / `handleTouchEnd`** — if horizontal movement **> 50px** and clearly horizontal vs vertical, **swipe left** advances **`scheduleView`** in order **Daily → Weekly → Monthly**; **swipe right** goes backward. Order is fixed: `['daily','weekly','monthly']`.
- **Trackpad horizontal wheel** on the same container (non-passive listener): scroll left/right switches views with debounce (**300ms**).
- **Mobile-only dots** (`sm:hidden`) under the schedule card: three dots showing **which of Daily / Weekly / Monthly** is active (visual hint for swipe).

---

## 7. Daily view (mobile)

### Data

- **Bookings:** filtered from **`visibleConfirmedBookings`** for the selected day, sorted by time (`GET /bookings-simple` with role/range as implemented in `DashboardView`).
- **Weekly availability:** `GET /barbers/:id/availability` → **`weeklySchedule`**; supports **`intervals[]`** or legacy **`start`/`end`** per weekday.
- **Manual time blocks:** `GET /barbers/:id/time-blocks` for the **displayed month** (used to mark blocked hours on the selected day).
- **Google Calendar busy times:** when connected, busy ranges for a rolling window (updates with offsets).

### Empty day (no availability)

- Message: not available that weekday + **Add Availability** (calls **`onEditAvailability`**).

### When availability exists

1. **Edit Availability** — prominent button; copy **“Tap here to Edit Availability”** on small screens, **“Click here…”** on `sm+`.
2. **Hourly slot list** — generated from availability intervals (hour buckets).

**Each hour row can be:**

| State | Appearance / action |
|--------|----------------------|
| **Booked** | Blue/green card (green if completed/PAID). Shows time range, customer name, service, price. **Tap** → **`onViewDetails(appointment)`** opens **`BookingDetailsModal`** (not the day modal). |
| **Manually blocked** | Red styling, **Unblock** button → **`onUnblockTime(block.id)`** → API delete time block. |
| **Google Calendar busy** | Blue “Google Calendar” row — **no unblock** from CampusCuts. |
| **Available** | Primary-tint row; **“Tap to block”** on mobile — tap calls **`onBlockTime(dateStr, slot.start, slot.end)`** to open **`BlockTimeModal`** prefilled. |

**Google connect row** in daily view exists in markup but is wrapped in **`hidden`** (feature hidden in UI; backend hooks remain).

### Summary counts (daily)

Footer-style counts: **available**, **booked**, **blocked** slot counts (for the hourly model).

---

## 8. Weekly view — mobile (`sm:hidden`)

Not the 7-column desktop grid — phones get a **vertical list** of **seven rows** (Monday-start week + `weekOffset`).

Each row:

- **Large day number**, short month if it differs from week start, **weekday name**.
- **Today** row: **primary** background (white text).
- Summary lines: **completed**, **booked** (accepted), **blocked** (manual blocks), **calendar** (Google busy day count), or **No appointments**.
- **Chevron** on the right (rotated) as affordance.
- **Tap row** → **`handleDayClick`** → **day modal** for that date (appointments + slot editor pattern; see §9).

**Desktop (`hidden sm:grid`):** seven **column cards** with the same click → day modal behavior.

---

## 9. Monthly view — mobile

- **Calendar grid** for the month (`monthOffset`): padding cells for start weekday, then day **1…N**.
- **Today** cell highlighted.
- Cells can show compact counts: completed, booked, blocked, etc. (implementation mixes mobile/desktop density in the same grid).
- **Tap a day** → **day modal** if it has content / interaction (same `handleDayClick` flow as weekly).

### Day modal (`showDayModal`)

- Full-screen overlay on small viewports; **scroll** behavior: opening scrolls to **bottom of document** to reduce accidental pull-to-refresh; closing scrolls **to top**.
- **Header:** selected date or **Booking Details** when drilling into one booking.
- **List** of that day’s appointments; **tap booking** → **inline booking panel** (`selectedBookingInline`) with:
  - Back to list
  - **Edit** date/time/location (`PUT /bookings-simple/:id`)
  - **Cancel** (`DELETE` with optional reason)
  - **Mark complete** / **Request payment** / **Remove from schedule** / **Undo complete** (same `bookings-simple` API family as desktop)
  - Customer notes, review display when applicable
- **Hourly slots** for that day also appear in the modal path (block / unblock / Google / open block time) mirroring daily logic.

---

## 10. Bookings modal (from profile → “Bookings”)

**Component:** `BookingsModal` in `BarberPage.tsx`.

- **Fetch:** `GET /bookings-simple?role=barber`, filtered to **ACCEPTED**, **COMPLETED**, **PAID**.
- **Tabs:** **Today** | **Upcoming** | **Past** (chip-style filters).
  - **Today:** accepted bookings whose **`scheduledTime`** is today.
  - **Upcoming:** accepted, **future**, not today.
  - **Past:** PAID, or COMPLETED (awaiting payment), or **accepted** appointments whose time is **in the past** and not “today”.
- **Mark complete** on eligible rows (`PUT .../complete`).
- **Past / paid rows:** optional **hide from list** — persists in **`localStorage`** (`campuscuts_barber_hidden_paid_bookings_${barberId}`); hidden IDs are also excluded from **schedule slot lists** via `visibleConfirmedBookings`.

---

## 11. Notifications (profile → “Notifications”)

- **Fetch:** notifications API + unread count.
- **Filters:** All, Bookings, Payments, Reviews, Cancelled, Messages (horizontal scroll chips).
- **Actions:** mark one read, **mark all read**, **delete all**, **Close**.
- **Tap:** e.g. message notifications with `conversationId` → **`/barber/messages/:id`**.

---

## 12. Other modals reachable from the dashboard (mobile-relevant)

| Entry | Behavior |
|--------|----------|
| **Payout Settings** | Stripe Connect status, onboarding link, dashboard link, payout summary copy. |
| **Barber Chats** | Peer barbers on campus; opens thread in **Messages** route. |
| **BookingDetailsModal** | Opened from **tapping a booked slot** in **Daily** view (`onViewDetails`). |
| **ServiceDetailsModal** | When `selectedAppointment` is set from parent flows. |
| **BlockTimeModal** | From profile or from tapping an **available** slot. |

---

## 13. Realtime (mobile experience)

`DashboardView` attaches socket listeners (when `barberProfileId` exists) for example:

- Booking updates / confirmed / payment received → refresh or patch lists.
- **Time block** create/delete → update `monthlyTimeBlocks` toasts.
- **Availability update** → refresh weekly schedule + toast.

Together with the inbox socket, this keeps **requests** and **schedule** current without manual refresh (pull-to-refresh still available).

---

## 14. Routes and platform notes

| Path | Role |
|------|------|
| `/web/barber` | Web platform guard; **full `BarberPage`** barber dashboard. |
| `/app/barber` | App platform guard; **`MobileBarberPage`** (different UI — §16). |

On **`BarberPage`**, **`platformPrefix`** is **`/app`** when the path starts with **`/app`**, else **`/web`**, so deep links (e.g. messages) match the current shell. **`MobileBarberPage`** builds the same prefix for **Switch to Student** and a few **navigate** targets (`…/barber/services`, `…/barber/availability`) that may **not** have matching routes—verify `App.tsx` before relying on them.

---

## 15. Summary table — header vs schedule

| UI element | Mobile notes |
|------------|----------------|
| **Chats** | Left pill; unread badge; opens **consumer** messages list. |
| **Logo** | Centered. |
| **Inbox** | Pending **booking requests**; accept/decline; backdrop + scroll lock on phone/tablet. |
| **Profile** | Avatar + chevron; full settings tree; notifications inside menu. |
| **Daily** | Hourly list; tap booking → details modal; tap free slot → block; unblock manual blocks. |
| **Weekly** | **List of 7 days**; tap → day modal. |
| **Monthly** | Month grid; tap day → day modal. |
| **Swipe / dots** | Change Daily/Weekly/Monthly; dots only on **`sm:hidden`**. |
| **Pull to refresh** | Full page reload when not in a modal. |

---

## 16. `/app/barber` — `MobileBarberPage` (prototype shell)

**File:** `web-app/src/pages/mobile/MobileBarberPage.tsx`

- **Header:** Logo + static campus line + **`MoreVertical`** menu button (**not** wired to actions in the excerpted code).
- **Quick stats row:** Three tiles — **Today** / **This Week** (earnings) / **Appointments** — **`todayEarnings` and `weekEarnings` are hardcoded `0`**; appointment count is **`appointments.length`** (array defaults empty unless populated elsewhere).
- **Bottom navigation (four tabs):**
  1. **Schedule** — “Today’s Schedule” title, non-functional **“View Calendar”** link, list of **`appointments`** cards (empty by default).
  2. **Requests** — Pending count; cards with **Decline** / **Accept**; tap opens **bottom sheet** with details and **Decline** / **Accept Booking**. **`handleAcceptRequest` / `handleRejectRequest`** only **`filter`** local state — **no backend**.
  3. **Earnings** — Gradient “Total Earnings” card and **placeholder** “Recent Payments” rows.
  4. **Profile** — **`MobilePhotoUpload`**, name/email, rows for **Edit Full Profile** (`BarberProfileEditor`), **Services**, **Availability**, **Block Time** (`BlockTimeModal` when `barberProfileId` is set), **Switch to Student**.
- **Swipe animation:** `handleSwipeRequest` applies CSS translate then removes the card after timeout — still **local-only** for requests.

**Auth:** Redirects to consumer if user is not barber / CM / admin / `has_barber_profile`.

---

*Generated from `BarberPage.tsx`, `MobileBarberPage.tsx`, `BarberBookingRequestsDropdown.tsx`, and related components as of the repo state when this document was written.*
