import { test } from "node:test";
import assert from "node:assert/strict";
import { errorResponse, errorResponseFromDetails, errorResponseBody, getErrorCode, } from "../error.js";
test("errorResponse produces { error: { code, message } } without details", () => {
    const result = errorResponse("NOT_FOUND", "Resource not found.");
    assert.deepEqual(result, { error: { code: "NOT_FOUND", message: "Resource not found." } });
    assert.equal("details" in result.error, false);
});
test("errorResponse includes details when provided", () => {
    const issues = [{ path: "title", message: "required" }];
    const result = errorResponse("BAD_REQUEST", "Invalid input.", issues);
    assert.deepEqual(result, {
        error: { code: "BAD_REQUEST", message: "Invalid input.", details: issues },
    });
});
test("errorResponse omits details key when details is undefined but includes it for null", () => {
    const without = errorResponse("X", "msg");
    assert.equal("details" in without.error, false);
    const withNull = errorResponse("X", "msg", null);
    assert.ok("details" in withNull.error);
    assert.equal(withNull.error.details, null);
});
test("errorResponseFromDetails wraps an existing details object", () => {
    const result = errorResponseFromDetails({ code: "C", message: "m", details: 5 });
    assert.deepEqual(result, { error: { code: "C", message: "m", details: 5 } });
});
test("getErrorCode reads code from a response body or raw details object", () => {
    assert.equal(getErrorCode({ error: { code: "A", message: "m" } }), "A");
    assert.equal(getErrorCode({ code: "B", message: "m" }), "B");
});
test("errorResponseBody serializes to the exact JSON shape", () => {
    assert.equal(errorResponseBody(errorResponse("NOT_FOUND", "nope")), '{"error":{"code":"NOT_FOUND","message":"nope"}}');
});
//# sourceMappingURL=error.test.js.map