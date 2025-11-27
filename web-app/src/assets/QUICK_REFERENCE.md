# 🎨 Assets Quick Reference

## 📦 Import Syntax

```typescript
// Barrel exports (recommended)
import { CampusCutsLogo, ScissorsIcon } from '@assets';

// Direct path
import logo from '@assets/logos/campus-cuts-logo.svg';

// SVG as component
import Icon from '@assets/icons/scissors.svg?react';
```

## 📁 Available Assets

### Logos
- `CampusCutsLogo` - Main brand logo

### Icons
- `ScissorsIcon` - Haircut/service icon
- `BarberPoleIcon` - Barber shop icon
- `CalendarIcon` - Booking/schedule icon

### Placeholders
- `PlaceholderBarber` - Profile image placeholder
- `PlaceholderPortfolio` - Portfolio image placeholder

## 🎨 Color Variables

```css
/* Primary */
--color-primary-600: #4f46e5
--color-primary-500: #6366f1

/* Accents */
--color-accent-barber: #f59e0b
--color-accent-student: #10b981
--color-accent-admin: #ef4444

/* Semantic */
--color-success: #10b981
--color-warning: #f59e0b
--color-error: #ef4444
```

## 🔗 Path Aliases

```
@assets     → src/assets
@components → src/components
@pages      → src/pages
@services   → src/services
@store      → src/store
@types      → src/types
@config     → src/config
```

## 💡 Common Patterns

### Replace Lucide Icon
```typescript
// Before
import { Scissors } from 'lucide-react';

// After
import ScissorsIcon from '@assets/icons/scissors.svg?react';
<ScissorsIcon className="w-5 h-5" />
```

### Fallback Image
```typescript
<img src={user.avatar || PlaceholderBarber} alt={user.name} />
```

### Responsive Logo
```typescript
<img 
  src={CampusCutsLogo} 
  alt="CampusCuts"
  className="h-8 md:h-10 w-auto"
/>
```

## 📝 See Full Documentation
- **README.md** - Complete asset guidelines
- **USAGE_EXAMPLES.md** - Detailed code examples

