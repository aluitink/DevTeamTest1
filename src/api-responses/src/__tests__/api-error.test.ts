import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ApiError,
  BadRequestError,
  InternalServerError,
  NotFoundError,
} from "../api-error.js";

test("ApiError carries status, code, message, and optional details", () => {
  const error = new ApiError(422, "CONFLICT", "already exists", { id: 7 });
  assert.equal(error.status, 422);
  assert.equal(error.code, "CONFLICT");
  assert.equal(error.message, "already exists");
  assert.deepEqual(error.details, { id: 7 });
  assert.ok(error instanceof Error);
  assert.ok(error instanceof ApiError);
});

test("toErrorDetails hides details unless exposeDetails is true", () => {
  const hidden = new ApiError(500, "INTERNAL", "boom", { secret: true });
  assert.deepEqual(hidden.toErrorDetails(), { code: "INTERNAL", message: "boom" });

  const exposed = new ApiError(400, "BAD_REQUEST", "bad", { issues: [] }, { exposeDetails: true });
  assert.deepEqual(exposed.toErrorDetails(), {
    code: "BAD_REQUEST",
    message: "bad",
    details: { issues: [] },
  });
});

test("ApiError preserves the cause and sets the constructor name", () => {
  const cause = new TypeError("inner");
  const error = new ApiError(500, "INTERNAL", "wrapped", undefined, { cause });
  assert.equal((error as Error & { cause?: unknown }).cause, cause);
  assert.equal(error.name, "ApiError");
});

test("BadRequestError defaults to 400/BAD_REQUEST and exposes details", () => {
  const error = new BadRequestError("Invalid title.", { issues: [{ path: "title" }] });
  assert.equal(error.status, 400);
  assert.equal(error.code, "BAD_REQUEST");
  assert.equal(error.exposeDetails, true);
  assert.deepEqual(error.toErrorDetails(), {
    code: "BAD_REQUEST",
    message: "Invalid title.",
    details: { issues: [{ path: "title" }] },
  });
});

test("NotFoundError defaults to 404/NOT_FOUND and hides details", () => {
  const error = new NotFoundError("No such todo.");
  assert.equal(error.status, 404);
  assert.equal(error.code, "NOT_FOUND");
  assert.equal(error.name, "NotFoundError");
  assert.deepEqual(error.toErrorDetails(), { code: "NOT_FOUND", message: "No such todo." });
});

test("InternalServerError defaults to 500/INTERNAL and keeps cause private", () => {
  const cause = new RangeError("disk on fire");
  const error = new InternalServerError(undefined, cause);
  assert.equal(error.status, 500);
  assert.equal(error.code, "INTERNAL");
  assert.equal(error.message, "An unexpected error occurred.");
  assert.equal(error.details, undefined);
  assert.deepEqual(error.toErrorDetails(), {
    code: "INTERNAL",
    message: "An unexpected error occurred.",
  });
});
