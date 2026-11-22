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
export function errorResponse(code, message, details) {
    const error = { code, message };
    if (details !== undefined) {
        error.details = details;
    }
    return { error };
}
/**
 * Builds an {@link ErrorPayload} from a prebuilt {@link ErrorDetails}
 * object (for example one produced by an error class).
 */
export function errorResponseFromDetails(details) {
    return { error: details };
}
/**
 * Returns the `code` from an error body or from a raw `ErrorDetails`-shaped
 * object.
 */
export function getErrorCode(body) {
    return "error" in body ? body.error.code : body.code;
}
/**
 * Serializes an {@link ErrorPayload} to a JSON string.
 */
export function errorResponseBody(response) {
    return JSON.stringify(response);
}
//# sourceMappingURL=error.js.map