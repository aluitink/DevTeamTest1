import { test } from "node:test";
import assert from "node:assert/strict";
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

  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("expected success");
  assert.deepEqual(result.data.body, { name: "Hammer", quantity: 3 });
  assert.equal(result.data.params, undefined);
  assert.equal(result.data.query, undefined);
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

  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("expected success");
  assert.deepEqual(result.data.params, { id: "42" });
  assert.deepEqual(result.data.query, { page: 2 });
  assert.deepEqual(result.data.body, { name: "Wrench", quantity: 0 });
});

test("validateRequest applies schema defaults (query coercion)", () => {
  const result = validateRequest<z.ZodTypeAny, typeof QuerySchema, z.ZodTypeAny>(
    { query: QuerySchema },
    { query: {} },
  );

  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("expected success");
  assert.deepEqual(result.data.query, { page: 1 });
});

test("validateRequest returns a RequestValidationError on failure", () => {
  const result = validateRequest({ body: BodySchema }, {
    body: { name: "", quantity: -1 },
  });

  assert.equal(result.ok, false);
  if (result.ok) throw new Error("expected failure");
  assert.ok(result.error instanceof RequestValidationError);
  assert.ok(result.error instanceof BadRequestError);
  assert.equal(result.error.status, 400);
  assert.equal(result.error.code, "BAD_REQUEST");
  assert.equal(result.error.message, "Request validation failed.");
});

test("the validation error exposes flattened, section-tagged issues as details", () => {
  const result = validateRequest(
    { params: ParamsSchema, body: BodySchema },
    { params: { id: "" }, body: { name: "", quantity: -1 } as never },
  );

  assert.equal(result.ok, false);
  if (result.ok) throw new Error("expected failure");
  const details = result.error.details;
  assert.ok(Array.isArray(details));
  assert.deepEqual(details, [
    { part: "params", path: "id", message: "id must not be empty" },
    { part: "body", path: "name", message: "name must not be empty" },
    { part: "body", path: "quantity", message: "Number must be greater than or equal to 0" },
  ]);
});

test("the standardized 400 result from toValidationErrorResult matches the error format", () => {
  const result = validateRequest({ body: BodySchema }, { body: { name: "", quantity: 1 } as never });
  assert.equal(result.ok, false);

  const failure = toValidationErrorResult(result);
  assert.ok(failure !== undefined);
  assert.equal(failure?.status, 400);
  assert.deepEqual(failure?.body, {
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
  assert.equal(toValidationErrorResult(result), undefined);
});

test("toValidationErrorResult serializes to the canonical JSON error shape", () => {
  const result = validateRequest({ body: BodySchema }, { body: { name: "x", quantity: NaN } as never });
  const failure = toValidationErrorResult(result);
  assert.ok(failure !== undefined);
  const json = JSON.parse(JSON.stringify(failure!.body));
  assert.equal(json.error.code, "BAD_REQUEST");
  assert.ok(typeof json.error.message === "string");
  assert.ok(Array.isArray(json.error.details));
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

  assert.equal(result.ok, false);
  if (result.ok) throw new Error("expected failure");
  const parts = (result.error.details as Array<{ part: string }>).map((d) => d.part);
  assert.ok(parts.includes("params"));
  assert.ok(parts.includes("query"));
  assert.ok(parts.includes("body"));
});

test("validateRequest requires at least one schema", () => {
  assert.throws(
    () => validateRequest({} as never, { body: {} }),
    TypeError,
  );
});

test("validateRequest treats a missing optional section as no error when unschemed", () => {
  // A GET-like route: only a params schema; body is entirely absent.
  const result = validateRequest({ params: ParamsSchema }, { params: { id: "7" } });
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("expected success");
  assert.deepEqual(result.data.params, { id: "7" });
});

test("formatValidationIssues flattens Zod issues with dotted paths", () => {
  const NestedSchema = z.strictObject({
    items: z.array(z.strictObject({ name: z.string().min(1) })).min(1, "at least one item"),
  });
  const parsed = NestedSchema.safeParse({ items: [{ name: "" }, { name: "ok" }] });
  assert.equal(parsed.success, false);
  if (parsed.success) throw new Error("expected failure");

  const issues = formatValidationIssues("body", parsed.error);
  assert.deepEqual(issues, [
    { part: "body", path: "items.0.name", message: "String must contain at least 1 character(s)" },
  ]);
});

test("RequestValidationError is an ApiError with client-safe details", () => {
  const error = new RequestValidationError([
    { part: "query", path: "page", message: "bad page" },
  ]);
  assert.equal(error.exposeDetails, true);
  assert.deepEqual(error.toErrorDetails(), {
    code: "BAD_REQUEST",
    message: "Request validation failed.",
    details: [{ part: "query", path: "page", message: "bad page" }],
  });
});
