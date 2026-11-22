import { ApiError, InternalServerError } from "./api-error.js";
import { errorResponseFromDetails, type ErrorPayload } from "./error.js";
import type { SuccessResponse } from "./types.js";

/**
 * A minimal, framework-agnostic description of a route request. Handlers
 * receive this so they are testable without a specific web framework.
 *
 * @typeParam TBody - The (already validated) request body type.
 */
export interface RouteRequest<TBody = unknown> {
  /** The HTTP method (e.g. `"GET"`, `"POST"`). */
  readonly method: string;
  /** The request path (e.g. `"/todos/42"`). */
  readonly path: string;
  /** Query parameters as a string map. */
  readonly query: Readonly<Record<string, string | undefined>>;
  /** The request body (may be `undefined` for bodiless requests). */
  readonly body?: TBody;
}

/**
 * The result of a route handler. Carries an HTTP status code plus the
 * body, which is a `SuccessResponse` for 2xx results and an error payload
 * for 4xx/5xx results.
 */
export interface RouteResult<TData = unknown> {
  readonly status: number;
  readonly body: SuccessResponse<TData> | ErrorPayload;
}

/**
 * A route handler: takes a request and returns a result. It may throw
 * {@link ApiError} (or any other `Error`) — the {@link withErrorHandler}
 * wrapper is responsible for converting thrown errors into a result.
 */
export type RouteHandler<TData = unknown, TBody = unknown> = (
  request: RouteRequest<TBody>,
) => RouteResult<TData> | Promise<RouteResult<TData>>;

/**
 * Options controlling how {@link withErrorHandler} converts thrown errors
 * into standardized error responses.
 */
export interface ErrorHandlerOptions {
  /**
   * Optional override for the HTTP status used for a thrown error. The
   * default uses an {@link ApiError}'s own `status` and `500` for anything
   * else.
   */
  readonly statusForError?: (error: unknown) => number;
}

/**
 * Builds a standardized error result (status + error body) for an
 * arbitrary thrown value.
 *
 * - {@link ApiError} instances use their own `status`, `code`, `message`,
 *   and (when exposed) `details`.
 * - Any other value maps to a sanitized `500 INTERNAL` response, so
 *   unexpected/internal details never leak to the client.
 */
function toErrorResult(error: unknown): { status: number; body: ErrorPayload } {
  if (error instanceof ApiError) {
    return { status: error.status, body: errorResponseFromDetails(error.toErrorDetails()) };
  }

  const fallback = new InternalServerError("An unexpected error occurred.", error);
  return { status: fallback.status, body: errorResponseFromDetails(fallback.toErrorDetails()) };
}

/**
 * Higher-order function that wraps a route handler so any exception it
 * throws is caught and converted into a standardized error response.
 *
 * Successful results are returned untouched. This is the single seam where
 * "an exception happened" becomes "a JSON error body with a status code",
 * so route handlers can focus on their logic and throw freely.
 *
 * @typeParam TData - The success payload type.
 * @typeParam TBody - The request body type.
 * @param handler - The route handler to wrap.
 * @param options - Optional overrides (e.g. custom status mapping).
 * @returns A new handler with the same signature that never throws for the
 *   wrapped logic's errors; it always resolves to a `RouteResult`.
 *
 * @example
 * ```ts
 * const getTodo = withErrorHandler((req) => ({
 *   status: 200,
 *   body: successResponse({ id: 1, title: "Ship it" }),
 * }));
 *
 * // If the handler logic throws, `await getTodo(req)` resolves to a
 * // standardized 500 error result instead of propagating the exception.
 * ```
 */
export function withErrorHandler<TData, TBody = unknown>(
  handler: RouteHandler<TData, TBody>,
  options?: ErrorHandlerOptions,
): RouteHandler<TData, TBody> {
  const statusForError = options?.statusForError;

  return async (request: RouteRequest<TBody>): Promise<RouteResult<TData>> => {
    try {
      return await handler(request);
    } catch (error: unknown) {
      const result = toErrorResult(error);
      return {
        status: statusForError ? statusForError(error) : result.status,
        body: result.body,
      };
    }
  };
}
