/**
 * Base class for domain/operational errors that map cleanly onto the
 * standardized error response shape.
 *
 * Carries an HTTP `status`, a machine-readable `code`, a human-readable
 * `message`, and an optional structured `details` payload. It deliberately
 * carries *no* business logic — it is just a typed container that the error
 * handler can convert into a response body.
 */
export class ApiError extends Error {
    /** The HTTP status code to use for this error. */
    status;
    /** Stable, machine-readable error code (e.g. `"NOT_FOUND"`). */
    code;
    /** Optional structured details (validation issues, context, etc.). */
    details;
    /** Whether this error's `details` are safe to expose to the client. */
    exposeDetails;
    constructor(status, code, message, details, options) {
        super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
        this.name = new.target.name;
        this.status = status;
        this.code = code;
        this.details = details;
        this.exposeDetails = options?.exposeDetails ?? false;
    }
    /**
     * The `error` object of the standardized response for this error.
     *
     * `details` is only included when `exposeDetails` is `true`, so internal
     * context never leaks to clients by default.
     */
    toErrorDetails() {
        const details = {
            code: this.code,
            message: this.message,
        };
        if (this.details !== undefined && this.exposeDetails) {
            details.details = this.details;
        }
        return details;
    }
}
/** An error representing a 400 Bad Request (e.g. validation failure). */
export class BadRequestError extends ApiError {
    constructor(message, details) {
        super(400, "BAD_REQUEST", message, details, { exposeDetails: true });
    }
}
/** An error representing a 404 Not Found. */
export class NotFoundError extends ApiError {
    constructor(message = "Resource not found.") {
        super(404, "NOT_FOUND", message);
    }
}
/** An error representing an internal/unexpected failure (500). */
export class InternalServerError extends ApiError {
    constructor(message = "An unexpected error occurred.", cause) {
        super(500, "INTERNAL", message, undefined, { cause });
    }
}
//# sourceMappingURL=api-error.js.map