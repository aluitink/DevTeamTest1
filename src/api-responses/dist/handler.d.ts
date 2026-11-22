import { type ErrorPayload } from "./error.js";
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
export type RouteHandler<TData = unknown, TBody = unknown> = (request: RouteRequest<TBody>) => RouteResult<TData> | Promise<RouteResult<TData>>;
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
export declare function withErrorHandler<TData, TBody = unknown>(handler: RouteHandler<TData, TBody>, options?: ErrorHandlerOptions): RouteHandler<TData, TBody>;
//# sourceMappingURL=handler.d.ts.map