import { expect, test } from "vitest";

import {
  withErrorHandler,
  type RouteHandler,
  type RouteRequest,
} from "../handler.js";
import { successResponse } from "../success.js";
import { BadRequestError, NotFoundError } from "../api-error.js";

const request: RouteRequest = {
  method: "GET",
  path: "/todos/1",
  query: {},
};

test("withErrorHandler returns successful results untouched", async () => {
  const handler: RouteHandler<{ id: number }> = () => ({
    status: 200,
    body: successResponse({ id: 1 }),
  });

  const wrapped = withErrorHandler(handler);
  const result = await wrapped(request);
  expect(result.status).toBe(200);
  expect(result.body).toEqual({ data: { id: 1 } });
});

test("withErrorHandler supports async handlers", async () => {
  const wrapped = withErrorHandler<{ id: number }>(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    return { status: 201, body: successResponse({ id: 2 }) };
  });

  const result = await wrapped(request);
  expect(result.status).toBe(201);
  expect(result.body).toEqual({ data: { id: 2 } });
});

test("withErrorHandler converts a thrown ApiError to its standardized body", async () => {
  const wrapped = withErrorHandler<never>(() => {
    throw new NotFoundError("No such todo.");
  });

  const result = await wrapped(request);
  expect(result.status).toBe(404);
  expect(result.body).toEqual({
    error: { code: "NOT_FOUND", message: "No such todo." },
  });
});

test("withErrorHandler exposes details for ApiErrors that allow it", async () => {
  const issues = [{ path: "title", message: "required" }];
  const wrapped = withErrorHandler<never>(() => {
    throw new BadRequestError("Invalid input.", issues);
  });

  const result = await wrapped(request);
  expect(result.status).toBe(400);
  expect(result.body).toEqual({
    error: { code: "BAD_REQUEST", message: "Invalid input.", details: issues },
  });
});

test("withErrorHandler converts an unexpected Error to a sanitized 500", async () => {
  const wrapped = withErrorHandler<never>(() => {
    throw new Error("SQL: SELECT * FROM secrets -- do not leak");
  });

  const result = await wrapped(request);
  expect(result.status).toBe(500);
  expect(result.body).toEqual({
    error: { code: "INTERNAL", message: "An unexpected error occurred." },
  });
});

test("withErrorHandler converts non-Error throws to a 500", async () => {
  const wrapped = withErrorHandler<never>(() => {
    throw "a string, not an Error";
  });

  const result = await wrapped(request);
  expect(result.status).toBe(500);
  expect(result.body).toEqual({
    error: { code: "INTERNAL", message: "An unexpected error occurred." },
  });
});

test("withErrorHandler honors a custom statusForError override", async () => {
  const wrapped = withErrorHandler<never>(
    () => {
      throw new NotFoundError("gone");
    },
    { statusForError: () => 599 },
  );

  const result = await wrapped(request);
  expect(result.status).toBe(599);
  expect(result.body).toEqual({ error: { code: "NOT_FOUND", message: "gone" } });
});

test("the wrapped handler receives the request it was called with", async () => {
  let seen: RouteRequest | undefined;
  const wrapped = withErrorHandler<string>(async (req) => {
    seen = req;
    return { status: 200, body: successResponse(req.path) };
  });

  const req: RouteRequest = { method: "POST", path: "/todos", query: { a: "1" } };
  const result = await wrapped(req);
  expect(seen).toBe(req);
  expect(result.body).toEqual({ data: "/todos" });
});
