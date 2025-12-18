# App Icons for CampusCuts PWA

## Required Icons

The following icon sizes are needed for the PWA to work properly across all devices:

### Required Sizes:
- `icon-72x72.png` - Small icon
- `icon-96x96.png` - Badge icon
- `icon-128x128.png` - Standard icon
- `icon-144x144.png` - Windows tile
- `icon-152x152.png` - iOS  touch icon
- `icon-192x192.png` - Android icon (also used as maskable)
- `icon-384x384.png` - Large icon
- `icon-512x512.png` - Extra large icon (also used as maskable)

### Design Guidelines:

1. **Icon Design:**
   - Use the CampusCuts logo (scissors/barber theme)
   - Primary color: #7C3AED (purple from theme)
   - Background: White or transparent
   - Keep it simple and recognizable at small sizes

2. **Maskable Icons (192x192 and 512x512):**
   - Include 10% safe zone padding on all sides
   - These will be cropped to different shapes by different devices
   - Critical elements should be centered

3. **Tool Recommendations:**
   - Use [PWA Asset Generator](https://github.com/onderceylan/pwa-asset-generator)
   - Or create manually in Figma/Photoshop with proper sizing

4. **Quick Generation:**
   ```bash
   # Using PWA Asset Generator (requires Node.js)
   npx pwa-asset-generator ./Logo1.png ./public --icon-only --padding "calc(50vh - 40%) calc(50vw - 40%)"
   ```

### Temporary Solution:

Until proper icons are created, you can:
1. Export Logo1.png from `/src/assets/logos/`
2. Resize to each required dimension
3. Optimize with https://tinypng.com or similar
4. Save with correct filenames in `/public/`

### iOS Specific:

Add to `index.html` `<head>`:
```html
<link rel="apple-touch-icon" href="/icon-152x152.png">
<link rel="apple-touch-icon" sizes="180x180" href="/icon-192x192.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="CampusCuts">
```

### Favicon:

Also create:
- `favicon.ico` - 32x32 for browser tabs
- `favicon-16x16.png`
- `favicon-32x32.png`

## Testing Icons

1. **Chrome DevTools:**
   - Open DevTools > Application > Manifest
   - Verify all icons load correctly

2. **Lighthouse:**
   - Run PWA audit
   - Should show green checkmarks for "Provides a valid apple-touch-icon"

3. **Real Device Testing:**
   - Install on Android device
   - Install on iOS device (Safari > Share > Add to Home Screen)
   - Verify icons appear correctly on home screen

