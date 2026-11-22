import { z } from "zod";
import { describe, expect, it } from "vitest";

import {
  IdSchema,
  IsoDateTimeSchema,
  PaginationQuerySchema,
  ResourceErrorSchema,
  createIdPathParams,
  createListResponseSchema,
  createResourceSchemas,
} from "../src/index.js";

describe("IdSchema", () => {
  it("accepts a non-empty string", () => {
    expect(IdSchema.safeParse("abc").success).toBe(true);
  });

  it("rejects an empty string", () => {
    expect(IdSchema.safeParse("").success).toBe(false);
  });

  it("rejects a value with path separators", () => {
    expect(IdSchema.safeParse("a/b").success).toBe(false);
  });
});

describe("IsoDateTimeSchema", () => {
  it("accepts a valid ISO 8601 timestamp", () => {
    expect(IsoDateTimeSchema.safeParse("2026-01-02T03:04:05Z").success).toBe(true);
  });

  it("rejects a plain date", () => {
    expect(IsoDateTimeSchema.safeParse("2026-01-02").success).toBe(false);
  });
});

describe("PaginationQuerySchema", () => {
  it("applies defaults", () => {
    const result = PaginationQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(20);
    }
  });

  it("rejects a zero page", () => {
    expect(PaginationQuerySchema.safeParse({ page: 0 }).success).toBe(false);
  });
});

describe("createIdPathParams", () => {
  it("builds a strict single-parameter schema", () => {
    const schema = createIdPathParams("id");
    expect(schema.safeParse({ id: "x" }).success).toBe(true);
    expect(schema.safeParse({ id: "" }).success).toBe(false);
    expect(schema.safeParse({ id: "x", other: 1 }).success).toBe(false);
  });
});

describe("createListResponseSchema", () => {
  it("wraps an item schema in a list envelope", () => {
    const envelope = createListResponseSchema(z.strictObject({ v: z.number() }));
    expect(
      envelope.safeParse({ items: [{ v: 1 }], total: 1, page: 1, pageSize: 20 }).success,
    ).toBe(true);
    expect(
      envelope.safeParse({ items: [], total: 0, page: 1, pageSize: 20 }).success,
    ).toBe(true);
    expect(envelope.safeParse({ items: [], total: 0 }).success).toBe(false);
  });
});

describe("ResourceErrorSchema", () => {
  it("accepts a standard error envelope", () => {
    expect(
      ResourceErrorSchema.safeParse({
        error: {
          code: "validation_error",
          message: "Invalid input",
          issues: [{ path: ["name"], message: "too short" }],
        },
      }).success,
    ).toBe(true);
  });

  it("rejects an error without a code", () => {
    expect(
      ResourceErrorSchema.safeParse({ error: { message: "Invalid input" } }).success,
    ).toBe(false);
  });
});

describe("createResourceSchemas (future-resource pattern)", () => {
  it("produces the canonical set of schemas", () => {
    const createInput = z.strictObject({ title: z.string().min(1) });
    const output = createInput.extend({ id: IdSchema });
    const todos = createResourceSchemas(createInput, output, "todo");

    expect(todos.name).toBe("todo");
    expect(todos.createInputSchema.safeParse({ title: "x" }).success).toBe(true);
    expect(todos.pathParamsSchema.safeParse({ id: "x" }).success).toBe(true);
    expect(todos.listQuerySchema.safeParse({}).success).toBe(true);
    expect(
      todos.listResponseSchema.safeParse({
        items: [{ id: "1", title: "x" }],
        total: 1,
        page: 1,
        pageSize: 20,
      }).success,
    ).toBe(true);
    expect(todos.errorSchema === ResourceErrorSchema).toBe(true);
  });
});
