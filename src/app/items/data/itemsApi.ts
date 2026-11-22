/**
 * Simulated `items` API (task #75).
 *
 * This module stands in for a real HTTP API (or a direct DB query) so the
 * Server Component data-fetching pattern can be demonstrated and unit-tested
 * in this repository, which has no web server. The public surface is
 * intentionally shaped like `fetch`:
 *
 * - `createItemsApi` returns a `fetch`-compatible function whose behavior
 *   is selected through its options (HTTP method, query parameters),
 * - responses are `Response` objects with a JSON body,
 * - non-2xx responses carry the standard error envelope from
 *   `@devteamtest1/validation`.
 *
 * The underlying "database" is an in-memory array seeded with a few items;
 * `seed` is optional so tests can exercise the empty state.
 */
import {
  type ListItemsResponse,
  type ResourceError,
  type Item,
} from "@devteamtest1/validation";

/** A request description in the shape produced by `fetch(url, init)`. */
export interface RequestInitLike {
  method?: string;
  headers?: HeadersInit | undefined;
  body?: BodyInit | null;
  /** Abort signal, accepted for `fetch`-compatibility; the simulation ignores it. */
  signal?: AbortSignal | null;
}

export interface ItemsApiOptions {
  /**
   * Simulated network latency in milliseconds (default 0). Lets tests cover
   * timeout/abort behavior deterministically.
   */
  delayMs?: number;
  /**
   * Force every request to fail with a 503 error envelope. Simulates an
   * unavailable upstream service.
   */
  failWith?: number;
}

/**
 * Seed data for the simulated database. The module-level default database is
 * seeded from this list; `createItemsApi` copies it so every API instance is
 * independent.
 */
export const defaultItemsSeed: Item[] = [
  {
    id: "itm-0001",
    name: "Stainless Screwdriver",
    quantity: 42,
    notes: "Keep in stock",
    createdAt: "2025-11-01T08:00:00Z",
    updatedAt: "2026-01-10T09:30:00Z",
  },
  {
    id: "itm-0002",
    name: "Copper Wire, 22 AWG",
    quantity: 7,
    notes: null,
    createdAt: "2025-12-05T14:15:00Z",
    updatedAt: "2026-01-02T11:00:00Z",
  },
  {
    id: "itm-0003",
    name: "Hex Bolts M6",
    quantity: 0,
    notes: "Reorder threshold hit",
    createdAt: "2026-01-03T10:00:00Z",
    updatedAt: "2026-01-12T16:45:00Z",
  },
];

function json(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function errorEnvelope(code: string, message: string): ResourceError {
  return { error: { code, message } };
}

/**
 * Build a `fetch`-compatible simulated `GET /items` and `GET /items/:id`
 * endpoint.
 *
 * @param base  Base URL, e.g. `"https://api.example.com/items"` (the exact
 *              host is irrelevant to the simulation; it only has to parse).
 * @param seed  Rows the simulated database starts with.
 */
export function createItemsApi(
  base: string,
  seed: Item[] = defaultItemsSeed,
  options: ItemsApiOptions = {},
): (url: string, init?: RequestInitLike) => Promise<Response> {
  const rows: Item[] = seed.map((row) => ({ ...row }));
  const { delayMs = 0, failWith } = options;

  return async (url: string, init: RequestInitLike = {}) => {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    if (init.signal?.aborted) {
      throw new DOMException("The operation was aborted.", "AbortError");
    }

    const requestUrl = new URL(url, "http://localhost");
    const method = (init.method ?? "GET").toUpperCase();

    if (failWith !== undefined) {
      return json(failWith, errorEnvelope("upstream_unavailable", "The items service is temporarily unavailable."));
    }

    const methodAllowed = ["GET", "HEAD"].includes(method);
    if (!methodAllowed) {
      return json(405, errorEnvelope("method_not_allowed", `Method ${method} is not allowed on the items API.`));
    }

    // Parse the path: expect either `/items` (list) or `/items/:id` (single).
    const segments = requestUrl.pathname.split("/").filter((s) => s.length > 0);
    const [first, maybeId, ...rest] = segments;

    if (first !== "items" || rest.length > 0) {
      return json(404, errorEnvelope("not_found", `No route matches ${requestUrl.pathname}`));
    }

    if (maybeId !== undefined) {
      // --- GET /items/:id -------------------------------------------------
      const row = rows.find((candidate) => candidate.id === maybeId);
      if (!row) {
        return json(404, errorEnvelope("not_found", `No item with id '${maybeId}'.`));
      }
      return json(200, row);
    }

    // --- GET /items (list) ------------------------------------------------
    const query = new URLSearchParams(requestUrl.search);
    const page = Math.max(1, Number(query.get("page") ?? 1) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.get("pageSize") ?? 20) || 20));
    const name = query.get("name") ?? undefined;
    const minQuantity = query.get("minQuantity") !== null ? Number(query.get("minQuantity")) : undefined;
    const sortBy = query.get("sortBy") ?? "updatedAt";
    const sortDir = query.get("sortDir") ?? "desc";

    let result: Item[] = rows;
    if (name) {
      const needle = name.toLowerCase();
      result = result.filter((row) => row.name.toLowerCase().includes(needle));
    }
    if (minQuantity !== undefined && Number.isFinite(minQuantity)) {
      result = result.filter((row) => row.quantity >= minQuantity);
    }

    const direction = sortDir === "asc" ? 1 : -1;
    result = [...result].sort((a, b) => {
      const av = a[sortBy as keyof Item];
      const bv = b[sortBy as keyof Item];
      if (av < bv) return -1 * direction;
      if (av > bv) return 1 * direction;
      return 0;
    });

    const start = (page - 1) * pageSize;
    const paged = result.slice(start, start + pageSize);

    const envelope: ListItemsResponse = {
      items: paged,
      total: result.length,
      page,
      pageSize,
    };
    return json(200, envelope);
  };
}

export type { ListItemsResponse, ResourceError, Item };
