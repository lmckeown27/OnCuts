# Asset Usage Examples

This guide shows how to use CampusCuts assets in your components.

## 📦 Import Methods

### Method 1: Direct Import (Recommended for static assets)

```typescript
import logoSrc from '@assets/logos/campus-cuts-logo.svg';

function Header() {
  return <img src={logoSrc} alt="CampusCuts" className="h-8" />;
}
```

### Method 2: Barrel Export (Cleaner for commonly used assets)

```typescript
import { CampusCutsLogo, ScissorsIcon } from '@assets';

function Navigation() {
  return (
    <nav>
      <img src={CampusCutsLogo} alt="CampusCuts" />
    </nav>
  );
}
```

### Method 3: SVG as React Component (Best for interactive icons)

```typescript
import ScissorsIcon from '@assets/icons/scissors.svg?react';

function BookingButton() {
  return (
    <button>
      <ScissorsIcon className="w-5 h-5 text-blue-600" />
      Book Now
    </button>
  );
}
```

## 🎨 Common Use Cases

### Logo in Navbar

```typescript
import { CampusCutsLogo } from '@assets';

export function Navbar() {
  return (
    <nav className="flex items-center px-6 py-4">
      <img 
        src={CampusCutsLogo} 
        alt="CampusCuts" 
        className="h-10 w-auto"
      />
    </nav>
  );
}
```

### Icons with Lucide React (Current approach)

```typescript
import { Scissors, Calendar, DollarSign } from 'lucide-react';

// You can replace lucide-react icons with our custom SVGs
import ScissorsIcon from '@assets/icons/scissors.svg?react';
import CalendarIcon from '@assets/icons/calendar.svg?react';

function ServiceCard() {
  return (
    <div className="flex gap-4">
      <ScissorsIcon className="w-6 h-6 text-indigo-600" />
      <CalendarIcon className="w-6 h-6 text-gray-600" />
    </div>
  );
}
```

### Placeholder Images for Profiles

```typescript
import { PlaceholderBarber } from '@assets';

function BarberCard({ barber }) {
  return (
    <img 
      src={barber.profileImage || PlaceholderBarber} 
      alt={barber.name}
      className="w-full h-64 object-cover rounded-lg"
    />
  );
}
```

### Background Images

```typescript
import heroBg from '@assets/images/hero-background.jpg';

function Hero() {
  return (
    <div 
      className="h-screen bg-cover bg-center"
      style={{ backgroundImage: `url(${heroBg})` }}
    >
      <h1>Welcome to CampusCuts</h1>
    </div>
  );
}
```

### Lazy Loading Images

```typescript
import { preloadImage, preloadImages } from '@assets';

// Preload single image
useEffect(() => {
  preloadImage('/path/to/large-image.jpg')
    .then(() => console.log('Image loaded'))
    .catch(err => console.error('Failed to load image'));
}, []);

// Preload multiple images
useEffect(() => {
  const imageSources = [
    '/portfolio-1.jpg',
    '/portfolio-2.jpg',
    '/portfolio-3.jpg',
  ];
  
  preloadImages(imageSources).then(() => {
    console.log('All images loaded');
  });
}, []);
```

## 🎯 Color System

Import the color system in your main CSS:

```typescript
// In main.tsx or index.css
import '@assets/styles/colors.css';
```

Then use CSS variables:

```css
.primary-button {
  background-color: var(--color-primary-600);
  color: white;
}

.card {
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  box-shadow: var(--shadow-md);
}
```

Or with Tailwind (after configuring):

```typescript
<button className="bg-[var(--color-primary-600)] text-white">
  Book Appointment
</button>
```

## 📱 Responsive Images

```typescript
import mobileBg from '@assets/images/bg-mobile.jpg';
import desktopBg from '@assets/images/bg-desktop.jpg';

function ResponsiveHero() {
  return (
    <picture>
      <source media="(max-width: 768px)" srcSet={mobileBg} />
      <source media="(min-width: 769px)" srcSet={desktopBg} />
      <img src={desktopBg} alt="Hero" className="w-full h-auto" />
    </picture>
  );
}
```

## 🔧 Dynamic Imports (Code Splitting)

For large images that aren't immediately needed:

```typescript
function GalleryImage({ imageName }) {
  const [imageSrc, setImageSrc] = useState(null);

  useEffect(() => {
    import(`@assets/images/gallery/${imageName}.jpg`)
      .then(module => setImageSrc(module.default))
      .catch(err => console.error('Failed to load image:', err));
  }, [imageName]);

  if (!imageSrc) return <div>Loading...</div>;
  
  return <img src={imageSrc} alt="Gallery" />;
}
```

## 🌐 CDN Usage (Production)

For production, consider moving large assets to a CDN:

```typescript
const CDN_URL = import.meta.env.VITE_CDN_URL || '';

function OptimizedImage({ src, alt, ...props }) {
  const imageSrc = CDN_URL ? `${CDN_URL}${src}` : src;
  
  return <img src={imageSrc} alt={alt} {...props} />;
}
```

## 💡 Best Practices

1. **Use WebP format** for better compression
2. **Lazy load images** below the fold
3. **Provide alt text** for accessibility
4. **Use srcSet** for responsive images
5. **Optimize SVGs** before committing
6. **Use placeholders** while images load
7. **Preload critical images** for LCP optimization
8. **Use CDN** for production assets

## 🚀 Performance Tips

```typescript
// Lazy load component with images
import { lazy, Suspense } from 'react';

const HeavyImageGallery = lazy(() => import('./HeavyImageGallery'));

function App() {
  return (
    <Suspense fallback={<div>Loading gallery...</div>}>
      <HeavyImageGallery />
    </Suspense>
  );
}
```

