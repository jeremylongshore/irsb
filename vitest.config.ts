import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/index.ts'],
      thresholds: {
        // MVP: Lower thresholds, increase as we add more tests
        statements: 25,
        branches: 50,
        functions: 25,
        lines: 25,
      },
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
