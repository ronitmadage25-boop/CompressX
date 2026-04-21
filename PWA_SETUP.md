# CompressX PWA Setup Guide

## Overview
CompressX is now a Progressive Web App (PWA) with install functionality for mobile and desktop.

## Features Implemented

✅ **Service Worker** - Offline support and asset caching  
✅ **Web App Manifest** - App metadata and icons  
✅ **Install Prompt** - Smart popup system  
✅ **Install Button** - In navbar for easy access  
✅ **Offline Support** - Basic caching for main assets  

## Setup Instructions

### 1. Generate PWA Icons

The app needs icon files in multiple sizes. Choose one method:

#### Method A: Using the Icon Generator (Easiest)
1. Open `public/generate-icons.html` in your browser
2. Click "Generate Icons" 
3. Right-click each canvas and save as PNG
4. Save files to `public/` folder:
   - `logo-192.png`
   - `logo-512.png`
   - `logo-192-maskable.png`
   - `logo-512-maskable.png`

#### Method B: Using Sharp (Automated)
```bash
npm install sharp
node scripts/generate-pwa-icons.js
```

#### Method C: Manual Conversion
1. Open `public/logo.svg` in your browser
2. Right-click → Save as PNG
3. Resize to 192x192 and 512x512 using an image editor
4. Save as `logo-192.png` and `logo-512.png`

### 2. Verify Files

Ensure these files exist in `public/`:
```
public/
├── manifest.json
├── sw.js
├── logo.svg
├── logo-192.png
├── logo-512.png
├── logo-192-maskable.png
└── logo-512-maskable.png
```

### 3. Test the PWA

1. **Development:**
   ```bash
   npm run dev
   ```
   - Open `http://localhost:3000`
   - Wait 15 seconds or click a feature
   - Install popup should appear

2. **Production Build:**
   ```bash
   npm run build
   npm run start
   ```

3. **Chrome DevTools:**
   - Open DevTools (F12)
   - Go to Application → Manifest
   - Verify manifest.json loads correctly
   - Check Service Workers tab

## How It Works

### Install Popup Behavior
- **Triggers after:** 15 seconds OR user clicks any feature
- **Shows only once** per session
- **Dismissible:** Click "Maybe Later" to close
- **Premium UI:** Matches CompressX design theme

### Install Button
- Located in navbar (top-right)
- Shows only when app can be installed
- Glowing animation for visibility
- Disappears after installation

### Service Worker
- Caches main assets on first visit
- Serves from cache when offline
- API calls always fetch from network
- Auto-updates when new version deployed

### Offline Support
- Homepage loads offline
- CSS and JS cached
- API calls show offline message
- Full functionality when online

## Browser Support

| Browser | Desktop | Mobile |
|---------|---------|--------|
| Chrome | ✅ | ✅ |
| Edge | ✅ | ✅ |
| Firefox | ⚠️ | ✅ |
| Safari | ⚠️ | ✅ |

## Installation Locations

### Android
- App appears on home screen
- Accessible from app drawer
- Full-screen experience
- Uses app icon

### Desktop (Chrome/Edge)
- Appears in app menu
- Can be pinned to taskbar
- Standalone window
- Uses app icon

### iOS/Safari
- Add to Home Screen (manual)
- Appears as web clip
- Full-screen capable
- Uses app icon

## Customization

### Change App Name
Edit `public/manifest.json`:
```json
{
  "name": "Your App Name",
  "short_name": "Short Name"
}
```

### Change Theme Color
Edit `public/manifest.json`:
```json
{
  "theme_color": "#00ffb3",
  "background_color": "#020407"
}
```

### Modify Install Popup
Edit `components/pwa/InstallPrompt.tsx`:
- Change text, colors, animations
- Customize button styles
- Adjust modal size

### Adjust Install Timing
Edit `hooks/usePWAInstall.ts`:
```typescript
// Change 15 seconds to desired delay
const id = setTimeout(() => {
  triggerInstallPrompt();
}, 15000); // milliseconds
```

## Troubleshooting

### Install Button Not Showing
1. Check browser support (Chrome/Edge required)
2. Verify manifest.json is valid
3. Check DevTools → Application → Manifest
4. Ensure HTTPS (required for PWA)

### Service Worker Not Registering
1. Check DevTools → Application → Service Workers
2. Verify `public/sw.js` exists
3. Check browser console for errors
4. Clear cache and reload

### Icons Not Displaying
1. Verify icon files exist in `public/`
2. Check manifest.json icon paths
3. Ensure PNG format (not SVG)
4. Verify file sizes (192x192, 512x512)

### Offline Not Working
1. Check Service Worker status
2. Verify cache names match
3. Check DevTools → Application → Cache Storage
4. Clear cache and reinstall

## Performance Tips

1. **Minimize Cache Size**
   - Only cache essential assets
   - Remove old cache versions

2. **Update Strategy**
   - Service Worker auto-updates
   - Users see new version on reload

3. **Monitor Cache**
   - Check DevTools → Cache Storage
   - Clear old caches periodically

## Security

- ✅ HTTPS required (enforced by browsers)
- ✅ Service Worker scope limited to app
- ✅ No sensitive data cached
- ✅ API calls always fresh

## Resources

- [MDN PWA Guide](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [Web.dev PWA Checklist](https://web.dev/pwa-checklist/)
- [Manifest Spec](https://www.w3.org/TR/appmanifest/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)

## Next Steps

1. Generate icon files (see Setup Instructions)
2. Test on Chrome/Edge
3. Deploy to production
4. Test installation on mobile
5. Monitor Service Worker updates

---

**Questions?** Check the troubleshooting section or review the implementation files:
- `public/manifest.json` - App metadata
- `public/sw.js` - Service Worker
- `hooks/usePWAInstall.ts` - Install logic
- `components/pwa/InstallPrompt.tsx` - UI
