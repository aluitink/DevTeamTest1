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

export type {
  ResponseMeta,
  SuccessResponse,
  ErrorDetails,
  ErrorResponse,
} from "./types.js";
export { successResponse, successResponseBody } from "./success.js";
export {
  errorResponse,
  errorResponseFromDetails,
  getErrorCode,
  errorResponseBody,
  type ErrorPayload,
} from "./error.js";
export {
  ApiError,
  BadRequestError,
  NotFoundError,
  InternalServerError,
} from "./api-error.js";
export {
  withErrorHandler,
  type RouteRequest,
  type RouteResult,
  type RouteHandler,
  type ErrorHandlerOptions,
} from "./handler.js";
export {
  validateRequest,
  toValidationErrorResult,
  isValidationSuccess,
  RequestValidationError,
  formatValidationIssues,
  type RequestPart,
  type RequestSchemas,
  type ValidationResult,
  type ValidationIssue,
} from "./validate.js";
export {
  jsonRouteResult,
  createNextResponseAdapter,
  type RouteResultAdapter,
  type PlainRouteResponse,
  type JsonResponseOptions,
} from "./respond.js";
