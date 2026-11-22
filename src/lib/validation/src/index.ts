/**
 * `@devteamtest1/validation` — centralized Zod validation schemas (task #72).
 *
 * Single entry point. Import from here (or from the `./items` subpath for
 * resource-specific schemas):
 *
 * ```ts
 * import { itemSchemas, CreateItemRequest } from "@devteamtest1/validation";
 * ```
 *
 * Schemas are framework-agnostic and pure TypeScript, so they work in both
 * server and client contexts.
 */

// Shared pattern definitions — reuse these for every new resource.
export {
  IdSchema,
  type Id,
  IsoDateTimeSchema,
  type IsoDateTime,
  idPathParamsSchema,
  type IdPathParams,
  createIdPathParams,
  PaginationQuerySchema,
  type PaginationQuery,
  createListResponseSchema,
  ResourceErrorSchema,
  type ResourceError,
  createResourceSchemas,
} from "./shared.js";

// Demonstration resource: items.
export {
  ItemNameSchema,
  type ItemName,
  ItemQuantitySchema,
  type ItemQuantity,
  ItemNotesSchema,
  type ItemNotes,
  CreateItemRequestSchema,
  type CreateItemRequest,
  UpdateItemRequestSchema,
  type UpdateItemRequest,
  itemPathParamsSchema,
  ItemPathParamsSchema,
  type ItemPathParams,
  ItemIdSchema,
  listItemsQuerySchema,
  type ListItemsQuery,
  ItemSchema,
  type Item,
  listItemsResponseSchema,
  type ListItemsResponse,
  itemSchemas,
} from "./resources/items/index.js";
