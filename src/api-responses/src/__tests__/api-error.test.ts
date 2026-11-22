import { expect, test } from "vitest";

import {
  ApiError,
  BadRequestError,
  InternalServerError,
  NotFoundError,
} from "../api-error.js";

test("ApiError carries status, code, message, and optional details", () => {
  const error = new ApiError(422, "CONFLICT", "already exists", { id: 7 });
  expect(error.status).toBe(422);
  expect(error.code).toBe("CONFLICT");
  expect(error.message).toBe("already exists");
  expect(error.details).toEqual({ id: 7 });
  expect(error).toBeInstanceOf(Error);
  expect(error).toBeInstanceOf(ApiError);
});

test("toErrorDetails hides details unless exposeDetails is true", () => {
  const hidden = new ApiError(500, "INTERNAL", "boom", { secret: true });
  expect(hidden.toErrorDetails()).toEqual({ code: "INTERNAL", message: "boom" });

  const exposed = new ApiError(400, "BAD_REQUEST", "bad", { issues: [] }, { exposeDetails: true });
  expect(exposed.toErrorDetails()).toEqual({
    code: "BAD_REQUEST",
    message: "bad",
    details: { issues: [] },
  });
});

test("ApiError preserves the cause and sets the constructor name", () => {
  const cause = new TypeError("inner");
  const error = new ApiError(500, "INTERNAL", "wrapped", undefined, { cause });
  expect((error as Error & { cause?: unknown }).cause).toBe(cause);
  expect(error.name).toBe("ApiError");
});

test("BadRequestError defaults to 400/BAD_REQUEST and exposes details", () => {
  const error = new BadRequestError("Invalid title.", { issues: [{ path: "title" }] });
  expect(error.status).toBe(400);
  expect(error.code).toBe("BAD_REQUEST");
  expect(error.exposeDetails).toBe(true);
  expect(error.toErrorDetails()).toEqual({
    code: "BAD_REQUEST",
    message: "Invalid title.",
    details: { issues: [{ path: "title" }] },
  });
});

test("NotFoundError defaults to 404/NOT_FOUND and hides details", () => {
  const error = new NotFoundError("No such todo.");
  expect(error.status).toBe(404);
  expect(error.code).toBe("NOT_FOUND");
  expect(error.name).toBe("NotFoundError");
  expect(error.toErrorDetails()).toEqual({ code: "NOT_FOUND", message: "No such todo." });
});

test("InternalServerError defaults to 500/INTERNAL and keeps cause private", () => {
  const cause = new RangeError("disk on fire");
  const error = new InternalServerError(undefined, cause);
  expect(error.status).toBe(500);
  expect(error.code).toBe("INTERNAL");
  expect(error.message).toBe("An unexpected error occurred.");
  expect(error.details).toBeUndefined();
  expect(error.toErrorDetails()).toEqual({
    code: "INTERNAL",
    message: "An unexpected error occurred.",
  });
});
