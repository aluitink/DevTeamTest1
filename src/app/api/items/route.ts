/**
 * `GET /items` and `POST /items` — collection API route handlers (task #74).
 *
 * Standard Next.js App Router route file (`app/api/items/route.ts`), written
 * against the plain `Request` / `NextResponse` surface so it can be dropped
 * into a Next.js app unchanged. It follows the repository conventions:
 *
 * 1. **No business logic in the handler.** Each handler validates the
 *    request at the boundary (Zod, via `validateRequest` /
 *    `toValidationErrorResult`), calls exactly one function on the
 *    placeholder service (`itemsService`, which returns dummy data), and
 *    formats the result with `successResponse`.
 * 2. **Validated at the boundary, trusted afterwards.** Query parameters and
 *    request bodies are parsed with the centralized schemas from
 *    `@devteamtest1/validation` (#72); invalid input short-circuits to the
 *    standardized 400 error body produced by the `error-format` helpers.
 * 3. **Unhandled errors are caught by the wrapper.** The handler logic is
 *    wrapped in `withErrorHandler` from `api-responses` (#73), so anything
 *    the service throws (e.g. `NotFoundError`) becomes a standardized error
 *    response and the exported handlers never throw.
 *
 * The `next/server` import is done lazily (at response time, not at module
 * load) so the handler module is importable — and unit-testable — without a
 * Next.js installation.
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
  CreateItemRequestSchema,
  type CreateItemRequest,
  listItemsQuerySchema,
  type ListItemsQuery,
  type ListItemsResponse,
  type Item,
} from "@devteamtest1/validation";

import { itemsService } from "../../app/items/services/index.js";

// --- Framework adapter (lazy: `next` is only needed when responding) --------

let nextAdapter: ((result: RouteResult) => unknown) | undefined;

/**
 * Turns a {@link RouteResult} into a `NextResponse`, importing `next/server`
 * on first use. (In this repository `next` is type-only — the same lazy
 * seam lets the routes run under a test mock of `next/server`.)
 */
async function toNextResponse(result: RouteResult): Promise<unknown> {
  nextAdapter ??= createNextResponseAdapter(await import("next/server"));
  return nextAdapter(result);
}

/**
 * Builds the framework-agnostic {@link RouteRequest} from the parts the
 * framework hands the handler (`req: Request`, the parsed query string, and
 * — for `POST` — the JSON body).
 */
function routeRequestFrom(
  method: string,
  req: Request,
  query: Readonly<Record<string, string | string[] | undefined>>,
  body?: unknown,
): RouteRequest<unknown> {
  // Query parsers may surface repeated keys as arrays; the validation
  // schemas expect scalars, so keep the first value.
  const scalarQuery: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(query)) {
    scalarQuery[key] = Array.isArray(value) ? value[0] : value;
  }
  return { method, path: new URL(req.url).pathname, query: scalarQuery, body };
}

/** Parses a `POST` body as JSON; malformed JSON becomes a schema failure. */
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
 * `GET /items` — list items with validated, paginated query parameters.
 *
 * Validation failures short-circuit to the standardized 400 result; any
 * error the service throws is converted by {@link withErrorHandler}.
 */
const getListItems: RouteHandler<ListItemsResponse> = async (
  request: RouteRequest,
): Promise<RouteResult<ListItemsResponse>> => {
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
 * A malformed (non-JSON) body fails the body schema and is reported through
 * the same standardized 400 shape.
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

// --- Exported route handlers (wrapped: unhandled errors are caught) ----------

/** `GET /items` — list items. Never throws; errors are standardized. */
export async function GET(req: Request): Promise<unknown> {
  const query = Object.fromEntries(new URL(req.url).searchParams.entries());
  const result = await withErrorHandler(getListItems)(
    routeRequestFrom("GET", req, query),
  );
  return toNextResponse(result);
}

/** `POST /items` — create an item. Never throws; errors are standardized. */
export async function POST(req: Request): Promise<unknown> {
  const body = await readJsonBody(req);
  const query = Object.fromEntries(new URL(req.url).searchParams.entries());
  const result = await withErrorHandler(postCreateItem)(
    routeRequestFrom("POST", req, query, body),
  );
  return toNextResponse(result);
}
