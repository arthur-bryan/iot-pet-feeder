import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['public/js/**/*.js'],
      exclude: ['public/js/index.js', 'public/js/admin.js', 'public/js/schedules.js', 'public/js/settings.js']
    }
  }
});
