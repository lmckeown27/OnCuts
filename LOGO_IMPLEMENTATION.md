# CampusCuts Logo Implementation Guide

## 🎨 Logos Overview

You provided 3 logo variants that have been integrated throughout the application:

- **Logo1.png** - Primary logo (default, used everywhere)
- **Logo2.png** - Alternative variant
- **Logo3.png** - Alternative variant

---

## ✅ Where Logos Are Implemented

### 1. **Navbar Component** (All Authenticated Pages)
- **Location:** `web-app/src/components/Navbar.tsx`
- **Logo Used:** Logo1 (via `CampusCutsLogo`)
- **Size:** `h-10` (40px height)
- **Replaces:** Scissors icon
- **Visible On:** All pages when user is logged in

### 2. **Role Selection Page** (Entry Point)
- **Location:** `web-app/src/pages/RoleSelectionPage.tsx`
- **Logo Used:** Logo1
- **Size:** `h-24` (96px height)
- **Replaces:** Scissors icon + "CampusCuts" text
- **Visible On:** `http://localhost:3000/`

### 3. **Consumer Discovery Page**
- **Location:** `web-app/src/pages/ConsumerPage.tsx`
- **Logo Used:** Logo1
- **Size:** `h-10` (40px height)
- **Replaces:** Users icon
- **Visible On:** `http://localhost:3000/consumer`

### 4. **Barber Dashboard Page**
- **Location:** `web-app/src/pages/BarberPage.tsx`
- **Logo Used:** Logo1
- **Size:** `h-10` (40px height)
- **Replaces:** UserCircle icon
- **Visible On:** `http://localhost:3000/barber`

### 5. **Admin Dashboard Page**
- **Location:** `web-app/src/pages/AdminPage.tsx`
- **Logo Used:** Logo1
- **Size:** `h-12` (48px height)
- **Replaces:** Shield icon
- **Special:** Includes vertical divider for visual separation
- **Visible On:** `http://localhost:3000/admin`

### 6. **PWA Manifest Icons**
- **Location:** `web-app/public/icon-192x192.png` & `icon-512x512.png`
- **Logo Used:** Logo1
- **Purpose:** App icons when installed as PWA
- **Sizes:** 192x192px and 512x512px

### 7. **Browser Favicon**
- **Location:** `web-app/index.html`
- **Logo Used:** Logo1 (via `icon-192x192.png`)
- **Purpose:** Browser tab icon
- **Visible On:** All pages in browser tab

---

## 📦 How to Use the Logos

### Importing

```typescript
// Default logo (Logo1)
import { CampusCutsLogo } from '@assets';

// Specific logos
import { Logo1, Logo2, Logo3 } from '@assets';
```

### Using in Components

```typescript
// Simple usage
<img src={CampusCutsLogo} alt="CampusCuts" className="h-10 w-auto" />

// With specific logo
<img src={Logo2} alt="CampusCuts" className="h-12 w-auto" />

// Responsive sizing
<img 
  src={CampusCutsLogo} 
  alt="CampusCuts" 
  className="h-8 md:h-10 lg:h-12 w-auto" 
/>
```

### Switching Between Logo Variants

To use Logo2 or Logo3 instead of Logo1 as the default:

**Option 1:** Update `src/assets/index.ts`
```typescript
// Change this line:
export { default as CampusCutsLogo } from './logos/Logo1.png';

// To:
export { default as CampusCutsLogo } from './logos/Logo2.png';
// or
export { default as CampusCutsLogo } from './logos/Logo3.png';
```

**Option 2:** Import specific logo in each component
```typescript
import { Logo2 } from '@assets';

<img src={Logo2} alt="CampusCuts" className="h-10 w-auto" />
```

---

## 🎨 Logo Sizing Guidelines

| Location | Size Class | Height (px) | Use Case |
|----------|-----------|-------------|----------|
| Navbar | `h-10` | 40px | Standard header navigation |
| Role Selection | `h-24` | 96px | Hero/welcome screen |
| Page Headers | `h-10` to `h-12` | 40-48px | Secondary page headers |
| Mobile | `h-8` | 32px | Mobile-optimized sizing |
| Favicon | `192x192` | 192px | Browser/PWA icons |

---

## 🔧 Configuration Files Modified

1. **`web-app/src/assets/index.ts`**
   - Added exports for Logo1, Logo2, Logo3
   - Set `CampusCutsLogo` as default (Logo1)

2. **`web-app/public/manifest.json`**
   - Updated icon paths from SVG to PNG
   - Changed to use Logo1 for all PWA icons

3. **`web-app/index.html`**
   - Updated favicon to use Logo1

4. **All page components**
   - Replaced icon-based branding with actual logo
   - Removed text-only "CampusCuts" where logo is present

---

## 🚀 Testing

Visit these URLs to see the logos in action:

1. **Role Selection:** `http://localhost:3000/`
   - Large logo at top center

2. **Consumer View:** `http://localhost:3000/consumer`
   - Logo in top-left header

3. **Barber View:** `http://localhost:3000/barber`
   - Logo in top-left header

4. **Admin View:** `http://localhost:3000/admin`
   - Logo in gradient header with divider

5. **Favicon:**
   - Check browser tab icon on any page

6. **PWA Icon:**
   - Install as PWA to see app icon

---

## 📝 Notes

- All logos are automatically optimized by Vite
- Logos maintain aspect ratio with `w-auto`
- Logo files are in PNG format for best compatibility
- Original logo files located in `web-app/src/assets/logos/`
- Public icons located in `web-app/public/`
- Path aliases (`@assets`) make imports clean and maintainable

---

## 🎯 Future Enhancements

If you want to add more logo variants:

1. Place new logo in `web-app/src/assets/logos/`
2. Add export in `web-app/src/assets/index.ts`:
   ```typescript
   export { default as Logo4 } from './logos/Logo4.png';
   ```
3. Import and use in components:
   ```typescript
   import { Logo4 } from '@assets';
   ```

---

**All logos are now live and integrated across the entire application!** 🎉

