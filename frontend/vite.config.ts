import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],

    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },

    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(
        env.VITE_API_URL || 'http://localhost:8000'
      ),
      'import.meta.env.VITE_SIGNALING_URL': JSON.stringify(
        env.VITE_SIGNALING_URL || 'ws://localhost:8000/ws'
      ),
    },

    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: 'http://localhost:8000',
          changeOrigin: true,
          secure: false,
        },
      },
    },

    build: {
      target: 'es2022',
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            if (id.includes('mediasoup-client')) return 'mediasoup';
            if (id.includes('react-dom') || id.includes('/react/')) return 'react';
            if (
              id.includes('@radix-ui') ||
              id.includes('lucide-react') ||
              id.includes('@radix-ui/react-popover')
            ) {
              return 'ui';
            }
            if (
              id.includes('zustand') ||
              id.includes('react-router') ||
              id.includes('react-hook-form') ||
              id.includes('zod') ||
              id.includes('@tanstack/react-query') ||
              id.includes('date-fns') ||
              id.includes('clsx') ||
              id.includes('tailwind-merge') ||
              id.includes('class-variance-authority')
            ) {
              return 'vendor';
            }
          },
        },
      },
      chunkSizeWarningLimit: 1000,
    },

    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        'zustand',
        'mediasoup-client',
        '@tanstack/react-query',
      ],
    },
  };
});
