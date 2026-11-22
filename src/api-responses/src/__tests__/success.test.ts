import { test } from "node:test";
import assert from "node:assert/strict";

import { successResponse, successResponseBody } from "../success.js";

test("successResponse wraps data in { data } and omits meta when not provided", () => {
  const payload = { id: 1, name: "Alice" };
  const result = successResponse(payload);
  assert.deepEqual(result, { data: payload });
  assert.equal("meta" in result, false);
});

test("successResponse includes meta when provided", () => {
  const result = successResponse({ id: 1 }, { page: 1, totalPages: 3 });
  assert.deepEqual(result, {
    data: { id: 1 },
    meta: { page: 1, totalPages: 3 },
  });
});

test("successResponse omits meta when explicitly null", () => {
  const result = successResponse({ id: 1 }, null as unknown as Record<string, unknown>);
  assert.equal("meta" in result, false);
});

test("successResponse preserves primitives and collections as data", () => {
  assert.deepEqual(successResponse(42), { data: 42 });
  assert.deepEqual(successResponse([1, 2, 3]), { data: [1, 2, 3] });
  assert.deepEqual(successResponse(null), { data: null });
});

test("successResponseBody serializes to the exact JSON shape", () => {
  assert.equal(successResponseBody({ id: 1 }), '{"data":{"id":1}}');
  assert.equal(
    successResponseBody({ id: 1 }, { page: 2 }),
    '{"data":{"id":1},"meta":{"page":2}}',
  );
});
