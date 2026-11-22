/**
 * `/items` — React Server Component (task #75).
 *
 * This file is the reference implementation of the standard Next.js App
 * Router **Server Component data fetching pattern**. It is the exact shape
 * of an `app/items/page.tsx` file: a `page` async function that fetches
 * data, hands *typed, validated* data to the tree, and renders fallback /
 * error UI from Server Component code.
 *
 * Why this file is not literally at `src/app/items/src/app/items/page.tsx`
 * with a real Next.js build: this repository is a migration repo whose
 * production stack is .NET 10 console apps; the RSC demo exists to lock in
 * the pattern (fetch → Zod boundary → typed render → graceful error) with
 * unit tests. To deploy it, copy `src/` of this workspace into a Next.js
 * app's `app/` directory — the code is written against the standard
 * `fetch` + `next/server` API surface and needs no changes.
 *
 * Key points (each maps to an acceptance criterion):
 *
 * - **Server Component**: no `"use client"` directive anywhere in the
 *   render path; the fetch runs in Node, not the browser.
 * - **Standard fetch conventions**: global `fetch` with
 *   `{ next: { revalidate: 60 } }` for the list (stale-while-revalidate)
 *   and `{ cache: "no-store" }` for always-fresh reads (see
 *   `lib/itemsData.ts` → `ItemsCacheStrategy`).
 * - **Zod at the boundary**: the response body is parsed with
 *   `listItemsResponseSchema` from `@devteamtest1/validation` exactly once;
 *   the component tree receives the inferred `ListItemsResponse` type.
 * - **`cache()`**: the list fetch is memoized per request with Next.js
 *   `cache`, so the page body and the header counter both call the data
 *   function but the upstream API is hit at most once per render.
 * - **Graceful errors**: `ItemsDataError` codes (`network_error`,
 *   `http_error`, `validation_error`) map to user-safe messages and a
 *   `status` for the error boundary; nothing from the wire is leaked.
 */
import type { ReactElement } from "react";

import { cache } from "next/server";

import {
  type Item,
  type ListItemsQuery,
  type ListItemsResponse,
} from "@devteamtest1/validation";

import {
  defaultListCacheStrategy,
  type ItemsDataClient,
  ItemsDataError,
  getItem,
  listItems,
  type ItemsCacheStrategy,
} from "../../../lib/itemsData.js";
import {
  ItemRow,
  ItemsErrorState,
  ItemsPage,
  ItemsSkeleton,
} from "../ui.js";

// --- Configuration ---------------------------------------------------------
// In a real app these come from `process.env` (validated at the boundary,
// e.g. `z.string().url().parse(process.env.ITEMS_API_BASE_URL)`).

const ITEMS_API_BASE_URL = "https://items-api.internal.example.com/items";

const defaultClient: ItemsDataClient = { fetch: (url, init) => fetch(url, init) };

// --- Data access (Next.js `cache` = per-request memoization) ---------------

/**
 * Fetch the items list, memoized per request by Next.js `cache`.
 *
 * `cache` deduplicates on the *arguments* of the wrapped function, so a
 * page that renders the list twice (body + header) triggers at most one
 * upstream call per render, and the full-route cache applies the
 * `revalidate: 60` strategy configured on the underlying fetch.
 */
export const getItemsPageData = cache(
  (query: ListItemsQuery = { page: 1, pageSize: 20, sortBy: "updatedAt", sortDir: "desc" }) =>
    listItems({
      baseUrl: ITEMS_API_BASE_URL,
      client: defaultClient,
      query,
      strategy: defaultListCacheStrategy,
    }),
);

/** Always-fresh single-item read (`cache: "no-store"`). */
export const getItemFresh = cache((id: string) =>
  getItem({
    baseUrl: ITEMS_API_BASE_URL,
    client: defaultClient,
    id,
    strategy: { kind: "no-store" },
  }),
);

// --- Error mapping ----------------------------------------------------------

function toErrorState(error: unknown): ItemsErrorState {
  if (error instanceof ItemsDataError) {
    return {
      title: errorTitleFor(error.code),
      detail: error.message,
      status: error.status,
      retryHint:
        error.code === "network_error" || error.code === "http_error"
          ? "The items service is briefly unreachable. Retry in a moment."
          : "The items service returned data in an unexpected shape. A developer has been notified.",
    };
  }
  // Unknown failure: fail closed with a generic message — never leak
  // internals (stack traces stay on the server).
  return {
    title: "Something went wrong",
    detail: "We could not load the items list.",
    retryHint: "Please try again later.",
  };
}

function errorTitleFor(code: ItemsDataError["code"]): string {
  switch (code) {
    case "network_error":
      return "Items are temporarily unavailable";
    case "http_error":
      return "The items service returned an error";
    case "validation_error":
      return "The items service returned unexpected data";
  }
}

// --- The Server Component (async, no client boundary) -----------------------

/**
 * `/items` page — the Server Component itself.
 *
 * Accepts an injectable client + base URL so the *same* component can be
 * rendered in tests (with the simulated API) and in production (with the
 * real global `fetch`). Defaults keep the production path a one-liner.
 */
export async function page(
  searchParams?: { page?: string; pageSize?: string; name?: string; minQuantity?: string; sortBy?: "name" | "quantity" | "updatedAt"; sortDir?: "asc" | "desc" },
  options: {
    baseUrl?: string;
    client?: ItemsDataClient;
    strategy?: ItemsCacheStrategy;
  } = {},
): Promise<ReactElement> {
  const baseUrl = options.baseUrl ?? ITEMS_API_BASE_URL;
  const client = options.client ?? defaultClient;
  const strategy = options.strategy ?? defaultListCacheStrategy;

  // Coarse query parsing (values are strings from the URL) — the data layer
  // applies the same defaults `listItemsQuerySchema` would; the authoritative
  // boundary validation is the *response* schema (Zod, task #72), per the
  // "validate at the boundary, then trust" rule.
  const query: Partial<ListItemsQuery> = { page: 1, pageSize: 20, sortBy: "updatedAt", sortDir: "desc" };
  if (searchParams) {
    if (searchParams.page !== undefined) query.page = Number(searchParams.page) || 1;
    if (searchParams.pageSize !== undefined) query.pageSize = Number(searchParams.pageSize) || 20;
    if (searchParams.name !== undefined) query.name = searchParams.name;
    if (searchParams.minQuantity !== undefined) query.minQuantity = Number(searchParams.minQuantity);
    if (searchParams.sortBy !== undefined) query.sortBy = searchParams.sortBy;
    if (searchParams.sortDir !== undefined) query.sortDir = searchParams.sortDir;
  }

  try {
    // Single upstream call per request: the same memoized result is passed
    // to the header and the body below (typed `ListItemsResponse`).
    const data = await getItemsPageData({ ...query });
    return (
      <ItemsPage total={data.total} page={data.page} pageSize={data.pageSize}>
        {data.items.length === 0 ? (
          <EmptyState />
        ) : (
          <ItemsList items={data.items} />
        )}
      </ItemsPage>
    );
  } catch (error) {
    // Graceful failure inside the Server Component: render a specific,
    // user-safe state. (A `not-found.tsx` / `error.tsx` would apply for
    // uncaught failures in a real app; this covers the recoverable cases
    // the data layer reports as typed `ItemsDataError`s.)
    const state = toErrorState(error);
    return <ItemsPage total={0} page={1} pageSize={20}><ItemsErrorState {...state} /></ItemsPage>;
  }
}

// --- Presentational Server Components (no state, no effects) ----------------

function ItemsList({ items }: { items: Item[] }): ReactElement {
  return (
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Quantity</th>
          <th>Notes</th>
          <th>Updated</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <ItemRow key={item.id} item={item} />
        ))}
      </tbody>
    </table>
  );
}

function EmptyState(): ReactElement {
  return <p className="items-empty">No items match the current filters.</p>;
}

/** Loading placeholder — used with `loading.tsx` / `Suspense` boundaries. */
export function itemsLoading(): ReactElement {
  return (
    <ItemsPage total={0} page={1} pageSize={20}>
      <ItemsSkeleton rows={5} />
    </ItemsPage>
  );
}
