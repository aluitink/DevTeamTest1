/**
 * Shared building blocks for the centralized Zod validation schemas (task #72).
 *
 * These helpers are deliberately generic so that every future resource
 * (users, orders, …) can be defined with the same pattern:
 *
 * ```ts
 * import { z } from "zod";
 * import {
 *   createIdPathParams,
 *   createPaginationQuery,
 *   createResourceErrorEnvelope,
 *   createResourceSchemas,
 * } from "@devteamtest1/validation";
 *
 * const CreateTodoSchema = z.strictObject({ title: z.string().min(1).max(200) });
 * const TodoSchema = CreateTodoSchema.extend({ id: IdSchema, createdAt: IsoDateString });
 *
 * const todos = createResourceSchemas(CreateTodoSchema, TodoSchema);
 * // → CreateTodoInput, TodoOutput, todoPathParams, todoListQuery,
 * //   createTodoError, listTodosError
 * ```
 */
import { z } from "zod";

/** ISO 8601 UTC timestamp, e.g. `2026-01-02T03:04:05Z`. */
export const IsoDateTimeSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/,
    "must be an ISO 8601 timestamp such as 2026-01-02T03:04:05Z",
  );
export type IsoDateTime = z.infer<typeof IsoDateTimeSchema>;

/**
 * Identifier schema used for every `/:id` path parameter.
 *
 * Deliberately permissive on format (any non-empty string) so resources can
 * use UUIDs, slugs, or numeric ids without redeclaring the path parameter;
 * resources that need a stricter format can compose on top of it, e.g.
 * `IdSchema.regex(/^[0-9a-f-]{36}$/i)` for UUIDs.
 */
export const IdSchema = z
  .string()
  .min(1, "id must not be empty")
  .max(128, "id must be at most 128 characters")
  .refine((value) => !/[\s/\\]/.test(value), "id must not contain whitespace or path separators");
export type Id = z.infer<typeof IdSchema>;

/**
 * Path parameters for a single-resource route: `{ id }`.
 *
 * Pattern for every resource: every `GET/PUT/DELETE /<resource>/:id` route
 * parses its parameters with this schema.
 */
export const idPathParamsSchema = z.strictObject({ id: IdSchema });
export type IdPathParams = z.infer<typeof idPathParamsSchema>;

/** Factory: path parameters for a resource identified by `id` (e.g. `/items/:id`). */
export function createIdPathParams<T extends string = "id">(name: T): z.ZodObject<{ [K in T]: typeof IdSchema }> {
  return z.strictObject({ [name]: IdSchema }) as z.ZodObject<{ [K in T]: typeof IdSchema }>;
}

/** 1-based page number and bounded page size for list endpoints. */
export const PaginationQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

/**
 * Envelope returned with every list response: the items themselves plus a
 * small, stable set of pagination metadata. Resources compose this with
 * their own item schema, e.g. `PaginationQuerySchema.shape.pageSize` is
 * available for the `pageSize` field when reporting what was actually used.
 */
export function createListResponseSchema<ItemSchema extends z.ZodTypeAny>(itemSchema: ItemSchema) {
  return z.strictObject({
    items: z.array(itemSchema),
    total: z.number().int().min(0),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
  });
}

/**
 * Standard error envelope for API responses (4xx/5xx).
 *
 * `code` is a machine-readable, stable identifier (e.g. `"validation_error"`);
 * `message` is a human-readable summary that must never expose internals.
 */
export const ResourceErrorSchema = z.strictObject({
  error: z.strictObject({
    code: z.string().min(1),
    message: z.string().min(1),
    issues: z.array(z.strictObject({ path: z.array(z.string()), message: z.string().min(1) })).optional(),
  }),
});
export type ResourceError = z.infer<typeof ResourceErrorSchema>;

/**
 * One-stop factory that defines the canonical set of schemas for a
 * resource, following the project's "validate at the boundary, then trust"
 * rule (see CONTRIBUTING.md → "Zod usage patterns").
 *
 * @param createInput  Schema for the POST request body (`Create<Name>Input`).
 * @param outputSchema Schema for the full resource as returned by the API
 *                     (`<Name>Output`). Usually `createInput.extend({ id, … })`.
 * @param name         Lower-case resource name, e.g. `"item"` or `"user"`,
 *                     used to derive sensible export names and route ids.
 */
export function createResourceSchemas<
  const CreateInput extends z.ZodTypeAny,
  const Output extends z.ZodTypeAny,
>(createInput: CreateInput, outputSchema: Output, name: string) {
  return {
    /** POST /{name}s — request body schema. */
    createInputSchema: createInput,
    /** Response payload schema for a single resource. */
    outputSchema,
    /** GET/PUT/DELETE /{name}s/:id — path parameters. */
    pathParamsSchema: createIdPathParams("id") as z.ZodTypeAny,
    /** GET /{name}s — query parameters (pagination + anything resource-specific). */
    listQuerySchema: PaginationQuerySchema as z.ZodTypeAny,
    /** GET /{name}s — response envelope. */
    listResponseSchema: createListResponseSchema(outputSchema as z.ZodTypeAny),
    /** 4xx error envelope. */
    errorSchema: ResourceErrorSchema,
    /** Resource name, handy for route builders and logging. */
    name,
  };
}
