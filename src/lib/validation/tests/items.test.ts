import { describe, expect, it } from "vitest";

import {
  CreateItemRequestSchema,
  ItemSchema,
  UpdateItemRequestSchema,
  itemPathParamsSchema,
  listItemsQuerySchema,
  listItemsResponseSchema,
} from "../src/index.js";

const validItem = {
  id: "a1b2c3",
  name: "Widget",
  quantity: 3,
  notes: "keep in stock",
  createdAt: "2026-01-02T03:04:05Z",
  updatedAt: "2026-01-02T03:04:05Z",
};

describe("CreateItemRequestSchema (POST /items body)", () => {
  it("accepts a valid body", () => {
    const result = CreateItemRequestSchema.safeParse({ name: "Widget", quantity: 3 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.quantity).toBe(3);
      expect(result.data.notes).toBeUndefined();
    }
  });

  it("defaults quantity to 0", () => {
    const result = CreateItemRequestSchema.safeParse({ name: "Widget" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.quantity).toBe(0);
  });

  it("rejects an empty name", () => {
    const result = CreateItemRequestSchema.safeParse({ name: "   " });
    expect(result.success).toBe(false);
  });

  it("rejects a non-integer quantity", () => {
    const result = CreateItemRequestSchema.safeParse({ name: "Widget", quantity: 1.5 });
    expect(result.success).toBe(false);
  });

  it("rejects unknown keys (strict)", () => {
    const result = CreateItemRequestSchema.safeParse({ name: "Widget", hacker: true });
    expect(result.success).toBe(false);
  });
});

describe("UpdateItemRequestSchema (PUT /items/:id body)", () => {
  it("accepts a valid full body", () => {
    const result = UpdateItemRequestSchema.safeParse({
      name: "Widget",
      quantity: 10,
      notes: "updated",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid full body", () => {
    const result = UpdateItemRequestSchema.safeParse({
      name: "Widget",
      quantity: 10,
      notes: "updated",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing required field", () => {
    const result = UpdateItemRequestSchema.safeParse({ name: "Widget" });
    expect(result.success).toBe(false);
  });

  it("rejects a negative quantity", () => {
    const result = UpdateItemRequestSchema.safeParse({ name: "Widget", quantity: -1 });
    expect(result.success).toBe(false);
  });
});

describe("itemPathParamsSchema (GET /items/:id path params)", () => {
  it("accepts a valid id", () => {
    const result = itemPathParamsSchema.safeParse({ id: "abc-123" });
    expect(result.success).toBe(true);
  });

  it("rejects an empty id", () => {
    const result = itemPathParamsSchema.safeParse({ id: "" });
    expect(result.success).toBe(false);
  });

  it("rejects ids with whitespace or slashes", () => {
    expect(itemPathParamsSchema.safeParse({ id: "a b" }).success).toBe(false);
    expect(itemPathParamsSchema.safeParse({ id: "a/b" }).success).toBe(false);
  });

  it("rejects unknown keys", () => {
    expect(itemPathParamsSchema.safeParse({ id: "x", extra: "y" }).success).toBe(false);
  });
});

describe("listItemsQuerySchema (GET /items query params)", () => {
  it("applies defaults to an empty query", () => {
    const result = listItemsQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        page: 1,
        pageSize: 20,
        sortBy: "updatedAt",
        sortDir: "desc",
      });
    }
  });

  it("accepts valid filters", () => {
    const result = listItemsQuerySchema.safeParse({
      page: "2", // string from the URL, coerced
      pageSize: "50",
      name: "Widget",
      minQuantity: 1,
      sortBy: "name",
      sortDir: "asc",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.page).toBe(2);
  });

  it("rejects pageSize above the cap", () => {
    const result = listItemsQuerySchema.safeParse({ pageSize: 101 });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid sortDir", () => {
    const result = listItemsQuerySchema.safeParse({ sortDir: "sideways" });
    expect(result.success).toBe(false);
  });
});

describe("ItemSchema (single-item response payload)", () => {
  it("accepts a valid item", () => {
    expect(ItemSchema.safeParse(validItem).success).toBe(true);
  });

  it("accepts null notes", () => {
    const { notes, ...rest } = validItem;
    expect(ItemSchema.safeParse({ ...rest, notes: null }).success).toBe(true);
  });

  it("rejects a malformed timestamp", () => {
    expect(
      ItemSchema.safeParse({ ...validItem, updatedAt: "yesterday" }).success,
    ).toBe(false);
  });

  it("rejects unknown keys", () => {
    expect(ItemSchema.safeParse({ ...validItem, surprise: 1 }).success).toBe(false);
  });
});

describe("listItemsResponseSchema (GET /items response payload)", () => {
  it("accepts a valid envelope", () => {
    const result = listItemsResponseSchema.safeParse({
      items: [validItem],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    expect(result.success).toBe(true);
  });

  it("accepts an empty list", () => {
    const result = listItemsResponseSchema.safeParse({ items: [], total: 0, page: 1, pageSize: 20 });
    expect(result.success).toBe(true);
  });

  it("rejects a negative total", () => {
    const result = listItemsResponseSchema.safeParse({ items: [], total: -1, page: 1, pageSize: 20 });
    expect(result.success).toBe(false);
  });
});
