import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),

  kit: {
    // SSR-capable Node server: enables server-side auth (hooks), a BFF data
    // layer, and SEO. The WebRTC room route opts out of SSR locally.
    adapter: adapter(),
    alias: {
      '@': 'src',
    },
  },
};

export default config;
