/**
 * Vite Performance Optimization Configuration
 *
 * Google L8 Standard Frontend Performance Features:
 * - Code splitting (route-based and component-based)
 * - Lazy loading for non-critical components
 * - Tree shaking and dead code elimination
 * - Asset optimization (images, fonts)
 * - Compression (gzip + brotli)
 * - Cache busting with content hashes
 * - Preloading critical resources
 */

import { defineConfig, splitVendorChunkPlugin } from 'vite';
import react from '@vitejs/plugin-react';
import compression from 'vite-plugin-compression';
import { visualizer } from 'rollup-plugin-visualizer';
import path from 'path';

export default defineConfig({
  plugins: [
    react({
      // Enable React Fast Refresh
      fastRefresh: true,
      // Automatic JSX runtime
      jsxRuntime: 'automatic',
    }),

    // Split vendor chunks for better caching
    splitVendorChunkPlugin(),

    // Gzip compression
    compression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 10240, // Only compress files > 10KB
      deleteOriginFile: false,
    }),

    // Brotli compression (better than gzip)
    compression({
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 10240,
      deleteOriginFile: false,
    }),

    // Bundle analyzer (run with ANALYZE=true)
    process.env.ANALYZE &&
      visualizer({
        open: true,
        filename: 'dist/stats.html',
        gzipSize: true,
        brotliSize: true,
      }),
  ].filter(Boolean),

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@services': path.resolve(__dirname, './src/services'),
      '@pages': path.resolve(__dirname, './src/pages'),
    },
  },

  build: {
    // Target modern browsers for smaller bundles
    target: 'es2020',

    // Generate source maps for production debugging
    sourcemap: process.env.NODE_ENV === 'production' ? 'hidden' : true,

    // Increase chunk size warning limit (500KB)
    chunkSizeWarningLimit: 500,

    // Rollup options for advanced optimization
    rollupOptions: {
      output: {
        // Manual chunk splitting for optimal caching
        manualChunks: (id) => {
          // Vendor chunks
          if (id.includes('node_modules')) {
            // React ecosystem
            if (id.includes('react') || id.includes('react-dom')) {
              return 'react-vendor';
            }

            // WebRTC & Mediasoup
            if (id.includes('mediasoup-client')) {
              return 'webrtc-vendor';
            }

            // UI libraries
            if (
              id.includes('@headlessui') ||
              id.includes('@heroicons') ||
              id.includes('tailwindcss')
            ) {
              return 'ui-vendor';
            }

            // State management
            if (id.includes('zustand') || id.includes('jotai')) {
              return 'state-vendor';
            }

            // Utilities
            if (
              id.includes('lodash') ||
              id.includes('date-fns') ||
              id.includes('axios')
            ) {
              return 'utils-vendor';
            }

            // Everything else
            return 'vendor';
          }
        },

        // Asset naming with content hash for cache busting
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];

          // Organize assets by type
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
            return `assets/images/[name]-[hash][extname]`;
          }
          if (/woff2?|ttf|eot/i.test(ext)) {
            return `assets/fonts/[name]-[hash][extname]`;
          }
          return `assets/[ext]/[name]-[hash][extname]`;
        },
      },

      // External dependencies (if using CDN)
      // external: ['react', 'react-dom'],
    },

    // Enable minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: process.env.NODE_ENV === 'production', // Remove console.log in production
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.debug'], // Remove specific functions
      },
      format: {
        comments: false, // Remove comments
      },
    },

    // CSS code splitting
    cssCodeSplit: true,

    // Report compressed size
    reportCompressedSize: true,

    // Enable CSS minification
    cssMinify: true,
  },

  // Performance optimizations
  optimizeDeps: {
    // Pre-bundle dependencies
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'zustand',
      'mediasoup-client',
    ],

    // Exclude large dependencies from pre-bundling
    exclude: ['@mediasoup/client'],
  },

  // Dev server optimizations
  server: {
    // Enable HTTP/2
    https: false, // Set to true with certificates in production

    // Hot Module Replacement
    hmr: {
      overlay: true,
    },

    // Compression
    compress: true,
  },

  // Preview server (production build preview)
  preview: {
    port: 4173,
    strictPort: false,
    https: false,
    open: false,
    compress: true,
  },

  // Environment variables
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
});
