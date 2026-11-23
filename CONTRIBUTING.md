# Contributing Guidelines

Thank you for contributing to this repository. This repository is in the
middle of a core migration (see [`docs/migration.md`](docs/migration.md)).
The guidelines below describe the modern technology stack conventions, the
rules for working with external data, and the pull request process — with
special rules for migration-related work.

## Modern Technology Stack

New (modern) code lives under `src/` (for example `src/hello/`,
`src/migration/`). Legacy code (`Greeter/`, `hello/`) stays in place during
the transition and must not be deleted except through the migration workflow
described below.

### TypeScript strict mode is mandatory

All modern TypeScript code **must** be written with strict mode enabled and
kept enabled. This is non-negotiable:

- `strict: true` **must** be set in `tsconfig.json` (the modern root
  `tsconfig.json` and any project reference). New projects must not omit it.
- The full set of strict-family checks applies; do **not** disable any of
  the following:

  - `noImplicitAny`
  - `strictNullChecks`
  - `strictFunctionTypes`
  - `strictBindCallApply`
  - `strictPropertyInitialization`
  - `noImplicitThis`
  - `alwaysStrict`
  - `useUnknownInCatchVariables`
  - `noImplicitReturns` / `noFallthroughCasesInSwitch`
  - `noUncheckedIndexedAccess`

- Never use `// @ts-ignore` or `// @ts-expect-error` to silence real type
  problems. If a type genuinely cannot be expressed, add a comment explaining
  why and scope the suppression as narrowly as possible.
- Prefer explicit, precise types. Avoid `any`; when interoperating with
  untyped external data, prefer `unknown` and narrow it explicitly (see the
  Zod rules below).

The CI build fails if `strict: true` is missing from the modern
`tsconfig.json`. Treat a strict-mode build failure as a blocking review
comment.

### Zod usage patterns

**Zod is the single source of truth for runtime validation of untrusted
data.** Because the TypeScript build is type-checked only at compile time,
any data that crosses a trust boundary must be validated at runtime with a
Zod schema. Type annotations alone are never sufficient.

Rules:

1. **External data inputs must always go through Zod.** This includes, but
   is not limited to:

   - HTTP request bodies, query strings, and path parameters
   - URLs / deep links and anything parsed from them
   - CLI arguments, environment variables, and config files
   - Files read from disk that were not written by this application
   - Responses from third-party APIs, webhooks, and message queues
   - Values returned by `JSON.parse` or `JSON.parse`-like deserialization of
     external content

2. **Validate at the boundary, then trust.** Parse the input exactly once,
   at the edge of the system. Code downstream of the parse call receives the
   *inferred* Zod output type and must not re-validate the same data.

   ```ts
   import { z } from "zod";

   // External input: an HTTP request body (untrusted).
   const NewTodoSchema = z.object({
     title: z.string().min(1).max(200),
     dueDate: z.coerce.date(),
     priority: z.enum(["low", "medium", "high"]).default("medium"),
   });

   export interface NewTodo extends z.infer<typeof NewTodoSchema> {}

   // At the boundary (route handler):
   const result = NewTodoSchema.safeParse(requestBody);
   if (!result.success) {
     // Return 400 with result.error.issues — never throw raw parse errors.
     throw new ValidationError(result.error.issues);
   }

   // Downstream: `result.data` is fully typed — no `any`, no re-parsing.
   const todo: NewTodo = result.data;
   ```

3. **Critical internal interfaces should also have Zod schemas.** For
   interfaces at the seams between modules (e.g. domain events, payloads
   passed between services, persistence boundaries), export a Zod schema
   alongside the TypeScript type and derive the type from the schema with
   `z.infer`. This keeps the runtime shape and the compile-time type from
   drifting apart.

   ```ts
   const MigrationEventSchema = z.object({
     feature: z.string(),
     status: z.enum(["migrated", "deprecated", "dropped"]),
     dateUpdated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
   });
   export type MigrationEvent = z.infer<typeof MigrationEventSchema>;
   ```

4. **Never use `.passthrough()` to hide unknown keys** on external inputs;
   use `strict()` or `strictObject()` so unexpected keys are surfaced as
   validation errors.
5. **Do not hand-write the inferred type.** Define the schema first and use
   `z.infer<typeof Schema>` so there is exactly one definition of the shape.
6. Schemas for validated boundaries **must** be covered by unit tests,
   including at least one invalid-input case per schema.

### Canonical package manager: npm

**npm is the single canonical package manager** for this repository
(decision #111, superseding the pnpm proposal in #64). Downstream tasks
should treat `PM = npm` as a fixed input.

- Use `npm` for all installs, lockfile updates, and workspace scripts
  (`npm ci`, `npm run build`, `npm test`, …). Do **not** use pnpm, yarn, or
  any other manager; never commit `pnpm-lock.yaml` or a `packageManager`
  field pinning a non-npm manager.
- **`package-lock.json` must stay committed.** Any change to the root or a
  workspace `package.json` must be committed together with the regenerated
  `package-lock.json` so `npm ci` works from a clean clone.
- The `"type": "module"` + npm workspaces layout
  (`src/lib/validation`, `src/api-responses`) is supported natively by npm;
  see [`docs/package-manager-decision.md`](docs/package-manager-decision.md)
  for the full rationale.

## General pull request process

- Keep pull requests small and focused on a single logical change.
- Branch from the default branch; use the branch naming convention
  `feature/<issue>-<short-description>`.
- Title PRs in the form `Description (#issue)`.
- Before requesting review:

  - The build passes with strict mode enabled (for TypeScript).
  - All tests pass, and you added tests for any new validated boundary.
  - The PR description explains *what* changed and *why*, and links the
    issue that motivated it.

- A PR is merged when it has the required approvals (see the migration
  review rules below for migration work), all CI checks are green, and no
  unresolved review comments remain.

## Pull request process for migration-related tasks

Migration work — any change that ports a feature, changes a migration
status, adds or removes an `[Obsolete]` marker, or deletes legacy code —
follows the workflow in [`docs/migration.md`](docs/migration.md). The
special rules:

1. **Reference `docs/migration.md` in every migration PR and commit.**
   Every migration-related pull request **must** mention
   `docs/migration.md` in its description (e.g. under a "Migration
   documentation" section) and each migration-related commit message **must**
   reference it (e.g. `Refs docs/migration.md` or a link). This is a
   required part of the PR template and is checked during review.
2. **Docs and code ship together.** Per the golden rule in
   [`docs/migration.md`](docs/migration.md), the PR must update the
   tracking table (and the Decision Log when a decision was made) in the
   *same* pull request as the code change. Reviewers must reject PRs that
   change migration status without the matching documentation update.
3. **Reviewer requirements:**

   - Every migration PR requires **two approvals**: one reviewer familiar
     with the feature being migrated, and one maintainer.
   - Moving a feature to `dropped` additionally requires an explicit
     **senior maintainer approval** in the PR before any legacy code is
     deleted (see [`docs/migration/statuses.md`](docs/migration/statuses.md)
     and `src/migration/MigrationStatuses.cs`). The approver's name and date
     must be recorded in the PR, and the justification for dropping must be
     filled in on the tracking table row.
   - Reviewers must verify: the tracking table row was updated (status,
     modern location, date, owner, justification); no legacy code was
     deleted before the deprecation window elapsed; `[Obsolete]` messages
     name the modern replacement; and any non-obvious decision is recorded
     in the append-only Decision Log.
4. **Do not reorder the lifecycle.** Statuses move
   `migrated` → `deprecated` → `dropped` only; PRs that skip a stage or
   move a row backward must be rejected.

## Building and testing

The repository is a .NET 10 solution. Build and run tests with:

```bash
dotnet build DevTeamTest1.slnx
dotnet test DevTeamTest1.slnx
```

For modern TypeScript projects, `npm run build` must succeed with
`strict: true` enabled and `npm test` must pass before a PR is submitted.

## Questions?

If you are unsure about migration status, ownership, or a past decision,
check [`docs/migration.md`](docs/migration.md) first — the tracking table
and Decision Log are the single source of truth.
