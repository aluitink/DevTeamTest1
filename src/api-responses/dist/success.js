/**
 * Formats a successful JSON response as `{ data, meta? }`.
 *
 * `meta` is included only when it is a non-null object, so callers can
 * pass `undefined` (or `null`) to omit it. This keeps the emitted JSON
 * minimal and consistent.
 *
 * @param data - The route's payload.
 * @param meta - Optional metadata object to include alongside `data`.
 * @returns A `SuccessResponse` object ready to be serialized as JSON.
 *
 * @example
 * ```ts
 * successResponse({ id: 1, name: "Alice" });
 * // => { data: { id: 1, name: "Alice" } }
 *
 * successResponse({ id: 1 }, { page: 1, totalPages: 3 });
 * // => { data: { id: 1 }, meta: { page: 1, totalPages: 3 } }
 * ```
 */
export function successResponse(data, meta) {
    const response = { data };
    if (meta !== undefined && meta !== null) {
        response.meta = meta;
    }
    return response;
}
/**
 * Serializes a successful response to a JSON string.
 *
 * Convenience wrapper around {@link successResponse} plus `JSON.stringify`.
 *
 * @param data - The route's payload.
 * @param meta - Optional metadata object.
 * @returns The JSON string for the response body.
 */
export function successResponseBody(data, meta) {
    return JSON.stringify(successResponse(data, meta));
}
//# sourceMappingURL=success.js.map