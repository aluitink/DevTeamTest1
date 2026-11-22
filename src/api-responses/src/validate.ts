import { z } from "zod";

import { BadRequestError } from "./api-error.js";
import { errorResponseFromDetails, type ErrorPayload } from "./error.js";
import type { RouteResult } from "./handler.js";

/**
 * The sections of a route request that can carry untrusted input.
 */
export type RequestPart = "params" | "query" | "body";

/**
 * Schemas describing the untrusted inputs of one route handler.
 *
 * All three slots are optional: pass only the parts the route actually
 * receives (e.g. a `GET /items/:id` route needs `params` and maybe `query`,
 * but no `body`). At least one schema must be provided.
 *
 * @typeParam TParams - Schema for path parameters (`/:id`, …).
 * @typeParam TQuery - Schema for query-string parameters.
 * @typeParam TBody - Schema for the JSON request body.
 */
export interface RequestSchemas<
  TParams extends z.ZodTypeAny,
  TQuery extends z.ZodTypeAny,
  TBody extends z.ZodTypeAny,
> {
  /** Schema the raw path-parameter record must satisfy. */
  readonly params?: TParams;
  /** Schema the raw query-string record must satisfy. */
  readonly query?: TQuery;
  /** Schema the raw JSON request body must satisfy. */
  readonly body?: TBody;
}

/**
 * The result of {@link validateRequest}.
 *
 * - `{ ok: true, data }` — all provided sections parsed successfully; `data`
 *   carries the *inferred* Zod output types, which downstream code may trust
 *   and must not re-validate (see CONTRIBUTING.md → "Zod usage patterns").
 *   Sections without a schema are `undefined`.
 * - `{ ok: false, error }` — at least one section failed; `error` is a
 *   {@link RequestValidationError} whose client-safe `details` is the
 *   flattened {@link ValidationIssue} list.
 */
export type ValidationResult<
  TParams extends z.ZodTypeAny,
  TQuery extends z.ZodTypeAny,
  TBody extends z.ZodTypeAny,
> =
  | {
      readonly ok: true;
      readonly data: {
        readonly params: TParams extends z.ZodTypeAny ? z.infer<TParams> : undefined;
        readonly query: TQuery extends z.ZodTypeAny ? z.infer<TQuery> : undefined;
        readonly body: TBody extends z.ZodTypeAny ? z.infer<TBody> : undefined;
      };
    }
  | { readonly ok: false; readonly error: RequestValidationError };

/**
 * A single validation issue, flattened to the stable wire shape
 * `{ part, path, message }`.
 *
 * `part` says *which* request section failed; `path` is the dotted JSON path
 * within that section (empty string for the top-level value).
 */
export interface ValidationIssue {
  /** The request section the issue belongs to. */
  readonly part: RequestPart;
  /** JSON path within that section (e.g. `"items.0.name"`); `""` for the top level. */
  readonly path: string;
  /** A human-readable, client-safe issue message. */
  readonly message: string;
}

/**
 * A {@link BadRequestError} produced by a failed validation.
 *
 * The flattened {@link ValidationIssue} list is passed as `details` and is
 * marked client-safe by {@link BadRequestError}, so it is included in the
 * standardized error response body.
 */
export class RequestValidationError extends BadRequestError {
  constructor(issues: ValidationIssue[]) {
    super("Request validation failed.", issues);
  }
}

/**
 * Flattens a Zod error's issues into the stable {@link ValidationIssue}[]
 * wire shape used in the standardized 400 response.
 */
export function formatValidationIssues(
  part: RequestPart,
  error: z.ZodError,
): ValidationIssue[] {
  return error.issues.map((issue) => ({
    part,
    path: issue.path.map(String).join("."),
    message: issue.message,
  }));
}

/**
 * Validates the raw, untrusted sections of a route request (path params,
 * query string, JSON body) against the provided Zod schemas.
 *
 * This is the "validate at the boundary, then trust" seam for route handlers
 * (see CONTRIBUTING.md → "Zod usage patterns"). It contains **no
 * framework-specific code** — the raw inputs are plain JSON structures,
 * exactly what a framework adapter (e.g. a thin Next.js shim) would hand it.
 *
 * @param schemas - Which sections to validate, and with which schemas.
 *   At least one of `params` / `query` / `body` must be present.
 * @param raw - The untrusted values from the incoming request.
 * @returns A {@link ValidationResult}: either the parsed, typed data, or a
 *   standardized {@link RequestValidationError}.
 *
 * @example
 * ```ts
 * const result = validateRequest(
 *   { params: itemPathParamsSchema, body: CreateItemRequestSchema },
 *   { params: { id: "1" }, body: { name: "Hammer" } },
 * );
 *
 * const failure = toValidationErrorResult(result);
 * if (failure) return failure; // 400 with { error: { code, message, details } }
 *
 * const { params, body } = result.data;
 * // params: { id: string }, body: CreateItemRequest — fully typed.
 * ```
 */
export function validateRequest<
  TParams extends z.ZodTypeAny,
  TQuery extends z.ZodTypeAny,
  TBody extends z.ZodTypeAny,
>(
  schemas: RequestSchemas<TParams, TQuery, TBody>,
  raw: {
    readonly params?: unknown;
    readonly query?: unknown;
    readonly body?: unknown;
  },
): ValidationResult<TParams, TQuery, TBody> {
  if (!schemas.params && !schemas.query && !schemas.body) {
    throw new TypeError(
      "validateRequest: at least one of `schemas.params`, `schemas.query`, or `schemas.body` is required.",
    );
  }

  const issues: ValidationIssue[] = [];
  const data: {
    params?: unknown;
    query?: unknown;
    body?: unknown;
  } = {};

  const sections: Array<{
    part: RequestPart;
    schema: z.ZodTypeAny | undefined;
    value: unknown;
  }> = [
    { part: "params", schema: schemas.params, value: raw.params },
    { part: "query", schema: schemas.query, value: raw.query },
    { part: "body", schema: schemas.body, value: raw.body },
  ];

  let failed = false;
  for (const section of sections) {
    if (section.schema === undefined) {
      continue;
    }
    const result = section.schema.safeParse(section.value);
    if (result.success) {
      data[section.part] = result.data;
    } else {
      failed = true;
      issues.push(...formatValidationIssues(section.part, result.error));
    }
  }

  if (failed) {
    return { ok: false, error: new RequestValidationError(issues) };
  }

  return {
    ok: true,
    data: {
      params: data.params,
      query: data.query,
      body: data.body,
    } as {
      readonly params: z.infer<TParams>;
      readonly query: z.infer<TQuery>;
      readonly body: z.infer<TBody>;
    },
  };
}

/**
 * Converts a failed {@link ValidationResult} into a standardized 400
 * {@link RouteResult} built with the same error-formatting utilities the
 * rest of the app uses ({@link errorResponseFromDetails}).
 *
 * On success this returns `undefined`, signalling the caller to continue
 * with the parsed data. It returns a plain `RouteResult` — **no**
 * framework-specific `Response` — so it stays testable and can be turned
 * into a framework response by the thin adapter layer.
 *
 * @example
 * ```ts
 * const result = validateRequest(schemas, raw);
 * const failure = toValidationErrorResult(result);
 * if (failure) return failure; // { status: 400, body: { error: { … } } }
 * ```
 */
/**
 * Narrows a {@link ValidationResult} to its success variant. Use it after a
 * guard (e.g. `if (!result.ok) return toValidationErrorResult(result);`) so
 * the compiler knows the parsed `data` is available.
 */
export function isValidationSuccess<
  TParams extends z.ZodTypeAny,
  TQuery extends z.ZodTypeAny,
  TBody extends z.ZodTypeAny,
>(
  result: ValidationResult<TParams, TQuery, TBody>,
): result is Extract<ValidationResult<TParams, TQuery, TBody>, { ok: true }> {
  return result.ok;
}

export function toValidationErrorResult<TParams extends z.ZodTypeAny, TQuery extends z.ZodTypeAny, TBody extends z.ZodTypeAny>(
  result: ValidationResult<TParams, TQuery, TBody>,
): RouteResult<never> | undefined {
  if (result.ok) {
    return undefined;
  }
  return {
    status: 400,
    body: errorResponseFromDetails(result.error.toErrorDetails()) as ErrorPayload,
  };
}
