import { ApiError, InternalServerError } from "./api-error.js";
import { errorResponseFromDetails } from "./error.js";
/**
 * Builds a standardized error result (status + error body) for an
 * arbitrary thrown value.
 *
 * - {@link ApiError} instances use their own `status`, `code`, `message`,
 *   and (when exposed) `details`.
 * - Any other value maps to a sanitized `500 INTERNAL` response, so
 *   unexpected/internal details never leak to the client.
 */
function toErrorResult(error) {
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
export function withErrorHandler(handler, options) {
    const statusForError = options?.statusForError;
    return async (request) => {
        try {
            return await handler(request);
        }
        catch (error) {
            const result = toErrorResult(error);
            return {
                status: statusForError ? statusForError(error) : result.status,
                body: result.body,
            };
        }
    };
}
//# sourceMappingURL=handler.js.map