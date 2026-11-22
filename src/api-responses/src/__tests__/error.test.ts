import { expect, test } from "vitest";

import {
  errorResponse,
  errorResponseFromDetails,
  errorResponseBody,
  getErrorCode,
} from "../error.js";

test("errorResponse produces { error: { code, message } } without details", () => {
  const result = errorResponse("NOT_FOUND", "Resource not found.");
  expect(result).toEqual({ error: { code: "NOT_FOUND", message: "Resource not found." } });
  expect("details" in result.error).toBe(false);
});

test("errorResponse includes details when provided", () => {
  const issues = [{ path: "title", message: "required" }];
  const result = errorResponse("BAD_REQUEST", "Invalid input.", issues);
  expect(result).toEqual({
    error: { code: "BAD_REQUEST", message: "Invalid input.", details: issues },
  });
});

test("errorResponse omits details key when details is undefined but includes it for null", () => {
  const without = errorResponse("X", "msg");
  expect("details" in without.error).toBe(false);

  const withNull = errorResponse("X", "msg", null);
  expect("details" in withNull.error).toBe(true);
  expect(withNull.error.details).toBe(null);
});

test("errorResponseFromDetails wraps an existing details object", () => {
  const result = errorResponseFromDetails({ code: "C", message: "m", details: 5 });
  expect(result).toEqual({ error: { code: "C", message: "m", details: 5 } });
});

test("getErrorCode reads code from a response body or raw details object", () => {
  expect(getErrorCode({ error: { code: "A", message: "m" } })).toBe("A");
  expect(getErrorCode({ code: "B", message: "m" })).toBe("B");
});

test("errorResponseBody serializes to the exact JSON shape", () => {
  expect(
    errorResponseBody(errorResponse("NOT_FOUND", "nope")),
  ).toBe('{"error":{"code":"NOT_FOUND","message":"nope"}}');
});
