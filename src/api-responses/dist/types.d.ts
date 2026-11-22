/**
 * Shared types for the unified response formatting utilities.
 *
 * These types describe the *wire format* of API responses. They are purely
 * structural (formatting) types and contain no business logic.
 */
/**
 * Optional metadata that can accompany a successful response (pagination
 * info, etags, request ids, etc.). Its shape is intentionally open so
 * different routes can attach different metadata without extra coupling.
 */
export type ResponseMeta = Record<string, unknown>;
/**
 * Shape of a successful JSON response: `{ data, meta? }`.
 *
 * `data` is the route's payload. `meta` is optional and, when present, is an
 * object of extra metadata.
 */
export interface SuccessResponse<TData = unknown> {
    data: TData;
    meta?: ResponseMeta;
}
/**
 * Shape of the `error` object inside an error response:
 * `{ code, message, details? }`.
 */
export interface ErrorDetails {
    /** A stable, machine-readable error code (e.g. `"NOT_FOUND"`). */
    code: string;
    /** A human-readable message safe to return to the client. */
    message: string;
    /** Optional structured details (validation issues, context, etc.). */
    details?: unknown;
}
/**
 * Shape of an error JSON response: `{ error: { code, message, details? } }`.
 */
export interface ErrorResponse {
    error: ErrorDetails;
}
//# sourceMappingURL=types.d.ts.map