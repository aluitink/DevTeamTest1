import { afterEach, describe, expect, it, vi } from "vitest";

import {
  type Item,
  listItemsResponseSchema,
} from "@devteamtest1/validation";

import {
  ItemsDataError,
  defaultListCacheStrategy,
  getItem,
  listItems,
  parseItem,
  parseListItemsResponse,
  type ItemsDataClient,
} from "../lib/itemsData.js";
import { createItemsApi } from "../data/itemsApi.js";

const clientFrom = (api: (url: string, init?: RequestInit) => Promise<Response>): ItemsDataClient => ({ fetch: api });

const validItem: Item = {
  id: "itm-0001",
  name: "Stainless Screwdriver",
  quantity: 42,
  notes: "Keep in stock",
  createdAt: "2025-11-01T08:00:00Z",
  updatedAt: "2026-01-10T09:30:00Z",
};

const validEnvelope = {
  items: [validItem],
  total: 1,
  page: 1,
  pageSize: 20,
};

const okJson = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseListItemsResponse (Zod boundary)", () => {
  it("returns typed data for a valid envelope", () => {
    const data = parseListItemsResponse(validEnvelope);
    expect(data.items[0]?.id).toBe("itm-0001");
    expect(data.total).toBe(1);
  });

  it("rejects a malformed payload with a typed validation_error", () => {
    expect(() => parseListItemsResponse({ items: "nope" })).toThrow(ItemsDataError);
    try {
      parseListItemsResponse({ items: "nope" });
    } catch (error) {
      expect(error).toBeInstanceOf(ItemsDataError);
      expect((error as ItemsDataError).code).toBe("validation_error");
      expect((error as ItemsDataError).message).not.toContain("stack");
    }
  });

  it("rejects an item with a bad timestamp without leaking raw values", () => {
    expect(() =>
      parseListItemsResponse({ ...validEnvelope, items: [{ ...validItem, updatedAt: "yesterday" }] }),
    ).toThrow(ItemsDataError);
  });

  it("rejects unknown keys (strict schemas)", () => {
    expect(() =>
      parseListItemsResponse({ ...validEnvelope, items: [{ ...validItem, surprise: true }] }),
    ).toThrow(ItemsDataError);
  });
});

describe("parseItem (Zod boundary, single resource)", () => {
  it("accepts a valid item", () => {
    expect(parseItem(validItem).name).toBe("Stainless Screwdriver");
  });
  it("rejects a null notes-free item with extra keys", () => {
    expect(() => parseItem({ ...validItem, extra: 1 })).toThrow(ItemsDataError);
  });
});

describe("listItems — fetch + cache strategy + typed result", () => {
  it("applies the revalidate strategy to the fetch init", async () => {
    const mockFetch = vi.fn(async () => okJson(validEnvelope));
    await listItems({ baseUrl: "http://api.test/items", client: clientFrom(mockFetch) });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("http://api.test/items?");
    expect(url).toContain("page=1");
    expect(url).toContain("pageSize=20");
    expect((init as { next?: { revalidate?: number } }).next?.revalidate).toBe(60);
    expect(init.cache).toBe("default");
  });

  it("uses cache: no-store for explicit no-store strategy", async () => {
    const mockFetch = vi.fn(async () => okJson(validEnvelope));
    await listItems({
      baseUrl: "http://api.test/items",
      client: clientFrom(mockFetch),
      query: { page: 2, name: "Screw", minQuantity: 5, sortBy: "name", sortDir: "asc" },
      strategy: { kind: "no-store" },
    });
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("page=2");
    expect(url).toContain("name=Screw");
    expect(url).toContain("minQuantity=5");
    expect(url).toContain("sortBy=name");
    expect(url).toContain("sortDir=asc");
    expect(init.cache).toBe("no-store");
    expect(init.next).toBeUndefined();
  });

  it("returns the Zod-validated, fully typed envelope", async () => {
    const api = createItemsApi("http://api.test/items");
    const data = await listItems({ baseUrl: "http://api.test/items", client: clientFrom(api) });
    expect(listItemsResponseSchema.safeParse(data).success).toBe(true);
    expect(data.items.every((i) => typeof i.id === "string")).toBe(true);
  });

  it("wraps network failures as ItemsDataError(network_error) with cause", async () => {
    const client: ItemsDataClient = {
      fetch: async () => {
        throw new TypeError("fetch failed");
      },
    };
    await expect(
      listItems({ baseUrl: "http://api.test/items", client }),
    ).rejects.toMatchObject({ code: "network_error" });
    try {
      await listItems({ baseUrl: "http://api.test/items", client });
    } catch (error) {
      expect(error).toBeInstanceOf(ItemsDataError);
      expect((error as ItemsDataError).message).toBe("Could not reach the items service.");
    }
  });

  it("maps HTTP 503 to ItemsDataError(http_error) with status and server message", async () => {
    const api = createItemsApi("http://api.test/items", undefined, { failWith: 503 });
    try {
      await listItems({ baseUrl: "http://api.test/items", client: clientFrom(api) });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ItemsDataError);
      expect((error as ItemsDataError).code).toBe("http_error");
      expect((error as ItemsDataError).status).toBe(503);
      expect((error as ItemsDataError).message).toBe(
        "The items service is temporarily unavailable.",
      );
    }
  });

  it("maps HTTP 404 without a JSON body to a safe generic message", async () => {
    const client: ItemsDataClient = {
      fetch: async () => new Response("nope", { status: 404 }),
    };
    try {
      await listItems({ baseUrl: "http://api.test/items", client });
      expect.unreachable();
    } catch (error) {
      expect((error as ItemsDataError).code).toBe("http_error");
      expect((error as ItemsDataError).status).toBe(404);
      expect((error as ItemsDataError).message).toContain("404");
    }
  });

  it("maps an unreadable JSON body to validation_error", async () => {
    const client: ItemsDataClient = {
      fetch: async () => new Response("<html>not json</html>", { status: 200, headers: { "content-type": "text/html" } }),
    };
    await expect(
      listItems({ baseUrl: "http://api.test/items", client }),
    ).rejects.toMatchObject({ code: "validation_error" });
  });

  it("works against the simulated API end to end (revalidate strategy by default)", async () => {
    const api = createItemsApi("http://api.test/items");
    const data = await listItems({
      baseUrl: "http://api.test/items",
      client: clientFrom(api),
      strategy: defaultListCacheStrategy,
    });
    expect(data.total).toBe(3);
    expect(data.items.length).toBe(3);
  });
});

describe("getItem — single resource, no-store by default", () => {
  it("encodes the id and applies cache: no-store", async () => {
    const mockFetch = vi.fn(async () => okJson(validItem));
    const item = await getItem({ baseUrl: "http://api.test/items", client: clientFrom(mockFetch), id: "itm-0001" });
    expect(item.id).toBe("itm-0001");
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://api.test/items/itm-0001");
    expect(init.cache).toBe("no-store");
  });

  it("surfaces 404 from the simulated API as http_error", async () => {
    const api = createItemsApi("http://api.test/items");
    try {
      await getItem({ baseUrl: "http://api.test/items", client: clientFrom(api), id: "missing" });
      expect.unreachable();
    } catch (error) {
      expect((error as ItemsDataError).code).toBe("http_error");
      expect((error as ItemsDataError).status).toBe(404);
      expect((error as ItemsDataError).message).toBe("No item with id 'missing'.");
    }
  });

  it("re-validates the single-item body at the boundary", async () => {
    const client: ItemsDataClient = {
      fetch: async () => okJson({ ...validItem, quantity: "many" }),
    };
    await expect(
      getItem({ baseUrl: "http://api.test/items", client, id: "itm-0001" }),
    ).rejects.toMatchObject({ code: "validation_error" });
  });
});
