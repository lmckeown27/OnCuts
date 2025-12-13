# CampusCuts Color System Documentation
## Olive Green Brand Identity

**Version:** 1.0  
**Last Updated:** December 12, 2025  
**Status:** Active

---

## Overview

CampusCuts uses the **CampusKinect color system** centered around **olive green (#708d81)** as the primary brand color, complemented by **neutral greys** for backgrounds and **semantic colors** for user feedback.

### Design Philosophy

```
Primary Brand → Olive Green (#708d81)
├── Communicates: Campus, Natural, Academic
├── Usage: Buttons, headers, active states, brand elements
└── Psychology: Trust, Growth, Stability

Backgrounds → Grey Spectrum (#525252)
├── Communicates: Modern, Professional, Content-focused
├── Usage: App backgrounds, cards, containers
└── Psychology: Neutral, Clean, Sophisticated

Accents → Semantic Colors
├── Success → Green (#22c55e)
├── Warning → Amber (#f59e0b)
├── Error → Red (#ef4444)
└── Info → Blue (#3b82f6)
```

---

## Color Palette

### Primary Colors (Olive Green Spectrum)

| Shade | Hex Code | RGB | Usage |
|-------|----------|-----|-------|
| **50** | `#f2f5f4` | `rgb(242, 245, 244)` | Very light backgrounds, hover states |
| **100** | `#e6ebea` | `rgb(230, 235, 234)` | Light backgrounds, inactive states |
| **200** | `#bfcdc8` | `rgb(191, 205, 200)` | Subtle borders, dividers |
| **300** | `#99afa7` | `rgb(153, 175, 167)` | Secondary text on light backgrounds |
| **400** | `#708d81` | `rgb(112, 141, 129)` | **PRIMARY BRAND COLOR** |
| **500** | `#5a7268` | `rgb(90, 114, 104)` | Hover states, pressed buttons |
| **600** | `#445750` | `rgb(68, 87, 80)` | Dark accents, borders |
| **700** | `#2e3c38` | `rgb(46, 60, 56)` | Very dark accents |
| **800** | `#172120` | `rgb(23, 33, 32)` | Near-black backgrounds |
| **900** | `#0b1110` | `rgb(11, 17, 16)` | Absolute darkest |

### Neutral Colors (Grey Spectrum)

| Shade | Hex Code | RGB | Usage |
|-------|----------|-----|-------|
| **50** | `#fafafa` | `rgb(250, 250, 250)` | Pure white alternatives |
| **100** | `#f5f5f5` | `rgb(245, 245, 245)` | Light card backgrounds |
| **200** | `#e5e5e5` | `rgb(229, 229, 229)` | Borders, dividers |
| **300** | `#d4d4d4` | `rgb(212, 212, 212)` | Disabled text |
| **400** | `#a3a3a3` | `rgb(163, 163, 163)` | Secondary text |
| **500** | `#737373` | `rgb(115, 115, 115)` | Medium grey accents |
| **600** | `#525252` | `rgb(82, 82, 82)` | **MAIN BACKGROUND** |
| **700** | `#404040` | `rgb(64, 64, 64)` | Card backgrounds |
| **800** | `#262626` | `rgb(38, 38, 38)` | Very dark elements |
| **900** | `#171717` | `rgb(23, 23, 23)` | Near-black |

### Semantic Colors

| Color | Hex Code | Usage |
|-------|----------|-------|
| **Success** | `#22c55e` | Success messages, confirmations, completed actions |
| **Warning** | `#f59e0b` | Warnings, cautionary alerts, pending actions |
| **Error** | `#ef4444` | Error messages, validation failures, critical alerts |
| **Info** | `#3b82f6` | Informational messages, help text, tips |

---

## Implementation

### Tailwind Configuration

**Location:** `web-app/tailwind.config.cjs`

```javascript
colors: {
  primary: {
    DEFAULT: '#708d81',
    50: '#f2f5f4',
    100: '#e6ebea',
    400: '#708d81',  // Main
    500: '#5a7268',  // Hover
    600: '#445750',  // Pressed
  },
  neutral: {
    600: '#525252',  // Main background
    700: '#404040',  // Card background
  },
  olive: {
    DEFAULT: '#708d81',
    // ... full scale
  }
}
```

### CSS Variables

**Location:** `web-app/src/index.css`

```css
:root {
  /* Primary Olive Green */
  --color-primary: #708d81;
  --color-primary-400: #708d81;
  --color-primary-500: #5a7268;
  
  /* Neutral Greys */
  --color-neutral-600: #525252;
  --color-neutral-700: #404040;
  
  /* Semantic Colors */
  --color-success: #22c55e;
  --color-warning: #f59e0b;
  --color-error: #ef4444;
}
```

### TypeScript Colors Utility

**Location:** `web-app/src/utils/colors.ts`

```typescript
export const colors = {
  primary: {
    DEFAULT: '#708d81',
    400: '#708d81',  // Main
    500: '#5a7268',  // Hover
    600: '#445750',  // Pressed
  },
  semantic: {
    primary: '#708d81',
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
  },
};

export const colorCombinations = {
  primaryButton: {
    bg: '#708d81',
    hoverBg: '#5a7268',
    activeBg: '#445750',
    text: '#ffffff',
  },
};
```

---

## Component Usage

### Buttons

#### Primary Action Button

```tsx
<button className="bg-primary-400 hover:bg-primary-500 active:bg-primary-600 text-white">
  Submit
</button>
```

**States:**
- **Default:** `#708d81` (primary-400)
- **Hover:** `#5a7268` (primary-500)
- **Pressed:** `#445750` (primary-600)
- **Disabled:** `#d4d4d4` (neutral-300)

#### Secondary Button

```tsx
<button className="bg-neutral-200 hover:bg-neutral-300 text-neutral-900">
  Cancel
</button>
```

### Cards

```tsx
<div className="bg-neutral-700 border border-neutral-600 rounded-lg">
  {/* Card content with white text */}
</div>
```

### Navigation

```tsx
<nav className="bg-neutral-600 border-t border-primary-400">
  <Link className="text-primary-400 hover:text-primary-500">
    Home
  </Link>
</nav>
```

### Forms

```tsx
<input 
  className="
    bg-neutral-700 
    text-white 
    border border-neutral-600
    focus:border-primary-400
  "
/>
```

### Status Badges

```tsx
{/* Success */}
<span className="bg-green-100 text-green-800 border border-green-500">
  Completed
</span>

{/* Warning */}
<span className="bg-amber-100 text-amber-800 border border-amber-500">
  Pending
</span>

{/* Error */}
<span className="bg-red-100 text-red-800 border border-red-500">
  Failed
</span>
```

---

## Accessibility

### WCAG Compliance

**Target:** WCAG 2.1 Level AA

**Requirements:**
- **Normal Text (< 18pt):** 4.5:1 contrast ratio
- **Large Text (≥ 18pt):** 3:1 contrast ratio
- **UI Components:** 3:1 contrast ratio

### Contrast Ratios

| Foreground | Background | Ratio | Status |
|------------|------------|-------|--------|
| White | `#708d81` (primary) | 3.2:1 | ✅ Large text |
| White | `#5a7268` (primary-500) | 4.6:1 | ✅ All text |
| White | `#525252` (neutral-600) | 7.1:1 | ✅ All text |
| `#737373` | White | 4.7:1 | ✅ All text |
| `#708d81` | White | 3.2:1 | ✅ Large text |
| `#5a7268` | White | 4.6:1 | ✅ All text |

### Color Blindness

**Considerations:**
- Don't rely solely on olive for critical information
- Use icons, text labels, and patterns
- Semantic colors (red/amber) remain distinguishable
- Success/error states include icons (✅/❌)

---

## Visual Examples

### Button States

```
┌─────────────────────┐
│   Default State     │  bg-primary-400 (#708d81)
└─────────────────────┘

┌─────────────────────┐
│   Hover State       │  bg-primary-500 (#5a7268)
└─────────────────────┘

┌─────────────────────┐
│   Pressed State     │  bg-primary-600 (#445750)
└─────────────────────┘

┌─────────────────────┐
│   Disabled State    │  bg-neutral-300 (#d4d4d4, 40% opacity)
└─────────────────────┘
```

### Card Layout

```
╔═══════════════════════════════════════╗
║  neutral-700 (#404040)                ║
║  ┌─────────────────────────────────┐  ║
║  │ White text (#ffffff)            │  ║
║  │ Secondary text: neutral-400     │  ║
║  │                                 │  ║
║  │ [Button: primary-400]           │  ║
║  └─────────────────────────────────┘  ║
╚═══════════════════════════════════════╝
 border-neutral-600 (#525252)
```

### Navigation

```
┌─────────────────────────────────────────┐
│  neutral-600 (#525252) background       │
├─────────────────────────────────────────┤
│  🏠 Home    primary-400 (active)        │
│  🔍 Discover  neutral-400 (inactive)     │
│  💬 Messages  neutral-400 (inactive)     │
└─────────────────────────────────────────┘
 border-top: primary-400
```

---

## Brand Identity

### Why Olive Green?

1. **Campus Connection:** Evokes natural campus environments, trees, and outdoor spaces
2. **Academic Heritage:** Traditional university color that feels institutional yet approachable
3. **Differentiation:** Stands out from typical blue/red social platforms
4. **Versatility:** Works well with both light and dark backgrounds
5. **Gender Neutral:** Appeals broadly across demographics

### Brand Associations

- 🌳 **Nature & Growth** - Campus green spaces, development
- 📚 **Learning & Wisdom** - Academic tradition
- 🤝 **Community & Trust** - Reliable platform
- ⚖️ **Balance & Stability** - Fair marketplace

### Background Grey Philosophy

Unlike many platforms using white backgrounds, CampusCuts chose **dark grey (#525252)** to:
1. Differentiate from document-style apps
2. Create immersive experience
3. Reduce glare for mobile users
4. Make colorful content stand out
5. Improve battery efficiency on OLED displays

---

## Migration History

### From Indigo/Purple to Olive Green

**Date:** December 12, 2025

**Previous System:**
- Primary: Indigo (#4f46e5, #6366f1)
- Accent: Purple (#7c3aed, #6d28d9)

**New System:**
- Primary: Olive Green (#708d81)
- Accent: Same olive green

**Changes:**
- 220 color class references updated
- 43 files modified
- All gradients updated
- Tailwind config restructured
- CSS variables added

**Reasoning:**
- Align with CampusKinect brand family
- Create cohesive platform ecosystem
- Establish campus-focused identity
- Improve brand recognition

---

## Quick Reference

### Common Colors

| Usage | Class | Hex |
|-------|-------|-----|
| Primary Button | `bg-primary-400` | `#708d81` |
| Button Hover | `bg-primary-500` | `#5a7268` |
| Main Background | `bg-neutral-600` | `#525252` |
| Card Background | `bg-neutral-700` | `#404040` |
| Success | `bg-green-500` | `#22c55e` |
| Warning | `bg-amber-500` | `#f59e0b` |
| Error | `bg-red-500` | `#ef4444` |

### Common Combinations

```typescript
// Primary action
className="bg-primary-400 hover:bg-primary-500 text-white"

// Secondary action
className="bg-neutral-200 hover:bg-neutral-300 text-neutral-900"

// Card
className="bg-neutral-700 border border-neutral-600 text-white"

// Input focus
className="border-neutral-600 focus:border-primary-400"

// Link
className="text-primary-400 hover:text-primary-500 hover:underline"
```

---

## Maintenance

### Adding New Colors

1. Update `tailwind.config.cjs`
2. Add CSS variables to `index.css`
3. Update `utils/colors.ts`
4. Document usage patterns
5. Test accessibility

### Deprecating Colors

1. Mark as deprecated in code comments
2. Create migration guide
3. Set removal deadline (6 months minimum)
4. Gradually replace usage
5. Remove from color system

---

**For design questions:** lmckeown@calpoly.edu  
**For implementation support:** See `web-app/src/utils/colors.ts`

---

**End of Color System Documentation**

