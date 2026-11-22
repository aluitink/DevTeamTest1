/**
 * `GET /items/:id`, `PUT /items/:id`, and `DELETE /items/:id` — item API
 * route handlers (task #74).
 *
 * Follows the same pattern as `../route.ts` (see its header): no business
 * logic in the handlers, Zod validation at the boundary (path params via
 * `itemPathParamsSchema`, JSON bodies via the centralized request schemas),
 * one call into the placeholder service, responses formatted with the
 * `api-responses` helpers, and every handler wrapped in `withErrorHandler`
 * so unhandled errors (e.g. the service's `NotFoundError`) come back as
 * standardized error responses.
 *
 * Path parameters arrive as `ctx.params` (Next.js App Router signature
 * `GET/PUT/DELETE(req, ctx)`); the `*WithParams` entry points below adapt
 * that to the framework-agnostic `RouteRequest` so the core handlers are
 * testable without a web framework.
 */
import {
  createNextResponseAdapter,
  successResponse,
  toValidationErrorResult,
  validateRequest,
  withErrorHandler,
  type RouteResult,
  type RouteHandler,
  type RouteRequest,
} from "api-responses";

import {
  itemPathParamsSchema,
  type ItemPathParams,
  type UpdateItemRequest,
  UpdateItemRequestSchema,
  type Item,
} from "@devteamtest1/validation";

import { itemsService } from "../../../services/index.js";

// --- Framework adapter (lazy: Next.js is only needed when responding) ------

let nextAdapter: ((result: RouteResult) => unknown) | undefined;

/**
 * Returns the Next.js response adapter, importing `next/server` on first
 * use (see `../route.ts` for the rationale).
 */
async function toNextResponse(result: RouteResult): Promise<unknown> {
  nextAdapter ??= createNextResponseAdapter(await import("next/server"));
  return nextAdapter(result);
}

/**
 * Builds the framework-agnostic `RouteRequest` for an `/items/:id` route.
 *
 * `rawParams` is the framework's parameter record (e.g. Next.js's
 * `ctx.params`, where `id` may be a `Promise`); `paramsPromise` is awaited
 * when the framework hands a promise (Next.js 15 async params).
 */
async function routeRequestFrom(
  method: string,
  req: Request,
  rawParams: unknown,
  body?: unknown,
): Promise<RouteRequest<unknown>> {
  const params = rawParams instanceof Promise ? await rawParams : (rawParams ?? {});
  const query = Object.fromEntries(new URL(req.url).searchParams.entries());
  return { method, path: new URL(req.url).pathname, query, params, body };
}

// --- Internal handler logic (throws freely; wrapped below) ------------------

/**
 * Shared `:id` param validation for the item routes. Returns the
 * standardized 400 result on invalid params, or the validated params.
 */
function validatedParamsOrError(request: RouteRequest<unknown>):
  | { ok: true; id: ItemPathParams["id"] }
  | { ok: false; result: RouteResult<never> } {
  const validation = validateRequest<typeof itemPathParamsSchema, never, never>(
    { params: itemPathParamsSchema },
    { params: (request as { params?: unknown }).params },
  );
  const failure = toValidationErrorResult(validation);
  if (failure !== undefined) {
    return { ok: false, result: failure };
  }
  return { ok: true, id: validation.data.params.id };
}

/** `GET /items/:id` — fetch a single item (validated path param). */
const getItem: RouteHandler<Item, never> = async (request: RouteRequest<never>): Promise<RouteResult<Item>> => {
  const checked = validatedParamsOrError(request);
  if (!checked.ok) return checked.result;

  const data = await itemsService.getItem(checked.id);
  return { status: 200, body: successResponse(data) };
};

/** `PUT /items/:id` — replace an item (validated path param + body). */
const putItem: RouteHandler<Item, unknown> = async (request: RouteRequest<unknown>): Promise<RouteResult<Item>> => {
  const checked = validatedParamsOrError(request);
  if (!checked.ok) return checked.result;

  const validation = validateRequest<never, never, typeof UpdateItemRequestSchema>(
    { body: UpdateItemRequestSchema },
    { body: request.body },
  );
  const failure = toValidationErrorResult(validation);
  if (failure !== undefined) return failure;

  const { body } = validation.data;
  const data = await itemsService.updateItem(checked.id, body as UpdateItemRequest);
  return { status: 200, body: successResponse(data) };
};

/** `DELETE /items/:id` — delete an item (validated path param). */
const deleteItem: RouteHandler<{ id: ItemPathParams["id"] }, never> = async (
  request: RouteRequest<never>,
): Promise<RouteResult<{ id: ItemPathParams["id"] }>> => {
  const checked = validatedParamsOrError(request);
  if (!checked.ok) return checked.result;

  const data = await itemsService.deleteItem(checked.id);
  return { status: 200, body: successResponse(data) };
};

// --- Exported route handlers (wrapped: unhandled errors are caught) ---------

/** `GET /items/:id` — fetch a single item. Never throws; errors standardized. */
export const GET = withErrorHandler(getItem);

/** `PUT /items/:id` — replace an item. Never throws; errors standardized. */
export const PUT = withErrorHandler(putItem);

/** `DELETE /items/:id` — delete an item. Never throws; errors standardized. */
export const DELETE = withErrorHandler(deleteItem);

// --- Web-framework signature bridge -----------------------------------------
//
// Thin adapters matching the Next.js App Router call signature
// `GET/PUT/DELETE(req, ctx)` (with async `ctx.params`). The core logic is
// in the wrapped handlers above.

/** Web entry point for `GET /items/:id`. */
export async function getItemWithParams(req: Request, ctx: { params: unknown }): Promise<unknown> {
  const routeRequest = await routeRequestFrom("GET", req, ctx.params);
  return toNextResponse(await GET(routeRequest));
}

/** Web entry point for `PUT /items/:id` (JSON body from `req`). */
export async function putItemWithParams(req: Request, ctx: { params: unknown }): Promise<unknown> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    // Malformed JSON: fail validation with the standardized 400 shape.
    body = "__invalid_json__";
  }
  const routeRequest = await routeRequestFrom("PUT", req, ctx.params, body);
  return toNextResponse(await PUT(routeRequest));
}

/** Web entry point for `DELETE /items/:id`. */
export async function deleteItemWithParams(req: Request, ctx: { params: unknown }): Promise<unknown> {
  const routeRequest = await routeRequestFrom("DELETE", req, ctx.params);
  return toNextResponse(await DELETE(routeRequest));
}
