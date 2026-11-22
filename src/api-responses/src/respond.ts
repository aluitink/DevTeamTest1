import type { RouteResult } from "./handler.js";

/**
 * A minimal, structural description of the parts of a web `Response`-like
 * object this package can produce. It deliberately mirrors the surface of
 * the WHATWG `Response` (and therefore of Next.js's `NextResponse`) without
 * importing either, so this module stays framework-agnostic and unit-testable.
 */
export interface JsonResponseOptions {
  readonly status?: number;
  readonly headers?: Record<string, string>;
}

/**
 * The adapter seam: a function that turns a {@link RouteResult} into the
 * framework's actual response object.
 *
 * The default {@link jsonRouteResult} serializes the result into a plain
 * object with `status`, `body` (a JSON string), and JSON content type —
 * no `Response` construction at all, which is what makes the rest of this
 * package framework-free and trivially testable.
 *
 * Framework integrations (e.g. Next.js) supply their own adapter that wraps
 * the same `RouteResult` in `NextResponse.json(...)` — a two-line shim, see
 * {@link createNextResponseAdapter}.
 */
export type RouteResultAdapter<TResponse> = (result: RouteResult) => TResponse;

/** A plain, serializable representation of a route result. */
export interface PlainRouteResponse {
  readonly status: number;
  /** The JSON-encoded response body. */
  readonly body: string;
  readonly headers: Record<string, string>;
}

/**
 * Default {@link RouteResultAdapter}: converts a {@link RouteResult} to a
 * framework-free {@link PlainRouteResponse} (status + JSON string body +
 * `Content-Type: application/json` header).
 *
 * Any runtime that can speak plain JSON over HTTP (a custom server, a test
 * harness, an edge function) can consume this without importing a web
 * framework.
 */
export function jsonRouteResult(result: RouteResult): PlainRouteResponse {
  return {
    status: result.status,
    body: JSON.stringify(result.body),
    headers: { "Content-Type": "application/json" },
  };
}

/**
 * Builds a Next.js adapter that turns {@link RouteResult}s into
 * `NextResponse` objects.
 *
 * This is the **only** place in this package that is expected to import
 * Next.js, and it does so lazily (at adapter-creation time, not at module
 * load) so importing `api-responses` never requires `next` to be installed.
 *
 * ```ts
 * import { createNextResponseAdapter } from "api-responses";
 * const toNextResponse = createNextResponseAdapter(await import("next/server"));
 *
 * export async function POST(req: Request, ctx: { params: … }) {
 *   const result = await handler({ … });
 *   return toNextResponse(result);
 * }
 * ```
 */
export function createNextResponseAdapter(nextServer: {
  NextResponse: {
    json: (body: unknown, init?: JsonResponseOptions) => unknown;
  };
}): RouteResultAdapter<unknown> {
  const { NextResponse } = nextServer;
  return (result) =>
    NextResponse.json(result.body, {
      status: result.status,
      headers: { "Content-Type": "application/json" },
    });
}
