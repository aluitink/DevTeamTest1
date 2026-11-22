import { expect, test } from "vitest";
import { z } from "zod";

import {
  withErrorHandler,
  type RouteRequest,
  type RouteHandler,
} from "../handler.js";
import { successResponse } from "../success.js";
import {
  validateRequest,
  toValidationErrorResult,
  isValidationSuccess,
} from "../validate.js";
import { jsonRouteResult } from "../respond.js";

const CreateTodoSchema = z.strictObject({
  title: z.string().min(1, "title is required"),
});
const TodoIdParamsSchema = z.strictObject({
  id: z.string().min(1),
});

/**
 * End-to-end: a POST /todos route that validates its body, returns a
 * standardized 400 on invalid input, and a `{ data }` envelope on success —
 * all converted to a framework-free JSON response by `jsonRouteResult`.
 */
function buildCreateTodoRoute() {
  const handler: RouteHandler<{ id: number }> = async (req) => {
    const validation = validateRequest<z.ZodTypeAny, z.ZodTypeAny, typeof CreateTodoSchema>(
      { body: CreateTodoSchema },
      { body: req.body },
    );
    const failure = toValidationErrorResult(validation);
    if (failure || !isValidationSuccess(validation)) return failure ?? { status: 500, body: { error: { code: "INTERNAL", message: "unreachable" } } };

    const { title } = validation.data.body as { title: string };
    return { status: 201, body: successResponse({ id: 1, title }) };
  };

  return withErrorHandler(handler);
}

test("invalid body yields the standardized 400 error JSON", async () => {
  const route = buildCreateTodoRoute();
  const request: RouteRequest = {
    method: "POST",
    path: "/todos",
    query: {},
    body: { title: "" },
  };

  const response = jsonRouteResult(await route(request));
  expect(response.status).toBe(400);
  expect(response.headers["Content-Type"]).toBe("application/json");
  expect(JSON.parse(response.body)).toEqual({
    error: {
      code: "BAD_REQUEST",
      message: "Request validation failed.",
      details: [{ part: "body", path: "title", message: "title is required" }],
    },
  });
});

test("valid body yields the standardized success JSON", async () => {
  const route = buildCreateTodoRoute();
  const request: RouteRequest = {
    method: "POST",
    path: "/todos",
    query: {},
    body: { title: "Ship it" },
  };

  const response = jsonRouteResult(await route(request));
  expect(response.status).toBe(201);
  expect(JSON.parse(response.body)).toEqual({ data: { id: 1, title: "Ship it" } });
});

test("params validation composes with the handler wrapper for id routes", async () => {
  const handler: RouteHandler<{ id: string }> = async (req) => {
    const validation = validateRequest({ params: TodoIdParamsSchema }, { params: req.query });
    const failure = toValidationErrorResult(validation);
    if (failure || !isValidationSuccess(validation)) return failure ?? { status: 500, body: { error: { code: "INTERNAL", message: "unreachable" } } };
    return { status: 200, body: successResponse({ id: validation.data.params.id }) };
  };

  const route = withErrorHandler(handler);
  const missing = jsonRouteResult(await route({ method: "GET", path: "/todos/x", query: {} }));
  expect(missing.status).toBe(400);

  const found = jsonRouteResult(
    await route({ method: "GET", path: "/todos/x", query: { id: "42" } }),
  );
  expect(found.status).toBe(200);
  expect(JSON.parse(found.body)).toEqual({ data: { id: "42" } });
});
