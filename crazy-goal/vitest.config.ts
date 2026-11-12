import { defineConfig } from 'vitest/config';

// Only the TypeScript unit tests under src/. free-kicks/tools/tests/*.test.js are plain node
// scripts with their own runner (see docs/FREE_KICKS.md), so vitest must leave them alone.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
