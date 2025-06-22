import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,ts}'],
    exclude: [
      'src/**/*.svelte.{test,spec}.{js,ts}', 
      'e2e/**/*',
      '**/e2e/**/*',
      '**/*.e2e.{test,spec}.{js,ts}'
    ]
  }
}); 
