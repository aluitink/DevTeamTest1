/**
 * `GET /items` and `POST /items` — collection API route handlers (task #74).
 *
 * This file follows the established pattern for API route handlers in this
 * repository (a Next.js App Router `app/` directory; this workspace demos
 * the pattern without a Next.js build — see `../items/page.tsx` for the
 * same explanation). It uses the helper utilities from `api-responses`
 * throughout:
 *
 * 1. **No business logic in the handler.** Each handler only validates the
 *    request at the boundary (Zod, via `validateRequest` /
 *    `toValidationErrorResult`), calls exactly one function on the
 *    placeholder service (`services/itemsService.ts`), and formats the
 *    result with `successResponse` (or the standardized error result
 *    produced by the helpers).
 * 2. **Validated at the boundary, trusted afterwards.** Query parameters
 *    and request bodies are parsed with the centralized schemas from
 *    `@devteamtest1/validation` (task #72); invalid input yields the
 *    standardized 400 error body (`error-format`).
 * 3. **Unhandled errors are caught by the wrapper.** Every handler is
 *    wrapped in `withErrorHandler`, so anything the service throws
 *    (e.g. `NotFoundError`) becomes a standardized error response; the
 *    exported handlers never throw.
 *
 * The framework adapter is created lazily (`await import("next/server")`),
 * exactly as `api-responses` prescribes, so importing this module never
 * requires Next.js to be installed.
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
  CreateItemRequestSchema,
  type CreateItemRequest,
  listItemsQuerySchema,
  type ListItemsQuery,
  type ListItemsResponse,
  type Item,
} from "@devteamtest1/validation";

import { itemsService } from "../../../services/index.js";

// --- Framework adapter (lazy: Next.js is only needed when responding) ------

let nextAdapter: ((result: RouteResult) => unknown) | undefined;

/**
 * Returns the Next.js response adapter, importing `next/server` on first
 * use. In this demo repository the module can also run under a Vitest
 * mock of `next/server`, so the handlers stay testable without Next.js.
 */
async function toNextResponse(result: RouteResult): Promise<unknown> {
  nextAdapter ??= createNextResponseAdapter(await import("next/server"));
  return nextAdapter(result);
}

/**
 * Builds the framework-agnostic `RouteRequest` from the parts a web
 * framework hands the handler (`req: Request` plus the parsed query/body).
 */
function routeRequestFrom(
  method: string,
  req: Request,
  query: Readonly<Record<string, string | string[] | undefined>>,
  body?: unknown,
): RouteRequest<unknown> {
  // `URLSearchParams`/frameworks may surface repeated query keys as
  // arrays; the validation schemas expect scalars, so keep the first value.
  const scalarQuery: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      scalarQuery[key] = value[0];
    } else {
      scalarQuery[key] = value;
    }
  }
  return { method, path: new URL(req.url).pathname, query: scalarQuery, body };
}

// --- Internal handler logic (throws freely; wrapped below) ------------------

/**
 * `GET /items` — list items with validated, paginated query parameters.
 *
 * Validation failures short-circuit to the standardized 400 result; any
 * error the service throws is converted by {@link withErrorHandler}.
 */
const getListItems: RouteHandler<ListItemsResponse> = async (request: RouteRequest): Promise<RouteResult<ListItemsResponse>> => {
  const validation = validateRequest<never, typeof listItemsQuerySchema, never>(
    { query: listItemsQuerySchema },
    { query: request.query },
  );
  const failure = toValidationErrorResult(validation);
  if (failure !== undefined) return failure;

  const { query } = validation.data;
  const data = await itemsService.listItems(query as ListItemsQuery);
  return {
    status: 200,
    body: successResponse(data.items, {
      total: data.total,
      page: data.page,
      pageSize: data.pageSize,
    }),
  };
};

/**
 * `POST /items` — create an item with a validated JSON body.
 *
 * A malformed (non-JSON) body fails the body schema and is reported
 * through the same standardized 400 shape.
 */
const postCreateItem: RouteHandler<Item, unknown> = async (
  request: RouteRequest<unknown>,
): Promise<RouteResult<Item>> => {
  const validation = validateRequest<never, never, typeof CreateItemRequestSchema>(
    { body: CreateItemRequestSchema },
    { body: request.body },
  );
  const failure = toValidationErrorResult(validation);
  if (failure !== undefined) return failure;

  const { body } = validation.data;
  const data = await itemsService.createItem(body as CreateItemRequest);
  return { status: 201, body: successResponse(data) };
};

// --- Exported route handlers (wrapped: unhandled errors are caught) ---------

/** `GET /items` — list items. Never throws; errors are standardized. */
export const GET = withErrorHandler(getListItems);

/** `POST /items` — create an item. Never throws; errors are standardized. */
export const POST = withErrorHandler(postCreateItem);

// --- Next.js signature bridge -----------------------------------------------
//
// In a real Next.js app this file would export `GET`/`POST` with the
// `GET(req: Request)` signature directly (this file is written to be
// drop-in copyable into a Next.js app's `app/api/items/`). This demo
// workspace runs without a Next.js install, so the framework-facing
// entry points live on `getItems`/`createItem` below while the core
// handlers stay framework-agnostic and directly testable.

/** Entry point for `GET /items` (query params from `req.url`). */
export async function getItems(req: Request): Promise<unknown> {
  const query = Object.fromEntries(new URL(req.url).searchParams.entries());
  const result = await GET(routeRequestFrom("GET", req, query));
  return toNextResponse(result);
}

/** Next.js entry point for `POST /items` (JSON body from `req`). */
export async function createItem(req: Request): Promise<unknown> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    // Malformed JSON: fail validation with the standardized 400 shape.
    body = "__invalid_json__";
  }
  const query = Object.fromEntries(new URL(req.url).searchParams.entries());
  const result = await POST(routeRequestFrom("POST", req, query, body));
  return toNextResponse(result);
}
