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
          manualChunks: {
            vendor: [
              'zustand',
              'react-router-dom',
              'react-hook-form',
              'zod',
              '@tanstack/react-query',
              'date-fns',
              'clsx',
              'tailwind-merge',
              'class-variance-authority',
            ],
            react: ['react', 'react-dom'],
            mediasoup: ['mediasoup-client'],
            ui: [
              '@radix-ui/react-toast',
              '@radix-ui/react-dialog',
              '@radix-ui/react-dropdown-menu',
              '@radix-ui/react-popover',
              '@radix-ui/react-tooltip',
              'lucide-react',
            ],
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
