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
 * - Request validation: `validateRequest`, `toValidationErrorResult`,
 *   `RequestValidationError`, `formatValidationIssues` and their supporting
 *   types (task #73).
 * - Response adapter: `jsonRouteResult`, `createNextResponseAdapter` and
 *   their supporting types (task #73).
 *
 * These modules contain **no business logic** — only response formatting,
 * request validation, and exception-to-response conversion. The validation
 * and response helpers are framework-agnostic (no direct `NextResponse`
 * usage); `createNextResponseAdapter` is the optional, lazy Next.js shim.
 */
export { successResponse, successResponseBody } from "./success.js";
export { errorResponse, errorResponseFromDetails, getErrorCode, errorResponseBody, } from "./error.js";
export { ApiError, BadRequestError, NotFoundError, InternalServerError, } from "./api-error.js";
export { withErrorHandler, } from "./handler.js";
export { validateRequest, toValidationErrorResult, isValidationSuccess, RequestValidationError, formatValidationIssues, } from "./validate.js";
export { jsonRouteResult, createNextResponseAdapter, } from "./respond.js";
//# sourceMappingURL=index.js.map