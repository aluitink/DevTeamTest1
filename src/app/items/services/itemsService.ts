/**
 * Placeholder `items` service layer (task #74).
 *
 * This is the **service seam** for the `items` API route handlers. It exists
 * so the route handlers in `src/app/api/items` stay free of business logic
 * (the route layer only validates the request, calls exactly one service
 * function, and formats the response) and so the handlers can be unit-tested
 * by swapping the service for a spy.
 *
 * It intentionally returns **dummy data**: an in-memory store seeded from
 * the same rows the simulated fetch API (`data/itemsApi.ts`, task #75)
 * uses. A real implementation would replace the body of each function with
 * database calls — the signatures are already shaped like the eventual
 * domain service, so nothing in the route layer would change.
 */
import {
  type CreateItemRequest,
  type Item,
  type ListItemsQuery,
  type ListItemsResponse,
  type UpdateItemRequest,
  type Id,
} from "@devteamtest1/validation";

import { NotFoundError } from "api-responses";

import { defaultItemsSeed } from "../data/itemsApi.js";

/**
 * The service contract the route handlers call. Every function takes
 * *already-validated* inputs (the route layer parsed them with Zod before
 * the call — "validate at the boundary, then trust") and may throw
 * `NotFoundError` for missing resources; the `withErrorHandler` wrapper
 * around each route handler converts the thrown error into a standardized
 * 404 response.
 */
export interface ItemsService {
  listItems(query: ListItemsQuery): Promise<ListItemsResponse>;
  getItem(id: Id): Promise<Item>;
  createItem(input: CreateItemRequest): Promise<Item>;
  updateItem(id: Id, input: UpdateItemRequest): Promise<Item>;
  deleteItem(id: Id): Promise<{ id: Id }>;
}

/**
 * In-memory implementation backed by the demo seed data. Each call to
 * {@link createItemsService} gets its own isolated store, so tests can
 * start from a known state.
 */
export function createItemsService(seed: Item[] = defaultItemsSeed): ItemsService {
  const rows: Map<string, Item> = new Map(seed.map((row) => [row.id, { ...row }]));
  let counter = rows.size + 1;

  function requireRow(id: Id): Item {
    const row = rows.get(id);
    if (row === undefined) {
      throw new NotFoundError(`No item with id '${id}'.`);
    }
    return row;
  }

  function nextId(): string {
    // `itm-0004`, `itm-0005`, … — mirrors the seed id format.
    const id = `itm-${String(counter++).padStart(4, "0")}`;
    return id;
  }

  return {
    async listItems(query): Promise<ListItemsResponse> {
      let result = [...rows.values()];

      if (query.name !== undefined) {
        const needle = query.name.toLowerCase();
        result = result.filter((row) => row.name.toLowerCase().includes(needle));
      }
      if (query.minQuantity !== undefined) {
        result = result.filter((row) => row.quantity >= (query.minQuantity as number));
      }

      const direction = query.sortDir === "asc" ? 1 : -1;
      const key = query.sortBy as "name" | "quantity" | "updatedAt";
      result.sort((a, b) => {
        const av = a[key];
        const bv = b[key];
        if (av < bv) return -1 * direction;
        if (av > bv) return 1 * direction;
        return 0;
      });

      const start = (query.page - 1) * query.pageSize;
      return {
        items: result.slice(start, start + query.pageSize).map((row) => ({ ...row })),
        total: result.length,
        page: query.page,
        pageSize: query.pageSize,
      };
    },

    async getItem(id): Promise<Item> {
      return { ...requireRow(id) };
    },

    async createItem(input): Promise<Item> {
      const now = new Date().toISOString();
      const row: Item = {
        id: nextId(),
        name: input.name,
        quantity: input.quantity,
        notes: input.notes ?? null,
        createdAt: now,
        updatedAt: now,
      };
      rows.set(row.id, row);
      return { ...row };
    },

    async updateItem(id, input): Promise<Item> {
      const existing = requireRow(id);
      const row: Item = {
        id: existing.id,
        name: input.name,
        quantity: input.quantity,
        notes: input.notes ?? null,
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString(),
      };
      rows.set(id, row);
      return { ...row };
    },

    async deleteItem(id): Promise<{ id: Id }> {
      requireRow(id);
      rows.delete(id);
      return { id };
    },
  };
}

/**
 * Default service instance used by the route handlers. Tests that need
 * isolation call {@link createItemsService} directly.
 */
export const itemsService: ItemsService = createItemsService();
