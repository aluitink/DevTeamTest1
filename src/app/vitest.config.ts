import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // `next` is not installed in this repository; the routes import
    // `next/server` lazily and can run against a mock providing
    // `NextResponse.json` (see `tests/mocks/next-server.ts`).
    alias: {
      "next/server": new URL("./tests/mocks/next-server.ts", import.meta.url).pathname,
      next: new URL("./tests/mocks/next-server.ts", import.meta.url).pathname,
      "api-responses": new URL("../api-responses/src/index.ts", import.meta.url).pathname,
      "@devteamtest1/validation": new URL("../lib/validation/src/index.ts", import.meta.url).pathname,
    },
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
