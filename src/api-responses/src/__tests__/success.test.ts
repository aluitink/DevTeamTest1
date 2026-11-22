import { expect, test } from "vitest";

import { successResponse, successResponseBody } from "../success.js";

test("successResponse wraps data in { data } and omits meta when not provided", () => {
  const payload = { id: 1, name: "Alice" };
  const result = successResponse(payload);
  expect(result).toEqual({ data: payload });
  expect("meta" in result).toBe(false);
});

test("successResponse includes meta when provided", () => {
  const result = successResponse({ id: 1 }, { page: 1, totalPages: 3 });
  expect(result).toEqual({
    data: { id: 1 },
    meta: { page: 1, totalPages: 3 },
  });
});

test("successResponse omits meta when explicitly null", () => {
  const result = successResponse({ id: 1 }, null as unknown as Record<string, unknown>);
  expect("meta" in result).toBe(false);
});

test("successResponse preserves primitives and collections as data", () => {
  expect(successResponse(42)).toEqual({ data: 42 });
  expect(successResponse([1, 2, 3])).toEqual({ data: [1, 2, 3] });
  expect(successResponse(null)).toEqual({ data: null });
});

test("successResponseBody serializes to the exact JSON shape", () => {
  expect(successResponseBody({ id: 1 })).toBe('{"data":{"id":1}}');
  expect(successResponseBody({ id: 1 }, { page: 2 })).toBe('{"data":{"id":1},"meta":{"page":2}}');
});
