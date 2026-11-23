/**
 * Tests for the `items` CRUD API route handlers (task #74).
 *
 * Covers every acceptance criterion at the HTTP boundary:
 *
 * - collection: `GET /items` (list + query validation), `POST /items`
 *   (create + body validation),
 * - item: `GET /items/:id`, `PUT /items/:id`, `DELETE /items/:id`
 *   (param + body validation),
 * - standardized response format (`{ data }` / `{ error }`),
 * - unhandled service errors are caught by the `withErrorHandler` wrapper
 *   and converted to standardized error responses.
 *
 * The routes call the placeholder `itemsService` (dummy data); no business
 * logic is exercised or asserted on. `next/server` is mocked by
 * `vitest.config.ts` so the routes can run without a Next.js install.
 */
import { describe, expect, it } from "vitest";

import { GET as collectionGet, POST as collectionPost } from "../api/items/route.js";
import {
  DELETE as itemDelete,
  GET as itemGet,
  PUT as itemPut,
} from "../api/items/[id]/route.js";

function jsonRequest(url: string, init?: RequestInit): Request {
  return new Request(url, init);
}

/** A minimal Next.js-style response: status + JSON body. */
async function readJson(response: unknown): Promise<{ status: number; body: any }> {
  const res = response as { status: number; json: () => Promise<unknown> };
  return { status: res.status, body: await res.json() };
}

const ctx = (id: string) => ({ params: { id } });

// --- GET /items (collection) -------------------------------------------------

describe("GET /items", () => {
  it("lists items with pagination meta (default query)", async () => {
    const { status, body } = await readJson(await collectionGet(jsonRequest("http://localhost/items")));
    expect(status).toBe(200);
    expect(body.data).toBeInstanceOf(Array);
    expect(body.meta.total).toBe(3);
    expect(body.meta.page).toBe(1);
    expect(body.meta.pageSize).toBe(20);
    expect(body.data[0]).toHaveProperty("id");
  });

  it("applies query filters", async () => {
    const { status, body } = await readJson(
      await collectionGet(jsonRequest("http://localhost/items?name=Bolts&minQuantity=0")),
    );
    expect(status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe("itm-0003");
  });

  it("returns a standardized 400 for invalid query params", async () => {
    const { status, body } = await readJson(
      await collectionGet(jsonRequest("http://localhost/items?page=0")),
    );
    expect(status).toBe(400);
    expect(body.error.code).toBe("BAD_REQUEST");
    expect(body.error.details[0].part).toBe("query");
  });

  it("rejects unknown query params (strict schema)", async () => {
    const { status, body } = await readJson(
      await collectionGet(jsonRequest("http://localhost/items?bogus=1")),
    );
    expect(status).toBe(400);
    expect(body.error.code).toBe("BAD_REQUEST");
  });
});

// --- POST /items (collection) ------------------------------------------------

describe("POST /items", () => {
  it("creates an item with a valid body (201 + { data })", async () => {
    const { status, body } = await readJson(
      await collectionPost(
        jsonRequest("http://localhost/items", {
          method: "POST",
          body: JSON.stringify({ name: "Socket Wrench" }),
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    expect(status).toBe(201);
    expect(body.data).toMatchObject({ name: "Socket Wrench", quantity: 0 });
    expect(body.data).toHaveProperty("id");
  });

  it("returns a standardized 400 for an invalid body", async () => {
    const { status, body } = await readJson(
      await collectionPost(
        jsonRequest("http://localhost/items", {
          method: "POST",
          body: JSON.stringify({ name: "" }),
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    expect(status).toBe(400);
    expect(body.error.code).toBe("BAD_REQUEST");
    expect(body.error.details.some((issue: any) => issue.part === "body")).toBe(true);
  });

  it("returns a standardized 400 for malformed JSON", async () => {
    const { status, body } = await readJson(
      await collectionPost(
        jsonRequest("http://localhost/items", {
          method: "POST",
          body: "{not json",
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    expect(status).toBe(400);
    expect(body.error.code).toBe("BAD_REQUEST");
  });
});

// --- GET/PUT/DELETE /items/:id -----------------------------------------------

describe("item routes", () => {
  it("GET /items/:id returns the item (200 + { data })", async () => {
    const { status, body } = await readJson(await itemGet(jsonRequest("http://localhost/items/itm-0001"), ctx("itm-0001")));
    expect(status).toBe(200);
    expect(body.data).toMatchObject({ id: "itm-0001", name: "Stainless Screwdriver" });
  });

  it("GET /items/:id returns a standardized 404 when the service throws NotFoundError", async () => {
    const { status, body } = await readJson(await itemGet(jsonRequest("http://localhost/items/itm-nope"), ctx("itm-nope")));
    expect(status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("item routes return a standardized 400 for an invalid :id param", async () => {
    for (const call of [
      itemGet(jsonRequest("http://localhost/items/"), ctx("")),
      itemDelete(jsonRequest("http://localhost/items/"), ctx("bad id")),
      itemPut(
        jsonRequest("http://localhost/items/", {
          method: "PUT",
          body: JSON.stringify({ name: "X", quantity: 1 }),
          headers: { "content-type": "application/json" },
        }),
        ctx("bad id"),
      ),
    ]) {
      const { status, body } = await readJson(await call);
      expect(status).toBe(400);
      expect(body.error.code).toBe("BAD_REQUEST");
      expect(body.error.details.some((issue: any) => issue.part === "params")).toBe(true);
    }
  });

  it("PUT /items/:id replaces the item (200 + { data })", async () => {
    const { status, body } = await readJson(
      await itemPut(
        jsonRequest("http://localhost/items/itm-0002", {
          method: "PUT",
          body: JSON.stringify({ name: "Copper Wire, 22 AWG (updated)", quantity: 9 }),
          headers: { "content-type": "application/json" },
        }),
        ctx("itm-0002"),
      ),
    );
    expect(status).toBe(200);
    expect(body.data).toMatchObject({ id: "itm-0002", quantity: 9 });
  });

  it("PUT /items/:id returns a standardized 400 for an invalid body", async () => {
    const { status, body } = await readJson(
      await itemPut(
        jsonRequest("http://localhost/items/itm-0002", {
          method: "PUT",
          body: JSON.stringify({ name: "Copper Wire" }), // missing quantity
          headers: { "content-type": "application/json" },
        }),
        ctx("itm-0002"),
      ),
    );
    expect(status).toBe(400);
    expect(body.error.code).toBe("BAD_REQUEST");
    expect(body.error.details.some((issue: any) => issue.part === "body")).toBe(true);
  });

  it("DELETE /items/:id deletes the item (200 + { data: { id } })", async () => {
    const { status, body } = await readJson(
      await itemDelete(jsonRequest("http://localhost/items/itm-0001"), ctx("itm-0001")),
    );
    expect(status).toBe(200);
    expect(body.data).toEqual({ id: "itm-0001" });
  });

  it("DELETE /items/:id returns a standardized 404 for a missing id", async () => {
    const { status, body } = await readJson(
      await itemDelete(jsonRequest("http://localhost/items/itm-nope"), ctx("itm-nope")),
    );
    expect(status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });
});
