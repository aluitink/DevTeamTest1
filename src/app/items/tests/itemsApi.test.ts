import { describe, expect, it } from "vitest";

import {
  type Item,
  listItemsResponseSchema,
  listItemsQuerySchema,
} from "@devteamtest1/validation";

import {
  createItemsApi,
  defaultItemsSeed,
  type RequestInitLike,
} from "../data/itemsApi.js";

function jsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function httpError(status: number, message: string): Response {
  return jsonResponse(status, { error: { code: "boom", message } });
}

describe("createItemsApi — simulated GET /items", () => {
  it("returns the full envelope with defaults (page 1, pageSize 20, sorted updatedAt desc)", async () => {
    const api = createItemsApi("http://items.test/items");
    const response = await api("http://items.test/items");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(listItemsResponseSchema.safeParse(body).success).toBe(true);
    expect(body.total).toBe(3);
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(20);
    expect(body.items.map((i: Item) => i.id)).toEqual(["itm-0003", "itm-0001", "itm-0002"]);
  });

  it("honors page and pageSize", async () => {
    const api = createItemsApi("http://items.test/items");
    const response = await api("http://items.test/items?page=2&pageSize=2&sortBy=name&sortDir=asc");
    const body = await response.json();
    expect(body.items.map((i: Item) => i.id)).toEqual(["itm-0002", "itm-0003"]);
    expect(body.total).toBe(3);
  });

  it("filters by name and minQuantity", async () => {
    const api = createItemsApi("http://items.test/items");
    const byName = await (await api("http://items.test/items?name=Bolts")).json();
    expect(byName.items.map((i: Item) => i.id)).toEqual(["itm-0003"]);
    const byQty = await (await api("http://items.test/items?minQuantity=10")).json();
    expect(byQty.items.map((i: Item) => i.id)).toEqual(["itm-0001"]);
  });

  it("returns 404 for an unknown route", async () => {
    const api = createItemsApi("http://items.test/items");
    const response = await api("http://items.test/widgets");
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe("not_found");
  });

  it("returns 405 for non-GET methods", async () => {
    const api = createItemsApi("http://items.test/items");
    const response = await api("http://items.test/items", { method: "POST" } satisfies RequestInitLike);
    expect(response.status).toBe(405);
  });

  it("returns 200 for an unknown id-shaped list", async () => {
    const api = createItemsApi("http://items.test/items");
    const response = await api("http://items.test/items/itm-0001");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.id).toBe("itm-0001");
    expect(body.name).toBe("Stainless Screwdriver");
  });

  it("returns 404 for a missing item id", async () => {
    const api = createItemsApi("http://items.test/items");
    const response = await api("http://items.test/items/nope");
    expect(response.status).toBe(404);
  });

  it("supports an empty database (empty list, not an error)", async () => {
    const api = createItemsApi("http://items.test/items", []);
    const body = await (await api("http://items.test/items")).json();
    expect(body.items).toEqual([]);
    expect(body.total).toBe(0);
  });

  it("simulates an unavailable upstream with failWith", async () => {
    const api = createItemsApi("http://items.test/items", undefined, { failWith: 503 });
    const response = await api("http://items.test/items");
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error.code).toBe("upstream_unavailable");
  });
});

describe("simulated API output is always Zod-valid", () => {
  it("list envelope parses against listItemsResponseSchema for every seed row shape", async () => {
    const api = createItemsApi("http://items.test/items", defaultItemsSeed);
    const body = await (await api("http://items.test/items")).json();
    const result = listItemsResponseSchema.safeParse(body);
    expect(result.success).toBe(true);
  });

  it("list query defaults match listItemsQuerySchema output", () => {
    const parsed = listItemsQuerySchema.parse({});
    expect(parsed).toEqual({ page: 1, pageSize: 20, sortBy: "updatedAt", sortDir: "desc" });
  });

  it("error envelopes are JSON objects with code + message", async () => {
    const api = createItemsApi("http://items.test/items");
    for (const url of ["http://items.test/nope", "http://items.test/items/missing"]) {
      const response = await api(url);
      expect(response.ok).toBe(false);
      const body = await response.json();
      expect(typeof body.error.code).toBe("string");
      expect(typeof body.error.message).toBe("string");
    }
  });
});
