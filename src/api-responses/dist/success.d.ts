import type { ResponseMeta, SuccessResponse } from "./types.js";
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
export declare function successResponse<TData>(data: TData, meta?: ResponseMeta): SuccessResponse<TData>;
/**
 * Serializes a successful response to a JSON string.
 *
 * Convenience wrapper around {@link successResponse} plus `JSON.stringify`.
 *
 * @param data - The route's payload.
 * @param meta - Optional metadata object.
 * @returns The JSON string for the response body.
 */
export declare function successResponseBody<TData>(data: TData, meta?: ResponseMeta): string;
//# sourceMappingURL=success.d.ts.map