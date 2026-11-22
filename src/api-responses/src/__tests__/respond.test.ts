import { expect, test } from "vitest";

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
  expect(response.status).toBe(200);
  expect(response.body).toBe(JSON.stringify({ data: { id: 1 } }));
  expect(response.headers["Content-Type"]).toBe("application/json");
});

test("jsonRouteResult preserves error results", () => {
  const response = jsonRouteResult(errorResult);
  expect(response.status).toBe(400);
  expect(JSON.parse(response.body)).toEqual({
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

  expect(calls).toHaveLength(1);
  expect(calls[0]?.init?.status).toBe(400);
  expect(calls[0]?.init?.headers?.["Content-Type"]).toBe("application/json");
  expect(calls[0]?.body).toEqual(errorResult.body);
  expect((response as { kind: string }).kind).toBe("next-response");
});
