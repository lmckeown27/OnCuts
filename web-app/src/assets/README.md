# CampusCuts Frontend Assets

This directory contains all static assets for the CampusCuts web application.

## Directory Structure

```
assets/
├── images/          # Product images, backgrounds, hero images
├── icons/           # SVG icons, icon sets
├── fonts/           # Custom web fonts
├── logos/           # CampusCuts branding, partner logos
└── styles/          # Global CSS variables, themes
```

## Usage

### Importing Images

```typescript
import heroImage from '@/assets/images/hero-bg.jpg';

// In component:
<img src={heroImage} alt="Hero" />
```

### Importing Icons (SVG)

```typescript
import LogoIcon from '@/assets/icons/logo.svg?react';

// As React component:
<LogoIcon className="w-6 h-6" />
```

### Using Logos

```typescript
import campusCutsLogo from '@/assets/logos/campus-cuts-logo.svg';

<img src={campusCutsLogo} alt="CampusCuts" />
```

## Asset Guidelines

### Images
- **Format**: Use WebP for photos, PNG for graphics with transparency
- **Optimization**: Compress images before adding (use TinyPNG, Squoosh, etc.)
- **Naming**: Use kebab-case: `barber-portfolio-1.webp`
- **Sizes**: Provide multiple sizes for responsive images when needed

### Icons
- **Format**: SVG preferred for scalability
- **Naming**: Use kebab-case: `scissors-icon.svg`
- **Size**: Optimize SVG files (remove unnecessary metadata)

### Logos
- **Formats**: SVG (primary), PNG (fallback)
- **Variants**: Include light/dark mode versions if applicable
- **Naming**: `campus-cuts-logo.svg`, `campus-cuts-logo-dark.svg`

### Fonts
- **Format**: WOFF2 (primary), WOFF (fallback)
- **License**: Ensure fonts are licensed for web use
- **Loading**: Use `@font-face` in CSS or import in main.tsx

## Path Alias

Use the `@` alias for cleaner imports:

```typescript
// Instead of:
import logo from '../../../assets/logos/logo.svg';

// Use:
import logo from '@/assets/logos/logo.svg';
```

## Best Practices

1. **Don't commit large files**: Keep images under 500KB when possible
2. **Use lazy loading**: Import images only when needed
3. **Optimize for performance**: Compress and resize appropriately
4. **Use CDN for production**: Consider moving large assets to CDN
5. **Version control**: Commit source files (PSDs, AI files) separately

## Adding New Assets

1. Place asset in appropriate subdirectory
2. Follow naming conventions (kebab-case)
3. Optimize file size before committing
4. Update this README if adding new categories

