/**
 * Vitest mock for `next/server` used by the Server Component tests.
 *
 * Next.js is not installed in this workspace (see `node_modules/stubs/README.md`),
 * so the real per-request memoization cannot run under plain Node/Vitest.
 * The mock implements the same *observable* contract the page relies on:
 * `cache(fn)` returns `fn` — identity — which is what `next/server` does
 * after its first call within a request. Tests that need to assert
 * memoization call the data function twice through the page's exported
 * accessor and compare.
 */
export const cache = <TArgs extends unknown[], TReturn>(fn: (...args: TArgs) => TReturn) =>
  fn as (...args: TArgs) => TReturn;

export default { cache };
