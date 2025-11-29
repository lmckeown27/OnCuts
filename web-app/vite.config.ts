import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  
  server: {
    port: 3000,
  },
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@assets': path.resolve(__dirname, './src/assets'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@services': path.resolve(__dirname, './src/services'),
      '@store': path.resolve(__dirname, './src/store'),
      '@types': path.resolve(__dirname, './src/types'),
      '@config': path.resolve(__dirname, './src/config'),
    },
  },
  
  // Production optimizations
  build: {
    // Code splitting for better performance
    rollupOptions: {
      output: {
        // Split vendor chunks
        manualChunks: {
          // React core
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          
          // React Query (blockchain data layer)
          'query-vendor': ['@tanstack/react-query', '@tanstack/react-query-devtools'],
          
          // Blockchain services (critical path)
          'blockchain': [
            './src/services/blockchain-auth.service.ts',
            './src/services/blockchain-booking.service.ts',
          ],
          
          // UI components (lazy load)
          'ui-components': [
            './src/components/Skeleton.tsx',
            './src/components/Toast.tsx',
            './src/components/ErrorBoundary.tsx',
          ],
        },
      },
    },
    
    // Chunk size warnings
    chunkSizeWarningLimit: 500, // Warn if chunk > 500KB
    
    // Minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.logs in production
        drop_debugger: true,
      },
    },
    
    // Source maps (only in dev)
    sourcemap: false,
  },
  
  // Optimize dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@tanstack/react-query',
    ],
  },
})
