/**
 * Base class for domain/operational errors that map cleanly onto the
 * standardized error response shape.
 *
 * Carries an HTTP `status`, a machine-readable `code`, a human-readable
 * `message`, and an optional structured `details` payload. It deliberately
 * carries *no* business logic — it is just a typed container that the error
 * handler can convert into a response body.
 */
export declare class ApiError extends Error {
    /** The HTTP status code to use for this error. */
    readonly status: number;
    /** Stable, machine-readable error code (e.g. `"NOT_FOUND"`). */
    readonly code: string;
    /** Optional structured details (validation issues, context, etc.). */
    readonly details?: unknown;
    /** Whether this error's `details` are safe to expose to the client. */
    readonly exposeDetails: boolean;
    constructor(status: number, code: string, message: string, details?: unknown, options?: {
        exposeDetails?: boolean;
        cause?: unknown;
    });
    /**
     * The `error` object of the standardized response for this error.
     *
     * `details` is only included when `exposeDetails` is `true`, so internal
     * context never leaks to clients by default.
     */
    toErrorDetails(): {
        code: string;
        message: string;
        details?: unknown;
    };
}
/** An error representing a 400 Bad Request (e.g. validation failure). */
export declare class BadRequestError extends ApiError {
    constructor(message: string, details?: unknown);
}
/** An error representing a 404 Not Found. */
export declare class NotFoundError extends ApiError {
    constructor(message?: string);
}
/** An error representing an internal/unexpected failure (500). */
export declare class InternalServerError extends ApiError {
    constructor(message?: string, cause?: unknown);
}
//# sourceMappingURL=api-error.d.ts.map