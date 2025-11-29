/**
 * Main Entry Point (Blockchain-First Version)
 * 
 * Initializes the app with all necessary providers:
 * - React Query (blockchain data caching)
 * - Toast notifications
 * - Error boundaries
 * - Router with lazy-loaded routes
 * 
 * This is the blockchain-powered version of CampusCuts!
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryProvider } from './providers/QueryProvider';
import { ToastProvider } from './components/Toast';
import { BlockchainErrorBoundary } from './components/ErrorBoundary';
import { LazyRoutes } from './routes/LazyRoutes';

// Import global styles
import './index.css';
import './styles/skeleton.css';

// Performance monitoring (optional)
if (import.meta.env.PROD) {
  // Web vitals for performance monitoring
  const reportWebVitals = (metric: any) => {
    console.log(metric);
    // Send to analytics service
  };

  // Measure performance
  import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
    getCLS(reportWebVitals);
    getFID(reportWebVitals);
    getFCP(reportWebVitals);
    getLCP(reportWebVitals);
    getTTFB(reportWebVitals);
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* Blockchain Error Boundary (outermost layer) */}
    <BlockchainErrorBoundary>
      {/* React Query Provider (data layer) */}
      <QueryProvider>
        {/* Toast Notifications */}
        <ToastProvider>
          {/* Router with lazy-loaded routes */}
          <BrowserRouter>
            <LazyRoutes />
          </BrowserRouter>
        </ToastProvider>
      </QueryProvider>
    </BlockchainErrorBoundary>
  </React.StrictMode>
);

// Log startup info
console.log('%c🎓 CampusCuts - Blockchain-First Platform', 'color: #4F46E5; font-size: 16px; font-weight: bold;');
console.log('%cRunning on Aptos blockchain + IPFS', 'color: #6366F1; font-size: 12px;');
console.log('%cUsers have NO IDEA they\'re using blockchain! ✨', 'color: #8B5CF6; font-size: 12px;');

if (import.meta.env.DEV) {
  console.log('\n📊 Development Mode Features:');
  console.log('  ✅ React Query DevTools enabled');
  console.log('  ✅ Detailed error messages');
  console.log('  ✅ Blockchain info displayed on pages');
  console.log('  ✅ Performance monitoring');
  console.log('\n🔗 API Base URL:', import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001');
}

