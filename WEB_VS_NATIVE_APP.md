# Web vs native app — scope, limits, and benefits

*Audience: product, design, and investors. This frames **what a browser-based experience cannot fully replicate** and what a **native iOS** build adds. The main native advantages here are **notifications (APNs)**, **instant sign-in (Keychain + biometrics)**, and **UI/UX**; details below. Stack: [`TECH_STACK.md`](./TECH_STACK.md).*

---

## Definitions

| Term | Meaning here |
|------|----------------|
| **Web** | A site served over HTTPS (e.g. React + Vite), opened in **Safari, Chrome, or an in-app browser**. May be “installed” as a **PWA** to the home screen, but capabilities still depend on the OS and browser. |
| **Native app** | A **Store-distributed** binary (e.g. CampusCuts iOS, SwiftUI) using Apple’s system frameworks, push services, and secure storage. |

This is **not** a claim that the web is “worse” overall—many users should never need an app. The point is to **clarify tradeoffs** so roadmap and UX match expectations.

---

## Practical limits of a webpage (browser)

### Reachability and session lifecycle

- The user can **close the tab or switch apps** at any time. The page is **suspended** or torn down; work in progress (draft messages, in-flight payments) is easier to lose unless the product aggressively autosaves to your servers.
- **No guaranteed background execution**: long tasks, pollers, or “keep this socket open forever” patterns are throttled. Real-time **can** work (e.g. WebSockets while the tab is active), but not like a process that is always on.

### Notifications and re-engagement

- **Web push** is optional and varies by browser and permission UX on mobile Safari. It is not as **consistent, immediate, or trusted** as **Apple Push Notification (APNs)** for iOS.
- For **booking reminders, “barber accepted,” or payment nudges**, the web depends more on **email and SMS** (separate cost and user fatigue) to recover users who are not on the page.

### Identity, trust, and device binding

- Sessions usually rely on **cookies / localStorage / JWT in memory**. Users can **clear site data** or use private browsing; support flows for “I’m logged out on every open” are common.
- **Phishing** often targets **links that open a fake web login**. A **real app icon from the App Store** is a stronger anchor for “this is the official CampusCuts” than a look-alike domain in the address bar (though both need education).

### Hardware and system integration

- The web has a **growing** set of APIs (camera, geolocation, haptics in some cases), but access is **permission-gated**, **inconsistent across browsers**, and **weaker** than native for things like:
  - Tight **Camera / Photos** integration for barber portfolio uploads,
  - **Face ID / Touch ID** as a first-class, OS-level unlock for the app (beyond WebAuthn where supported),
  - **Siri, Shortcuts, Live Activities**, or future **wallet / tap-to-pay** experiences Apple exposes to apps first.

### Payments (cards)

- **Stripe** works well on the web (Stripe.js, hosted Checkout). **Apple Pay on the web** is constrained by **Safari and domain registration**; **Apple Pay in a native iOS app** is often a **smoother, fewer-tap** path for the same user with a card on file.

### Discovery and “always there”

- A website has **no icon on the home screen** unless the user adds one (PWA) or bookmarks—easy to **forget** compared to a **visible app tile**.
- **App Store** search and “you already downloaded this” create a **different acquisition and retention loop** than SEO + ads for a URL alone.

### Performance and “feel”

- Modern web apps are fast, but the **browser chrome**, **tab management**, and **JS bundle on cold load** can feel less **instant and fluid** than a well-built native list/chat screen, especially on aging phones or poor networks.

### Summary: web is ideal when…

- The user is **browsing, comparing, or sharing a link** (SEO, support articles, one-off barber pages).
- **No install** is a feature (funnel friction, “just pay this once,” campus kiosk).
- **Desktop barbers** prefer a full browser for portfolio and calendar work.

---

## Major benefits of the iOS app (summary)

The native iOS app is strongest on three dimensions:

1. **Notifications** — **Apple Push Notification service (APNs)**: reliable, high-visibility alerts for booking updates, messages, and time-sensitive nudges. The web (especially on iOS Safari) does not match the **consistency and immediacy** of APNs; re-engagement on the web leans more on email, SMS, or the user happening to return to the tab.
2. **Instant sign-in** — **Keychain**-backed session material and **Face ID / Touch ID** to reopen the app without re-typing passwords. Users are not re-authenticating on every visit the way a cleared cookie or new browser window often forces on the web. The app feels like **“always my device, always my session”** (until you explicitly sign out or revoke).
3. **UI/UX** — A **dedicated, full-screen** experience: no address bar, no tab stack, no competing tabs; **faster cold start** to “the product” on repeat opens; **native** navigation, scrolling, and keyboard behavior; a **home-screen icon** and App Store **trust** signal; smoother **in-app** flows (e.g. chat, booking, **Apple Pay in-app** where enabled) and fewer browser-specific edge cases.

Secondary advantages (supporting the three above) include: **App Review / TestFlight** as a verifiable install channel, **Socket.IO (or similar)** in a **foreground** app for chat while the user is active, and optional ties into **share sheets, calendar, and maps** when you build them in.

### When native is ideal

- The user is a **repeat booker** or **frequent messager** on **phone** and you care about **notify → open app → act** in minutes.
- You want **sign-in to disappear** for daily use (biometrics + Keychain) rather than feel like a **website** they log into repeatedly.
- You are optimizing **polish, speed to task, and fewer distractions** than a browser tab.

---

## Side-by-side (CampusCuts-oriented)

| Dimension | Web | Native iOS app |
|-----------|-----|----------------|
| **Notifications** | Email/SMS, bookmarks; web push limited on iOS Safari | **APNs** — primary re-engagement channel for time-sensitive updates |
| **Sign-in** | Cookies / storage; often re-auth after clear data or new device | **Keychain** + **Face ID / Touch ID** — “instant” return for daily users |
| **UI / UX** | Browser chrome, tabs, variable mobile behavior | Full-screen app, native feel, home-screen icon, fewer web-only edge cases |
| **Install friction** | None; share a link | App Store account, download size |
| **Payments** | Stripe.js / Checkout, Apple Pay (web rules) | Stripe SDK / **Apple Pay in-app** |
| **Trust / discovery** | URL + SEO | **App Store** listing + icon |
| **Real-time** | Great while tab is open | **Foreground** chat + **push** when away |
| **Barber on laptop** | Natural fit | Often secondary; companion |

---

## How to use this in planning

- Treat **web** as the **broad top of funnel** and **operations on desktop** (barbers, managers, marketing pages).
- Treat **iOS** as where you earn **notifications + instant sign-in + better mobile UI/UX** for **loyal, phone-first** users—not a requirement for every user.
- **Feature parity** is not always desirable: the same “limits” of the web (no forced install) are **benefits** for one-time users.

---

*This is a product/architecture document, not App Store or legal advice. For technical integration details, see `TECH_STACK.md` and the backend/web/ios folders.*
