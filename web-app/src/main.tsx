import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { DirectWalletProvider } from './contexts/DirectWalletContext.tsx';
import WalletProvider from './providers/WalletProvider.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DirectWalletProvider>
      <WalletProvider>
        <App />
      </WalletProvider>
    </DirectWalletProvider>
  </StrictMode>,
);

// Register service worker for PWA (disabled in development to avoid caching issues)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').then(
      (registration) => {
        console.log('✅ Service Worker registered successfully:', registration.scope);
        
        // Check for updates periodically
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000); // Check every hour
        
        // Listen for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('🔄 New service worker available. Refresh to update.');
                // Optionally show update notification to user
                if (confirm('A new version of CampusCuts is available. Reload to update?')) {
                  window.location.reload();
                }
              }
            });
          }
        });
      },
      (error) => {
        console.log('❌ Service Worker registration failed:', error);
      }
    );
  });
} else if (!import.meta.env.PROD) {
  console.log('🔧 Service Worker disabled in development mode');
}

// Listen for app install prompt
let deferredPrompt: any;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  console.log('📱 Install prompt ready');
});

// Log when app is installed
window.addEventListener('appinstalled', () => {
  console.log('✅ PWA installed successfully!');
  deferredPrompt = null;
});
