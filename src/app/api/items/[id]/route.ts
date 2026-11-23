/**
 * `GET /items/:id`, `PUT /items/:id`, and `DELETE /items/:id` — item API
 * route handlers (task #74).
 *
 * Standard Next.js App Router route file (`app/api/items/[id]/route.ts`)
 * with the `(req, ctx)` signatures (`ctx.params` may be a `Promise` under
 * Next.js 15). Same conventions as `../route.ts`:
 *
 * 1. **No business logic in the handler.** Each handler validates the
 *    request at the boundary (path params via `itemPathParamsSchema`, JSON
 *    bodies via the centralized request schemas from
 *    `@devteamtest1/validation`), calls exactly one function on the
 *    placeholder service, and formats the result with `successResponse`.
 * 2. **Validated at the boundary, trusted afterwards.** Invalid params or
 *    bodies short-circuit to the standardized 400 error body.
 * 3. **Unhandled errors are caught by the wrapper.** Each handler is
 *    wrapped in `withErrorHandler`, so a service error (e.g.
 *    `NotFoundError`) comes back as a standardized error response and the
 *    exported handlers never throw.
 *
 * The `next/server` import is lazy (see `../route.ts` for the rationale).
 */
import {
  createNextResponseAdapter,
  successResponse,
  toValidationErrorResult,
  validateRequest,
  withErrorHandler,
  type RouteHandler,
  type RouteRequest,
  type RouteResult,
} from "api-responses";

import {
  itemPathParamsSchema,
  type Item,
  type ItemPathParams,
  type UpdateItemRequest,
  UpdateItemRequestSchema,
} from "@devteamtest1/validation";

import { itemsService } from "../../../app/items/services/index.js";

// --- Framework adapter (lazy: `next` is only needed when responding) --------

let nextAdapter: ((result: RouteResult) => unknown) | undefined;

async function toNextResponse(result: RouteResult): Promise<unknown> {
  nextAdapter ??= createNextResponseAdapter(await import("next/server"));
  return nextAdapter(result);
}

/**
 * Builds the framework-agnostic {@link RouteRequest} for an `/items/:id`
 * route. `rawParams` is the framework's parameter record (Next.js's
 * `ctx.params`, where `id` may be a `Promise` in Next.js 15).
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

/** Parses a `PUT` body as JSON; malformed JSON becomes a schema failure. */
async function readJsonBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    // Fail body validation with the standardized 400 shape.
    return "__invalid_json__";
  }
}

// --- Handler logic (throws freely; wrapped below) ----------------------------

/**
 * Shared `:id` param validation for the item routes. Returns the
 * standardized 400 result on invalid params, or the validated id.
 */
function validatedIdOrError(request: RouteRequest<unknown>):
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
const getItem: RouteHandler<Item, never> = async (
  request: RouteRequest<never>,
): Promise<RouteResult<Item>> => {
  const checked = validatedIdOrError(request);
  if (!checked.ok) return checked.result;

  const data = await itemsService.getItem(checked.id);
  return { status: 200, body: successResponse(data) };
};

/** `PUT /items/:id` — replace an item (validated path param + body). */
const putItem: RouteHandler<Item, unknown> = async (
  request: RouteRequest<unknown>,
): Promise<RouteResult<Item>> => {
  const checked = validatedIdOrError(request);
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
  const checked = validatedIdOrError(request);
  if (!checked.ok) return checked.result;

  const data = await itemsService.deleteItem(checked.id);
  return { status: 200, body: successResponse(data) };
};

// --- Exported route handlers (wrapped: unhandled errors are caught) ----------

/** `GET /items/:id` — fetch a single item. Never throws; errors standardized. */
export async function GET(req: Request, ctx: { params: unknown }): Promise<unknown> {
  const routeRequest = await routeRequestFrom("GET", req, ctx.params);
  const result = await withErrorHandler(getItem)(routeRequest);
  return toNextResponse(result);
}

/** `PUT /items/:id` — replace an item. Never throws; errors standardized. */
export async function PUT(req: Request, ctx: { params: unknown }): Promise<unknown> {
  const body = await readJsonBody(req);
  const routeRequest = await routeRequestFrom("PUT", req, ctx.params, body);
  const result = await withErrorHandler(putItem)(routeRequest);
  return toNextResponse(result);
}

/** `DELETE /items/:id` — delete an item. Never throws; errors standardized. */
export async function DELETE(req: Request, ctx: { params: unknown }): Promise<unknown> {
  const routeRequest = await routeRequestFrom("DELETE", req, ctx.params);
  const result = await withErrorHandler(deleteItem)(routeRequest);
  return toNextResponse(result);
}
