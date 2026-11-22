import { expect, test } from "vitest";
import { z } from "zod";

import {
  validateRequest,
  toValidationErrorResult,
  formatValidationIssues,
  RequestValidationError,
  type RequestSchemas,
} from "../validate.js";
import { BadRequestError } from "../api-error.js";

const BodySchema = z.strictObject({
  name: z.string().min(1, "name must not be empty").max(20),
  quantity: z.coerce.number().int().min(0).default(0),
});

const QuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
});

const ParamsSchema = z.strictObject({
  id: z.string().min(1, "id must not be empty"),
});

test("validateRequest returns parsed, typed data on success", () => {
  const result = validateRequest<z.ZodTypeAny, z.ZodTypeAny, typeof BodySchema>(
    { body: BodySchema },
    { body: { name: "Hammer", quantity: "3" } as never },
  );

  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("expected success");
  expect(result.data.body).toEqual({ name: "Hammer", quantity: 3 });
  expect(result.data.params).toBeUndefined();
  expect(result.data.query).toBeUndefined();
});

test("validateRequest validates params, query, and body together", () => {
  const schemas: RequestSchemas<typeof ParamsSchema, typeof QuerySchema, typeof BodySchema> = {
    params: ParamsSchema,
    query: QuerySchema,
    body: BodySchema,
  };

  const result = validateRequest(schemas, {
    params: { id: "42" },
    query: { page: "2" },
    body: { name: "Wrench", quantity: 0 },
  });

  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("expected success");
  expect(result.data.params).toEqual({ id: "42" });
  expect(result.data.query).toEqual({ page: 2 });
  expect(result.data.body).toEqual({ name: "Wrench", quantity: 0 });
});

test("validateRequest applies schema defaults (query coercion)", () => {
  const result = validateRequest<z.ZodTypeAny, typeof QuerySchema, z.ZodTypeAny>(
    { query: QuerySchema },
    { query: {} },
  );

  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("expected success");
  expect(result.data.query).toEqual({ page: 1 });
});

test("validateRequest rejects unknown keys when schemas are strict", () => {
  const result = validateRequest({ body: BodySchema }, {
    body: { name: "Hammer", hacker: true },
  });

  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("expected failure");
  expect(result.error.details).toEqual([
    { part: "body", path: "", message: "Unrecognized key(s) in object: 'hacker'" },
  ]);
});

test("validateRequest returns a RequestValidationError on failure", () => {
  const result = validateRequest({ body: BodySchema }, {
    body: { name: "", quantity: -1 },
  });

  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("expected failure");
  expect(result.error).toBeInstanceOf(RequestValidationError);
  expect(result.error).toBeInstanceOf(BadRequestError);
  expect(result.error.status).toBe(400);
  expect(result.error.code).toBe("BAD_REQUEST");
  expect(result.error.message).toBe("Request validation failed.");
});

test("the validation error exposes flattened, section-tagged issues as details", () => {
  const result = validateRequest(
    { params: ParamsSchema, body: BodySchema },
    { params: { id: "" }, body: { name: "", quantity: -1 } as never },
  );

  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("expected failure");
  expect(result.error.details).toEqual([
    { part: "params", path: "id", message: "id must not be empty" },
    { part: "body", path: "name", message: "name must not be empty" },
    { part: "body", path: "quantity", message: "Number must be greater than or equal to 0" },
  ]);
});

test("the standardized 400 result from toValidationErrorResult matches the error format", () => {
  const result = validateRequest({ body: BodySchema }, { body: { name: "", quantity: 1 } as never });
  expect(result.ok).toBe(false);

  const failure = toValidationErrorResult(result);
  expect(failure).toBeDefined();
  expect(failure?.status).toBe(400);
  expect(failure?.body).toEqual({
    error: {
      code: "BAD_REQUEST",
      message: "Request validation failed.",
      details: [
        { part: "body", path: "name", message: "name must not be empty" },
      ],
    },
  });
});

test("toValidationErrorResult returns undefined on success", () => {
  const result = validateRequest({ body: BodySchema }, {
    body: { name: "Ok", quantity: 1 },
  });
  expect(toValidationErrorResult(result)).toBeUndefined();
});

test("toValidationErrorResult serializes to the canonical JSON error shape", () => {
  const result = validateRequest({ body: BodySchema }, { body: { name: "x", quantity: NaN } as never });
  const failure = toValidationErrorResult(result);
  expect(failure).toBeDefined();
  const json = JSON.parse(JSON.stringify(failure!.body));
  expect(json.error.code).toBe("BAD_REQUEST");
  expect(typeof json.error.message).toBe("string");
  expect(Array.isArray(json.error.details)).toBe(true);
});

test("validateRequest reports issues for all failing sections at once", () => {
  const result = validateRequest(
    { params: ParamsSchema, query: QuerySchema, body: BodySchema },
    {
      params: { id: "" },
      query: { page: "not-a-number" },
      body: { name: "" },
    },
  );

  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("expected failure");
  const parts = (result.error.details as Array<{ part: string }>).map((d) => d.part);
  expect(parts).toContain("params");
  expect(parts).toContain("query");
  expect(parts).toContain("body");
});

test("validateRequest requires at least one schema", () => {
  expect(() => validateRequest({} as never, { body: {} })).toThrow(TypeError);
});

test("validateRequest treats a missing optional section as no error when unschemed", () => {
  // A GET-like route: only a params schema; body is entirely absent.
  const result = validateRequest({ params: ParamsSchema }, { params: { id: "7" } });
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("expected success");
  expect(result.data.params).toEqual({ id: "7" });
});

test("formatValidationIssues flattens Zod issues with dotted paths", () => {
  const NestedSchema = z.strictObject({
    items: z.array(z.strictObject({ name: z.string().min(1) })).min(1, "at least one item"),
  });
  const parsed = NestedSchema.safeParse({ items: [{ name: "" }, { name: "ok" }] });
  expect(parsed.success).toBe(false);
  if (parsed.success) throw new Error("expected failure");

  const issues = formatValidationIssues("body", parsed.error);
  expect(issues).toEqual([
    { part: "body", path: "items.0.name", message: "String must contain at least 1 character(s)" },
  ]);
});

test("RequestValidationError is an ApiError with client-safe details", () => {
  const error = new RequestValidationError([
    { part: "query", path: "page", message: "bad page" },
  ]);
  expect(error.exposeDetails).toBe(true);
  expect(error.toErrorDetails()).toEqual({
    code: "BAD_REQUEST",
    message: "Request validation failed.",
    details: [{ part: "query", path: "page", message: "bad page" }],
  });
});
