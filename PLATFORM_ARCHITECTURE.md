# CampusCuts Platform Architecture

## 🏗️ Dual Platform Design

CampusCuts operates as **ONE codebase** with **TWO isolated platforms**:

1. **Web Platform** (`/web/*`) - Browser-based experience
2. **App Platform** (`/app/*`) - PWA/dApp installable experience

---

## 🎯 Platform Isolation

### **Key Principle:**
Users who choose **Web** stay in `/web/*` routes.  
Users who choose **App** stay in `/app/*` routes.  
**No cross-platform navigation.**

---

## 🗺️ Route Structure

### **Landing Page** (Shared)
```
/                    → Landing page (choose Web or App)
/install             → Installation instructions
/clear-cache.html    → Cache management tool
/generate-icons.html → Icon generator tool
```

### **Web Platform Routes** (`/web/*`)
```
/web                          → Role selection (Admin/Consumer/Barber)

Admin:
/web/admin                    → Campus management
/web/admin/system-health      → System health monitoring
/web/admin/gas-wallet         → Gas wallet management
/web/admin/marketplace        → Marketplace config
/web/admin/fraud              → Fraud detection
/web/admin/pricing            → Pricing management
/web/admin/user/:userId       → User management

Consumer:
/web/consumer                 → Consumer dashboard
/web/discover                 → Browse barbers
/web/student/barbers/:id      → Barber profile
/web/student/booking/payment  → Payment page

Barber:
/web/barber                   → Barber dashboard
/web/barber/earnings          → Earnings & payouts
/web/barber/service-history   → Service history
/web/barber/appointment/:id   → Appointment details

Wallet:
/web/wallet                   → Wallet management
```

### **App Platform Routes** (`/app/*`)
```
/app                          → Role selection (Admin/Consumer/Barber)
/app/install                  → Installation guide

Admin:
/app/admin                    → Campus management
/app/admin/system-health      → System health monitoring
/app/admin/gas-wallet         → Gas wallet management
/app/admin/marketplace        → Marketplace config
/app/admin/fraud              → Fraud detection
/app/admin/pricing            → Pricing management
/app/admin/user/:userId       → User management

Consumer:
/app/consumer                 → Consumer dashboard
/app/discover                 → Browse barbers
/app/student/barbers/:id      → Barber profile
/app/student/booking/payment  → Payment page

Barber:
/app/barber                   → Barber dashboard
/app/barber/earnings          → Earnings & payouts
/app/barber/service-history   → Service history
/app/barber/appointment/:id   → Appointment details

Wallet:
/app/wallet                   → Wallet management
```

---

## 🛡️ Platform Guard

### **How It Works:**

```typescript
<PlatformGuard requiredPlatform="web">
  <ConsumerPage />
</PlatformGuard>
```

**Protection:**
- ✅ Users on `/web/consumer` stay on web platform
- ✅ Users on `/app/consumer` stay on app platform
- 🚫 Attempting to access `/app/*` from web → redirected to `/web`
- 🚫 Attempting to access `/web/*` from app → redirected to `/app`

---

## 🔄 Navigation Patterns

### **Within a Platform:**

**Web Platform:**
```typescript
// From /web/consumer
navigate('/web/discover');  // ✅ Stays in web
navigate('/web/barber');    // ✅ Stays in web
```

**App Platform:**
```typescript
// From /app/consumer
navigate('/app/discover');  // ✅ Stays in app
navigate('/app/barber');    // ✅ Stays in app
```

### **Helper Hook:**

```typescript
import { usePlatformRoute } from './components/PlatformGuard';

function MyComponent() {
  const platformRoute = usePlatformRoute();
  
  // Automatically prefixes with current platform
  navigate(platformRoute('/consumer')); 
  // If on /web → navigates to /web/consumer
  // If on /app → navigates to /app/consumer
}
```

---

## 🎨 Platform-Specific Features

### **Web Platform** (`/web/*`)

**Characteristics:**
- Standard browser experience
- Opens in browser tabs
- Regular navigation
- Can be bookmarked
- No service worker in development
- Service worker only in production

**UI Elements:**
- Standard browser chrome
- No install prompts
- No app status indicators

### **App Platform** (`/app/*`)

**Characteristics:**
- PWA/dApp experience
- Can be installed
- Runs in standalone window
- App icon on home screen
- Works offline (when installed)
- Service worker active in production

**UI Elements:**
- Install prompts
- App status indicators (online/offline)
- Update notifications
- Native app feel
- Haptic feedback

---

## 📦 Shared Components

Both platforms use the **same components**:

```
Shared Across Platforms:
├─ ConsumerPage.tsx
├─ BarberPage.tsx
├─ AdminCampusesPage.tsx
├─ All other pages
└─ All components
```

**The difference is NOT in the code, but in the CONTEXT:**
- `/web/consumer` → ConsumerPage with web navigation
- `/app/consumer` → ConsumerPage with app navigation + PWA features

---

## 🔑 Key Differences

| Aspect | Web Platform | App Platform |
|--------|--------------|--------------|
| **URL Prefix** | `/web/*` | `/app/*` |
| **Service Worker** | Only production | Only production |
| **Install Prompt** | ❌ No | ✅ Yes |
| **Offline Support** | ❌ No | ✅ Yes (when installed) |
| **App Status** | ❌ No | ✅ Yes |
| **Standalone Mode** | ❌ No | ✅ Yes (when installed) |
| **Push Notifications** | ❌ No | ✅ Yes (when installed) |
| **Navigation** | Browser tabs | App navigation |

---

## 🚀 User Flows

### **Web Platform Flow:**

```
Landing Page (/)
      ↓
Click "Launch Web App"
      ↓
Role Selection (/web)
      ↓
Choose Role (Admin/Consumer/Barber)
      ↓
Navigate within /web/* routes
      ↓
All navigation stays in /web/* context
```

### **App Platform Flow:**

```
Landing Page (/)
      ↓
Click "Download App" → /install
      ↓
Install PWA on device
      ↓
Open installed app → /app
      ↓
Role Selection (/app)
      ↓
Choose Role (Admin/Consumer/Barber)
      ↓
Navigate within /app/* routes
      ↓
All navigation stays in /app/* context
      ↓
Works offline, shows status, can receive notifications
```

---

## 🧩 Technical Implementation

### **Platform Detection:**

```typescript
import { usePlatform } from './components/PlatformGuard';

function MyComponent() {
  const platform = usePlatform(); // 'web' | 'app' | null
  
  if (platform === 'web') {
    // Web-specific logic
  } else if (platform === 'app') {
    // App-specific logic
  }
}
```

### **Platform-Aware Routing:**

```typescript
import { usePlatformRoute } from './components/PlatformGuard';

function MyComponent() {
  const navigate = useNavigate();
  const platformRoute = usePlatformRoute();
  
  // This automatically handles platform prefix
  const goToConsumer = () => {
    navigate(platformRoute('/consumer'));
  };
}
```

---

## 📱 PWA Features (App Platform Only)

### **Service Worker:**
- Caches assets for offline use
- Only active in production
- Disabled in development to prevent caching issues

### **Installation:**
- One-click install on Android/Desktop
- Add to Home Screen on iOS
- Custom install instructions page

### **Offline Support:**
- Cached pages work without internet
- Offline fallback page
- Background sync for queued actions

### **App Features:**
- Push notifications
- App badges
- Haptic feedback
- Native share API

---

## 🔒 Benefits of Isolation

### **1. Clear Separation:**
- Web users get browser experience
- App users get native app experience
- No confusion about which platform you're on

### **2. PWA Features Only When Needed:**
- Service worker doesn't interfere with web dev
- Install prompts only show in app context
- Status indicators only in app context

### **3. Different Analytics:**
- Track web usage separately from app usage
- Measure PWA adoption
- Compare platform engagement

### **4. Future Flexibility:**
- Can add platform-specific features
- Can optimize each platform independently
- Can deploy updates to one platform at a time

---

## 🐛 Debugging

### **Check Current Platform:**
```javascript
// In browser console
console.log('Platform:', window.location.pathname.startsWith('/web') ? 'Web' : 
                        window.location.pathname.startsWith('/app') ? 'App' : 'Landing');
```

### **Clear All Cache:**
```
Navigate to: http://localhost:3000/clear-cache.html
Click: "Clear All Cache & Restart"
```

### **Verify Route Isolation:**
```
1. Go to /web/consumer
2. Try to navigate to /app/barber
3. Should redirect back to /web
```

---

## 📝 Development Guidelines

### **When Adding New Routes:**

1. **Add to BOTH platforms:**
```typescript
// Web version
<Route path="/web/new-feature" element={<PlatformGuard requiredPlatform="web"><NewFeature /></PlatformGuard>} />

// App version
<Route path="/app/new-feature" element={<PlatformGuard requiredPlatform="app"><NewFeature /></PlatformGuard>} />
```

2. **Use platform-aware navigation:**
```typescript
const platformRoute = usePlatformRoute();
navigate(platformRoute('/new-feature'));
```

3. **Test both platforms:**
- Test on `/web/new-feature`
- Test on `/app/new-feature`
- Verify isolation works

---

## 🎯 Summary

- ✅ **ONE codebase** → Same components for both platforms
- ✅ **TWO experiences** → Web browser vs PWA/dApp
- ✅ **Complete isolation** → Web routes stay in `/web/*`, App routes stay in `/app/*`
- ✅ **Platform Guard** → Prevents cross-platform navigation
- ✅ **Shared code** → No duplication, just different contexts
- ✅ **Clear separation** → Users know which platform they're on

**The platforms are NOT separate apps - they're the same app with different entry points and isolated route contexts.**

