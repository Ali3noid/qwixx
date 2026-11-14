import adapter from '@sveltejs/adapter-auto';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [sveltekit({ adapter: adapter() })],
  resolve: { conditions: ['browser'] },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
  },
});
