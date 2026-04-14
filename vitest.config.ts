import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      exclude: ['node_modules', 'dist', 'prisma', '**/*.test.ts', '**/*.spec.ts'],
    },
    setupFiles: [],
    testTimeout: 15000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@modules': path.resolve(__dirname, './src/modules'),
    },
  },
});
