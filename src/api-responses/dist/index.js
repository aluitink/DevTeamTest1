/**
 * Unified error handling & response formatting utilities (task #71).
 *
 * Public surface:
 *
 * - Types: `SuccessResponse`, `ResponseMeta`, `ErrorDetails`, `ErrorResponse`,
 *   `ErrorPayload`.
 * - Success formatting: `successResponse`, `successResponseBody`.
 * - Error formatting: `errorResponse`, `errorResponseFromDetails`,
 *   `getErrorCode`, `errorResponseBody`.
 * - Error types: `ApiError`, `BadRequestError`, `NotFoundError`,
 *   `InternalServerError`.
 * - Handler wrapper: `withErrorHandler` and its supporting types.
 *
 * These modules contain **no business logic** — only response formatting
 * and exception-to-response conversion.
 */
export { successResponse, successResponseBody } from "./success.js";
export { errorResponse, errorResponseFromDetails, getErrorCode, errorResponseBody, } from "./error.js";
export { ApiError, BadRequestError, NotFoundError, InternalServerError, } from "./api-error.js";
export { withErrorHandler, } from "./handler.js";
//# sourceMappingURL=index.js.map