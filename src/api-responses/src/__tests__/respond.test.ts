import { test } from "node:test";
import assert from "node:assert/strict";

import { jsonRouteResult, createNextResponseAdapter } from "../respond.js";
import type { RouteResult } from "../handler.js";

const okResult: RouteResult<{ id: 1 }> = {
  status: 200,
  body: { data: { id: 1 } },
};

const errorResult: RouteResult = {
  status: 400,
  body: { error: { code: "BAD_REQUEST", message: "Request validation failed." } },
};

test("jsonRouteResult produces a framework-free JSON response", () => {
  const response = jsonRouteResult(okResult);
  assert.equal(response.status, 200);
  assert.equal(response.body, JSON.stringify({ data: { id: 1 } }));
  assert.equal(response.headers["Content-Type"], "application/json");
});

test("jsonRouteResult preserves error results", () => {
  const response = jsonRouteResult(errorResult);
  assert.equal(response.status, 400);
  assert.deepEqual(JSON.parse(response.body), {
    error: { code: "BAD_REQUEST", message: "Request validation failed." },
  });
});

test("createNextResponseAdapter delegates to NextResponse.json with the status", () => {
  const calls: Array<{ body: unknown; init?: { status?: number; headers?: Record<string, string> } }> = [];
  const fakeNextServer = {
    NextResponse: {
      json(body: unknown, init?: { status?: number; headers?: Record<string, string> }) {
        calls.push({ body, init });
        return { kind: "next-response", body, init };
      },
    },
  };

  const adapter = createNextResponseAdapter(fakeNextServer);
  const response = adapter(errorResult);

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.init?.status, 400);
  assert.equal(calls[0]?.init?.headers?.["Content-Type"], "application/json");
  assert.deepEqual(calls[0]?.body, errorResult.body);
  assert.equal((response as { kind: string }).kind, "next-response");
});
