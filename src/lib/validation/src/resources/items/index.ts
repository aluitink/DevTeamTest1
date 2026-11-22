/**
 * Demonstration resource: `items` (task #72).
 *
 * This module is the reference implementation for how every future resource
 * should be defined in `src/lib/validation`:
 *
 * - request body schemas for POST/PUT,
 * - a query schema for GET (list),
 * - a path-parameter schema for `/:id` routes,
 * - response payload schemas,
 * - inferred TypeScript types exported alongside each schema.
 *
 * Everything is plain Zod + types: no framework imports, so the same module
 * can be consumed from server route handlers and client-side fetch code
 * alike.
 */
import { z } from "zod";

import {
  type Id,
  type IdPathParams,
  IdSchema,
  type IsoDateTime,
  IsoDateTimeSchema,
  type PaginationQuery,
  createIdPathParams,
  createListResponseSchema,
} from "../../shared.js";

// ---------------------------------------------------------------------------
// Field-level primitives
// ---------------------------------------------------------------------------

export const ItemNameSchema = z
  .string()
  .trim()
  .min(1, "name must not be empty")
  .max(120, "name must be at most 120 characters");
export type ItemName = z.infer<typeof ItemNameSchema>;

export const ItemQuantitySchema = z.coerce.number().int().min(0).max(1_000_000);
export type ItemQuantity = z.infer<typeof ItemQuantitySchema>;

export const ItemNotesSchema = z.string().max(2000).optional();
export type ItemNotes = z.infer<typeof ItemNotesSchema>;

// ---------------------------------------------------------------------------
// Request bodies (POST /items, PUT /items/:id)
// ---------------------------------------------------------------------------

/** POST /items — create a new item. Unknown keys are rejected (strict). */
export const CreateItemRequestSchema = z.strictObject({
  name: ItemNameSchema,
  quantity: ItemQuantitySchema.default(0),
  notes: ItemNotesSchema,
});
export type CreateItemRequest = z.infer<typeof CreateItemRequestSchema>;

/**
 * PUT /items/:id — replace an existing item. All fields are required; use
 * PATCH-style partial schemas (a future task) when a subset is enough.
 */
export const UpdateItemRequestSchema = z.strictObject({
  name: ItemNameSchema,
  quantity: ItemQuantitySchema,
  notes: ItemNotesSchema,
});
export type UpdateItemRequest = z.infer<typeof UpdateItemRequestSchema>;

// ---------------------------------------------------------------------------
// Path parameters (GET/PUT/DELETE /items/:id)
// ---------------------------------------------------------------------------

/** Path parameters for `/items/:id`. */
export const itemPathParamsSchema = createIdPathParams("id");
export type ItemPathParams = IdPathParams;

/** Convenience re-export so route code can do `ItemPathParamsSchema`-style checks. */
export const ItemPathParamsSchema = itemPathParamsSchema;
export { IdSchema as ItemIdSchema };

// ---------------------------------------------------------------------------
// Query parameters (GET /items)
// ---------------------------------------------------------------------------

/**
 * GET /items — list query. Pagination comes from the shared pattern;
 * resource-specific filters (name search, minimum quantity) are added here.
 */
export const listItemsQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  name: z.string().trim().min(1).max(120).optional(),
  minQuantity: z.coerce.number().int().min(0).optional(),
  sortBy: z.enum(["name", "quantity", "updatedAt"]).default("updatedAt"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});
export type ListItemsQuery = z.infer<typeof listItemsQuerySchema>;

// ---------------------------------------------------------------------------
// Response payloads
// ---------------------------------------------------------------------------

/** A single item as returned by the API. */
export const ItemSchema = z.strictObject({
  id: IdSchema,
  name: ItemNameSchema,
  quantity: ItemQuantitySchema,
  notes: z.string().nullable(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type Item = z.infer<typeof ItemSchema>;

/** GET /items — list response envelope (items + pagination metadata). */
export const listItemsResponseSchema = createListResponseSchema(ItemSchema);
export type ListItemsResponse = z.infer<typeof listItemsResponseSchema>;

// ---------------------------------------------------------------------------
// Aggregates — import these where a route needs "all the item schemas"
// ---------------------------------------------------------------------------

/**
 * The canonical, reusable set of item schemas. Other resources should
 * export a matching object (see `createResourceSchemas` in `shared.ts`).
 */
export const itemSchemas = {
  id: IdSchema,
  pathParams: itemPathParamsSchema,
  createRequest: CreateItemRequestSchema,
  updateRequest: UpdateItemRequestSchema,
  listQuery: listItemsQuerySchema,
  item: ItemSchema,
  listResponse: listItemsResponseSchema,
} as const;

export type { Id, IsoDateTime, PaginationQuery };
