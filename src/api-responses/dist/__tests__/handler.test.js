import { test } from "node:test";
import assert from "node:assert/strict";
import { withErrorHandler, } from "../handler.js";
import { successResponse } from "../success.js";
import { BadRequestError, NotFoundError } from "../api-error.js";
const request = {
    method: "GET",
    path: "/todos/1",
    query: {},
};
test("withErrorHandler returns successful results untouched", async () => {
    const handler = () => ({
        status: 200,
        body: successResponse({ id: 1 }),
    });
    const wrapped = withErrorHandler(handler);
    const result = await wrapped(request);
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, { data: { id: 1 } });
});
test("withErrorHandler supports async handlers", async () => {
    const wrapped = withErrorHandler(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
        return { status: 201, body: successResponse({ id: 2 }) };
    });
    const result = await wrapped(request);
    assert.equal(result.status, 201);
    assert.deepEqual(result.body, { data: { id: 2 } });
});
test("withErrorHandler converts a thrown ApiError to its standardized body", async () => {
    const wrapped = withErrorHandler(() => {
        throw new NotFoundError("No such todo.");
    });
    const result = await wrapped(request);
    assert.equal(result.status, 404);
    assert.deepEqual(result.body, {
        error: { code: "NOT_FOUND", message: "No such todo." },
    });
});
test("withErrorHandler exposes details for ApiErrors that allow it", async () => {
    const issues = [{ path: "title", message: "required" }];
    const wrapped = withErrorHandler(() => {
        throw new BadRequestError("Invalid input.", issues);
    });
    const result = await wrapped(request);
    assert.equal(result.status, 400);
    assert.deepEqual(result.body, {
        error: { code: "BAD_REQUEST", message: "Invalid input.", details: issues },
    });
});
test("withErrorHandler converts an unexpected Error to a sanitized 500", async () => {
    const wrapped = withErrorHandler(() => {
        throw new Error("SQL: SELECT * FROM secrets -- do not leak");
    });
    const result = await wrapped(request);
    assert.equal(result.status, 500);
    assert.deepEqual(result.body, {
        error: { code: "INTERNAL", message: "An unexpected error occurred." },
    });
});
test("withErrorHandler converts non-Error throws to a 500", async () => {
    const wrapped = withErrorHandler(() => {
        throw "a string, not an Error";
    });
    const result = await wrapped(request);
    assert.equal(result.status, 500);
    assert.deepEqual(result.body, {
        error: { code: "INTERNAL", message: "An unexpected error occurred." },
    });
});
test("withErrorHandler honors a custom statusForError override", async () => {
    const wrapped = withErrorHandler(() => {
        throw new NotFoundError("gone");
    }, { statusForError: () => 599 });
    const result = await wrapped(request);
    assert.equal(result.status, 599);
    assert.deepEqual(result.body, { error: { code: "NOT_FOUND", message: "gone" } });
});
test("the wrapped handler receives the request it was called with", async () => {
    let seen;
    const wrapped = withErrorHandler(async (req) => {
        seen = req;
        return { status: 200, body: successResponse(req.path) };
    });
    const req = { method: "POST", path: "/todos", query: { a: "1" } };
    const result = await wrapped(req);
    assert.equal(seen, req);
    assert.deepEqual(result.body, { data: "/todos" });
});
//# sourceMappingURL=handler.test.js.map