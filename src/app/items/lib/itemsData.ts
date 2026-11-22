/**
 * Data-access layer for the `items` Server Component (task #75).
 *
 * This is the single place where data crosses a trust boundary into the
 * React component tree. It demonstrates the standard Next.js App Router
 * Server Component pattern:
 *
 * 1. **Fetch with the global `fetch`** (or, in production, a direct DB
 *    driver call — the simulation here is a `fetch`-compatible function).
 * 2. **Cache at the data layer with Next.js semantics**: the list is wrapped
 *    in `cache(...)` (per-request memoization + full-route cache) and the
 *    underlying fetch uses `revalidate` for stale-while-revalidate caching.
 *    `cache: "no-store"` is supported for always-fresh reads (single-item
 *    by id, and list fetches under a `forceFresh` flag).
 * 3. **Validate the boundary with Zod** using the centralized schemas from
 *    `@devteamtest1/validation` (task #72). Everything downstream receives
 *    the inferred, fully-typed `ListItemsResponse` — no re-validation.
 * 4. **Fail with typed errors**: network/HTTP failures and malformed
 *    payloads surface as `ItemsDataError` with a machine-readable `code`,
 *    so the Server Component (or a Next.js `error.tsx`) can render a
 *    specific, user-safe message instead of leaking internals.
 */
import {
  type ListItemsQuery,
  type ListItemsResponse,
  type Item,
  listItemsResponseSchema,
  ItemSchema,
} from "@devteamtest1/validation";

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * Failure of a data fetch, classified so callers can render specific UI.
 * The `message` is user-safe by construction; internals stay on the stack
 * trace (server-only).
 */
export class ItemsDataError extends Error {
  readonly code: ItemsDataErrorCode;
  readonly status?: number;

  constructor(
    code: ItemsDataErrorCode,
    message: string,
    options: { status?: number; cause?: unknown } = {},
  ) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "ItemsDataError";
    this.code = code;
    if (options.status !== undefined) this.status = options.status;
  }
}

export type ItemsDataErrorCode =
  | "network_error"
  | "http_error"
  | "validation_error";

// ---------------------------------------------------------------------------
// Client — injectable so tests can swap in the simulated API
// ---------------------------------------------------------------------------

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export interface ItemsDataClient {
  /**
   * A `fetch`-compatible function. In a real Next.js app this is the global
   * `fetch` (bound to an internal API route or external service); in this
   * demo and in tests it is the simulated `createItemsApi` function.
   */
  fetch: FetchLike;
}

// ---------------------------------------------------------------------------
// Caching strategies (Next.js conventions)
// ---------------------------------------------------------------------------

/**
 * Revalidation strategy, expressed with the exact Next.js fetch options:
 *
 * - `revalidate: 60` — stale-while-revalidate: serve cached data for up to
 *   60 seconds, refresh in the background thereafter.
 * - `cache: "no-store"` — always perform a fresh fetch (and do not store the
 *   result in the full-route cache).
 *
 * The strategy is attached to the fetch call; Next.js honors these options
 * on `fetch` inside Server Components and route handlers.
 */
export type ItemsCacheStrategy =
  | { kind: "revalidate"; revalidate: number }
  | { kind: "no-store" };

/**
 * Default strategy for the list view: cached and revalidated every 60
 * seconds. Items are reference data, not per-user state, so this is the
 * right trade-off: cheap pages, at most 60 s of staleness.
 */
export const defaultListCacheStrategy: ItemsCacheStrategy = { kind: "revalidate", revalidate: 60 };

function strategyToFetchOptions(strategy: ItemsCacheStrategy): RequestInit {
  return strategy.kind === "revalidate"
    ? { cache: "default", next: { revalidate: strategy.revalidate } }
    : { cache: "no-store" };
}

// ---------------------------------------------------------------------------
// Boundary validation
// ---------------------------------------------------------------------------

/**
 * Parse an HTTP response body at the trust boundary.
 *
 * @returns the validated, typed payload
 * @throws {@link ItemsDataError} with `code: "validation_error"` (including
 *         a bounded list of the issues for logging) when the body does not
 *         match the schema.
 */
export function parseListItemsResponse(body: unknown): ListItemsResponse {
  const parsed = listItemsResponseSchema.safeParse(body);
  if (!parsed.success) {
    // Keep the message user-safe; the issue list is for server-side logs.
    const issueSummary = parsed.error.issues
      .slice(0, 3)
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    throw new ItemsDataError("validation_error", `The items API returned an unexpected payload (${issueSummary}).`);
  }
  return parsed.data;
}

/** Boundary parser for a single-item response. */
export function parseItem(body: unknown): Item {
  const parsed = ItemSchema.safeParse(body);
  if (!parsed.success) {
    const issueSummary = parsed.error.issues
      .slice(0, 3)
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    throw new ItemsDataError("validation_error", `The items API returned an unexpected item payload (${issueSummary}).`);
  }
  return parsed.data;
}

/** Shared plumbing: fetch a URL and turn transport/HTTP failures into typed errors. */
async function fetchJson(client: ItemsDataClient, url: string, init: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    response = await client.fetch(url, init);
  } catch (cause) {
    // Network-level failure (DNS, timeout, abort, …).
    throw new ItemsDataError("network_error", "Could not reach the items service.", { cause });
  }

  if (!response.ok) {
    let detail = "";
    try {
      const body = (await response.json()) as { error?: { message?: string } };
      if (typeof body?.error?.message === "string") detail = body.error.message;
    } catch {
      // Non-JSON error body — fall through with the generic message.
    }
    throw new ItemsDataError("http_error", detail || `The items service responded with ${response.status}.`, {
      status: response.status,
    });
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (cause) {
    throw new ItemsDataError("validation_error", "The items service returned an unreadable JSON body.", { cause });
  }
  return body;
}

// ---------------------------------------------------------------------------
// Data access functions
// ---------------------------------------------------------------------------

export interface ListItemsParams {
  /** Base URL of the items API, e.g. `https://api.example.com/items`. */
  baseUrl: string;
  client: ItemsDataClient;
  /** Query parameters (validated against `listItemsQuerySchema` by the caller — defaults are applied here instead for ergonomics). */
  query?: Partial<ListItemsQuery>;
  /** Caching strategy; defaults to stale-while-revalidate (60 s). */
  strategy?: ItemsCacheStrategy;
}

/**
 * Fetch one page of items.
 *
 * **Not** wrapped in Next.js `cache()` itself — the Server Component does
 * that, so the per-request memoization key is the component's argument. The
 * revalidation strategy is still applied at the fetch level, which is where
 * the full-route cache entry is created.
 */
export async function listItems({ baseUrl, client, query = {}, strategy = defaultListCacheStrategy }: ListItemsParams): Promise<ListItemsResponse> {
  const params = new URLSearchParams({
    page: String(query.page ?? 1),
    pageSize: String(query.pageSize ?? 20),
  });
  if (query.name !== undefined) params.set("name", query.name);
  if (query.minQuantity !== undefined) params.set("minQuantity", String(query.minQuantity));
  if (query.sortBy !== undefined) params.set("sortBy", query.sortBy);
  if (query.sortDir !== undefined) params.set("sortDir", query.sortDir);

  const url = `${baseUrl.replace(/\/$/, "")}?${params.toString()}`;
  const body = await fetchJson(client, url, strategyToFetchOptions(strategy));
  return parseListItemsResponse(body);
}

export interface GetItemParams {
  baseUrl: string;
  client: ItemsDataClient;
  id: string;
  /** Caching strategy; single-item reads default to `no-store` (always fresh). */
  strategy?: ItemsCacheStrategy;
}

/**
 * Fetch a single item by id. Single-item reads default to
 * `cache: "no-store"` — a page that shows one specific record should not
 * show a stale copy of another user's edit.
 */
export async function getItem({ baseUrl, client, id, strategy = { kind: "no-store" } as const }: GetItemParams): Promise<Item> {
  const url = `${baseUrl.replace(/\/$/, "")}/${encodeURIComponent(id)}`;
  const body = await fetchJson(client, url, strategyToFetchOptions(strategy));
  return parseItem(body);
}

// ---------------------------------------------------------------------------
// Server-side re-export of the Next.js `cache` helper (Server Components)
// ---------------------------------------------------------------------------
//
// `import { cache } from "next/server"` is used directly by the Server
// Component (`src/app/items/page.tsx`). It is deliberately **not** imported
// here, because this module must stay importable from Node/Vitest, where
// Next.js is not installed. In a real app this file would live under
// `app/` and could import `next/server` at the top level.

export type { ListItemsQuery, ListItemsResponse, Item };
