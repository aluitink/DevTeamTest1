import { defineConfig } from "vitest/config";

/**
 * Root Vitest configuration (task #60).
 *
 * Each TypeScript workspace (src/lib/validation, src/api-responses, ...)
 * ships its own vitest.config.ts; `npm run test` at the root fans out to
 * `vitest run` in each workspace. This root config exists so a plain
 * `npx vitest` at the repository root is well-defined and covers every
 * workspace's test files.
 */
export default defineConfig({
  test: {
    include: [
      "src/lib/validation/tests/**/*.test.ts",
      "src/api-responses/src/__tests__/**/*.test.ts",
    ],
    environment: "node",
    // Keep the worker count low so tests run in constrained CI/sandbox
    // environments (few available threads).
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
