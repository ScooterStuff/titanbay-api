import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
    globalSetup: ['test/integration/global-setup.ts'],
    // Integration tests start a Postgres container (or connect to TEST_DATABASE_URL);
    // give them room and run files sequentially to avoid cross-test interference.
    testTimeout: 120000,
    hookTimeout: 120000,
    fileParallelism: false,
  },
});
