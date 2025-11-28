import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import AptosWalletProvider from './providers/AptosWalletProvider.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AptosWalletProvider>
      <App />
    </AptosWalletProvider>
  </StrictMode>,
);

// Register service worker for PWA
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(
      (registration) => {
        console.log('✅ Service Worker registered:', registration);
      },
      (error) => {
        console.log('❌ Service Worker registration failed:', error);
      }
    );
  });
}
