import type { ErrorDetails, ErrorResponse } from "./types.js";
/**
 * An error response body in the standardized shape
 * `{ error: { code, message, details? } }`.
 */
export type ErrorPayload = ErrorResponse;
/**
 * Builds an {@link ErrorPayload} (`{ error: { code, message, details? } }`)
 * from its parts.
 *
 * `details` is included only when it is not `undefined`, so the emitted
 * object stays minimal.
 *
 * @param code - A stable, machine-readable error code.
 * @param message - A human-readable message.
 * @param details - Optional structured details.
 */
export declare function errorResponse(code: string, message: string, details?: unknown): ErrorPayload;
/**
 * Builds an {@link ErrorPayload} from a prebuilt {@link ErrorDetails}
 * object (for example one produced by an error class).
 */
export declare function errorResponseFromDetails(details: ErrorDetails): ErrorPayload;
/**
 * Returns the `code` from an error body or from a raw `ErrorDetails`-shaped
 * object.
 */
export declare function getErrorCode(body: ErrorResponse | ErrorDetails): string;
/**
 * Serializes an {@link ErrorPayload} to a JSON string.
 */
export declare function errorResponseBody(response: ErrorPayload): string;
//# sourceMappingURL=error.d.ts.map