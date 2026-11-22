/**
 * `src/app/items` — public entry points (task #75).
 *
 * - `./data` — the simulated `items` API (a `fetch`-compatible mock of a
 *   real internal API / DB layer), for use in tests and local demos.
 * - `./lib` — the data-access layer: typed fetch + Zod boundary + caching
 *   strategies + `ItemsDataError`.
 * - `.` — re-exports the data layer (the part other code would import in a
 *   real app; the Server Component itself is a page file, imported by the
 *   router, not by consumer code).
 */
export {
  type FetchLike,
  type ItemsCacheStrategy,
  type ItemsDataClient,
  type GetItemParams,
  type ListItemsParams,
  ItemsDataError,
  type ItemsDataErrorCode,
  defaultListCacheStrategy,
  getItem,
  listItems,
  parseItem,
  parseListItemsResponse,
  type Item,
  type ListItemsQuery,
  type ListItemsResponse,
} from "./lib/itemsData.js";
