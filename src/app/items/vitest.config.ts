import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // `next` is not installed in this workspace (type-only stub in
    // node_modules/stubs, see its README). Map it to a mock module so the
    // Server Component under test can import `cache` at runtime.
    alias: {
      "next/server": new URL("./mocks/next-server.ts", import.meta.url).pathname,
      next: new URL("./mocks/next-server.ts", import.meta.url).pathname,
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
