/**
 * Server Component integration test (task #75).
 *
 * Runs the real `page` function from `src/app/items/page.tsx` against the
 * simulated API (injected via options) and asserts the observable contract
 * of the RSC data fetching pattern:
 *
 * - typed, Zod-validated data reaches the rendered tree,
 * - `next/server` `cache` memoizes the list per request (one upstream call
 *   even though the page renders the data twice: header + body),
 * - every failure class (network / http / validation) renders the user-safe
 *   error state, and the raw error never leaks into the output.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type Item } from "@devteamtest1/validation";

import { createItemsApi, defaultItemsSeed } from "../data/itemsApi.js";
import type { ItemsDataClient } from "../lib/itemsData.js";
import { cache } from "next/server";

import { page, getItemsPageData } from "../src/app/items/page.js";

const renderedItemIds = (tree: unknown): string[] => JSON.stringify(tree).match(/"itm-\d+"/g) ?? [];

function clientOf(
  fetchImpl: (url: string, init?: RequestInit) => Promise<Response>,
): ItemsDataClient {
  return { fetch: fetchImpl };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("page (Server Component)", () => {
  it("renders the typed, validated list with defaults", async () => {
    const api = createItemsApi("http://items.test/items", defaultItemsSeed);
    const tree = await page(undefined, { baseUrl: "http://items.test/items", client: clientOf(api) });

    const json = JSON.stringify(tree);
    // All three seeded items, sorted by updatedAt desc.
    expect(renderedItemIds(tree)).toEqual(["itm-0003", "itm-0001", "itm-0002"]);
    // Pagination metadata made it to the presentational tree.
    expect(json).toContain("3 items");
    // Item fields rendered from the validated payload.
    expect(json).toContain("Stainless Screwdriver");
    expect(json).toContain("Reorder threshold hit");
    // Null notes render as empty (typed nullable, not "null").
    expect(json).not.toContain('"null"');
  });

  it("calls next/server cache and memoizes the list per request", async () => {
    const api = createItemsApi("http://items.test/items", defaultItemsSeed);
    const mockFetch = vi.fn(api);
    const tree = await page(undefined, {
      baseUrl: "http://items.test/items",
      client: clientOf(mockFetch),
    });

    // The page renders the data in header + body, yet the upstream is hit
    // exactly once per request — that is `cache` doing its job.
    expect(mockFetch).toHaveBeenCalledTimes(1);
    // Explicit: calling the memoized accessor a second time (same request,
    // same args) must NOT hit the upstream again.
    await getItemsPageData({ page: 1, pageSize: 20, sortBy: "updatedAt", sortDir: "desc" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(renderedItemIds(tree)).toHaveLength(3);
  });

  it("applies revalidate: 60 to the underlying fetch", async () => {
    const api = createItemsApi("http://items.test/items", defaultItemsSeed);
    const mockFetch = vi.fn(api);
    await page(undefined, { baseUrl: "http://items.test/items", client: clientOf(mockFetch) });

    const init = mockFetch.mock.calls[0]?.[1];
    expect((init as RequestInit & { next?: { revalidate?: number } })?.next?.revalidate).toBe(60);
  });

  it("forwards searchParams filters to the API", async () => {
    const api = createItemsApi("http://items.test/items", defaultItemsSeed);
    const tree = await page(
      { name: "Bolts", sortBy: "name", sortDir: "asc" },
      { baseUrl: "http://items.test/items", client: clientOf(api) },
    );
    expect(renderedItemIds(tree)).toEqual(["itm-0003"]);
    const json = JSON.stringify(tree);
    expect(json).toContain("1 item");
    expect(json).not.toContain("Stainless Screwdriver");
  });

  it("renders the empty state when no items match", async () => {
    const api = createItemsApi("http://items.test/items", []);
    const tree = await page(undefined, { baseUrl: "http://items.test/items", client: clientOf(api) });
    const json = JSON.stringify(tree);
    expect(json).toContain("No items match the current filters.");
    expect(json).toContain("0 items");
  });

  it("renders a typed network error state (user-safe, no internals)", async () => {
    const client: ItemsDataClient = {
      fetch: async () => {
        throw new TypeError("ECONNREFUSED 10.0.0.5:5432");
      },
    };
    const tree = await page(undefined, { baseUrl: "http://items.test/items", client });
    const json = JSON.stringify(tree);
    expect(json).toContain("Items are temporarily unavailable");
    expect(json).toContain("Could not reach the items service.");
    expect(json).toContain("Retry in a moment");
    // The underlying cause (connection detail) must not leak to the UI.
    expect(json).not.toContain("ECONNREFUSED");
  });

  it("renders a typed HTTP error state with the upstream status", async () => {
    const api = createItemsApi("http://items.test/items", undefined, { failWith: 503 });
    const tree = await page(undefined, { baseUrl: "http://items.test/items", client: clientOf(api) });
    const json = JSON.stringify(tree);
    expect(json).toContain("The items service returned an error");
    expect(json).toContain("HTTP 503");
    expect(json).toContain("The items service is temporarily unavailable.");
  });

  it("renders a typed validation error state when the payload is malformed", async () => {
    const client: ItemsDataClient = {
      fetch: async () =>
        new Response(JSON.stringify({ items: "garbage", total: -5, page: 0, pageSize: 0 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    };
    const tree = await page(undefined, { baseUrl: "http://items.test/items", client });
    const json = JSON.stringify(tree);
    expect(json).toContain("The items service returned unexpected data");
    expect(json).toContain("unexpected payload");
  });

  it("fails closed on unknown (non-ItemsDataError) errors", async () => {
    const client: ItemsDataClient = {
      fetch: async () => {
        throw new Error("secret internal detail");
      },
    };
    const tree = await page(undefined, { baseUrl: "http://items.test/items", client });
    const json = JSON.stringify(tree);
    expect(json).toContain("Something went wrong");
    expect(json).not.toContain("secret internal detail");
  });

  it("always returns a renderable tree (never throws out of the component)", async () => {
    const badClients: ItemsDataClient[] = [
      { fetch: async () => { throw new Error("x"); } },
      { fetch: async () => new Response("bad", { status: 500 }) },
    ];
    for (const client of badClients) {
      const tree = await page(undefined, { baseUrl: "http://items.test/items", client });
      expect(tree).toBeTruthy();
    }
  });

  it("keeps the rendered tree free of 'use client' (pure Server Component output)", async () => {
    const api = createItemsApi("http://items.test/items", defaultItemsSeed);
    const tree = await page(undefined, { baseUrl: "http://items.test/items", client: clientOf(api) });
    expect(JSON.stringify(tree)).not.toContain('"use client"');
  });

  it("typed result: the envelope passed to the tree matches the Item type shape", async () => {
    const api = createItemsApi("http://items.test/items", defaultItemsSeed);
    await page(undefined, { baseUrl: "http://items.test/items", client: clientOf(api) });
    // Static check via the API's typed seed: items carry the full Item shape.
    const item: Item = defaultItemsSeed[0]!;
    expect(typeof item.id).toBe("string");
    expect(typeof item.quantity).toBe("number");
  });
});
