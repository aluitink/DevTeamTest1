# DevTeamTest1

This repository is in the middle of a core migration. It contains a legacy
.NET 10 console application alongside a growing set of modern TypeScript
projects (strict mode + Zod validation) that implement the target stack.
See [`docs/migration.md`](docs/migration.md) for the migration status,
workflow, and decision log.

- [Contributing Guidelines](CONTRIBUTING.md) — modern stack conventions
  (TypeScript strict mode, Zod validation), and the pull request process
  for migration-related work.
- [Codebase Audit](docs/audit.md) — routes, API endpoints, database
  entities, UI components, and existing tests.
- [Migration Statuses](docs/migration/statuses.md) — the `migrated`,
  `deprecated`, and `dropped` lifecycle states.

## Table of Contents

- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [1. Clone the repository](#1-clone-the-repository)
  - [2. Install dependencies](#2-install-dependencies)
  - [3. Configure environment variables (optional)](#3-configure-environment-variables-optional)
  - [4. Build](#4-build)
  - [5. Run locally](#5-run-locally)
  - [6. Run the tests](#6-run-the-tests)
- [Architecture](#architecture)
  - [Repository layout](#repository-layout)
  - [Key components](#key-components)
  - [Data flow and trust boundaries](#data-flow-and-trust-boundaries)
  - [Testing strategy](#testing-strategy)
- [Environment variables](#environment-variables)

## Getting Started

### Prerequisites

| Tool | Version | Used for |
| --- | --- | --- |
| .NET SDK | 10.0 (`net10.0`) | The console app, libraries, and xUnit test projects |
| Node.js | 20.x | The modern TypeScript projects under `src/` |
| npm | 10.x (ships with Node 20) | Dependency installation and workspace scripts |

### 1. Clone the repository

```bash
git clone <repository-url>
cd DevTeamTest1
```

### 2. Install dependencies

The repository has two dependency trees that are independent of each
other:

- **.NET** — NuGet packages (xUnit, VSTest SDK, …) are restored
  automatically on first build via `dotnet restore`.
- **TypeScript** — install the npm workspaces (`src/lib/validation`,
  `src/api-responses`) from the repository root:

```bash
npm ci        # or: npm install
```

### 3. Configure environment variables (optional)

No variables are mandatory. As a starting point, copy the documented
defaults to a local `.env` file (never commit `.env`):

```bash
cp .env.example ./.env
```

Apply them to your shell before running the app (see
[Environment variables](#environment-variables) for the full table):

```bash
set -a; . ./.env; set +a
```

### 4. Build

Build the .NET solution:

```bash
dotnet build DevTeamTest1.slnx
```

Build the modern TypeScript projects (runs `tsc` in each npm workspace;
must succeed with `strict: true` enabled):

```bash
npm run build
```

### 5. Run locally

The runnable application is the `hello` console app:

```bash
dotnet run --project hello            # prints: Hello, World!
dotnet run --project hello -- Alice   # prints: Hello, Alice!
```

The `hello` app takes an optional command-line argument and prints a
greeting to standard output.

The TypeScript projects are libraries (validation schemas, response
formatting, and a reference Server Component page) rather than runnable
services; they are exercised through their test suites and can be
imported into a real Next.js app.

### 6. Run the tests

**.NET** (xUnit via `dotnet test`):

```bash
dotnet test DevTeamTest1.slnx
```

**TypeScript** (Vitest, across the npm workspaces):

```bash
npm test
```

All tests must pass before a pull request is submitted (see
[CONTRIBUTING.md](CONTRIBUTING.md)).

## Architecture

The codebase is split between **legacy** code (kept in place during the
migration and only removed through the migration workflow) and **modern**
code (the target stack, living under `src/`). The migration of each
feature is tracked — with status, owner, and rationale — in the tracking
table in [`docs/migration.md`](docs/migration.md), and the lifecycle
states (`migrated` → `deprecated` → `dropped`) are defined in
`src/migration/MigrationStatuses.cs`.

### Repository layout

```
.
├── DevTeamTest1.slnx      # .NET solution (hello app + its tests)
├── hello.slnx             # fuller .NET solution incl. Greeter & migration projects
├── NuGet.Config           # nuget.org feed + global package cache location
├── package.json           # npm workspace root (build/test scripts)
├── tsconfig.base.json     # shared strict-mode TypeScript compiler options
├── .env.example           # documented, all-optional environment variables
├── Greeter/               # (legacy) greeting library: Greeter.Greet(string)
├── Greeter.Tests/         # (legacy) xUnit tests for Greeter
├── hello/                 # (legacy) .NET 10 console app (the runnable app)
├── hello.Tests/           # (legacy) xUnit unit + subprocess integration tests
├── src/                   # modern TypeScript/C# code (target of the migration)
│   ├── migration/         # MigrationStatus / MigrationStatuses definitions
│   ├── migration.Tests/   # tests for the migration status model
│   ├── lib/validation/    # @devteamtest1/validation — centralized Zod schemas
│   ├── api-responses/     # response formatting + error handling for route handlers
│   └── app/items/         # reference Next.js RSC data-fetching implementation
├── tests/docs.Tests/      # xUnit tests asserting the structure of the docs
└── docs/                  # migration.md, migration/statuses.md, audit.md
```

### Key components

**Legacy .NET application** (in-process, no network, no persistence):

| Component | Location | Role |
| --- | --- | --- |
| `hello` console app | `hello/Program.cs` | Entry point: reads an optional CLI argument and prints a greeting to stdout. |
| `Greeter` library | `Greeter/Greeter.cs` | Stateless `Greet(string name)` → `"Hello, {name}!"`. The app's only programmatic interface. |
| Migration status model | `src/migration/MigrationStatuses.cs` | `MigrationStatus` enum + `MigrationStatuses` helpers (descriptions, the senior-maintainer-approval rule for `Dropped`). Canonical source of truth for migration lifecycle states. |

**Modern TypeScript stack** (npm workspaces, TypeScript strict mode, Zod
at every trust boundary):

| Component | Location | Role |
| --- | --- | --- |
| `@devteamtest1/validation` | `src/lib/validation/` | Centralized, framework-agnostic **Zod schemas** (shared patterns — ids, dates, pagination, resource errors — and the `items` resource schemas). Single source of truth for runtime validation of untrusted data. |
| `api-responses` | `src/api-responses/` | Unified **error handling & response formatting** for API route handlers: `successResponse`, `errorResponse`, typed `ApiError` classes, a `withErrorHandler` wrapper, `validateRequest` (Zod-based request validation), and a response adapter (`jsonRouteResult` / optional Next.js shim). No business logic — formatting and conversion only. |
| `@devteamtest1/app-items` | `src/app/items/` | Reference implementation of the **Next.js App Router Server Component data-fetching pattern**: a `page.tsx` Server Component that fetches in Node, validates the response once with Zod at the boundary, memoizes with `cache()` + `revalidate`, and renders typed data with user-safe error states. Includes a `fetch`-compatible simulated API (`data/`) for tests and demos. |

**Documentation-as-code**: `tests/docs.Tests` runs structural xUnit tests
against `docs/migration.md` and `CONTRIBUTING.md` (required sections,
tracking-table columns, mandatory strict-mode/Zod statements), keeping the
documentation verified by CI rather than by eye.

### Data flow and trust boundaries

The modern code follows the "validate at the boundary, then trust" rule
(see [CONTRIBUTING.md](CONTRIBUTING.md)):

```
external/untrusted data (HTTP response, CLI, env, …)
        │
        ▼  Zod schema (src/lib/validation)
 typed, inferred data (z.infer)          ← single parse, no re-validation
        │
        ▼
 consumers (Server Components, route handlers)
```

A worked example is the `items` page: the Server Component (`page.tsx`)
calls the data layer (`lib/itemsData.ts`), which performs the `fetch`,
parses the body with `listItemsResponseSchema` exactly once, and hands the
inferred `ListItemsResponse` to the render path. Failures surface as typed
`ItemsDataError`s (`network_error` / `http_error` / `validation_error`)
that the component maps to user-safe messages — internals never leak to
the UI.

### Testing strategy

- **xUnit 2 / VSTest** for all C# projects (`dotnet test`), including
  subprocess integration tests that launch the compiled `hello` app and
  assert on its stdout, plus the docs-structure tests under `tests/docs.Tests`.
- **Vitest** for the TypeScript projects (`npm test`), covering every Zod
  schema (including invalid-input cases), the response/error utilities,
  and the Server Component against the simulated API.
- CI (`.github/workflows/ci.yml`) checks out the code and installs the npm
  dependencies; a build/test failure in strict mode is treated as blocking.

## Environment variables

This repository does not require any mandatory environment variables to
build, run, or test — the console app reads only an optional command-line
argument. All supported variables are optional and have the same default
values in every environment, so `.env.example` documents them with the
values the project ships with (see the shared development image in
`.devteam/Dockerfile`).

Copy `.env.example` to `.env` as a starting point:

```bash
cp .env.example ./.env
```

Never commit a real `.env` file or its values to the repository.

The variables defined in [`.env.example`](.env.example) and their purpose:

| Variable | Example value | Required? | Purpose |
| --- | --- | --- | --- |
| `DOTNET_NOLOGO` | `1` | No | Suppresses the .NET copyright/logo banner printed to the console by .NET apps and tools. |
| `DOTNET_CLI_TELEMETRY_OPTOUT` | `1` | No | Disables .NET CLI usage telemetry so builds and test runs stay hermetic and do not make network calls. |
| `DOTNET_SKIP_FIRST_TIME_EXPERIENCE` | `1` | No | Skips the .NET first-time experience prompts (welcome screen, license text) during CLI use. |
| `NUGET_PACKAGES` | `/workspace/nuget/packages` | No | Location of the global NuGet package cache. Keep in sync with `globalPackagesFolder` in `NuGet.Config`; the dev image pre-warms this cache to keep builds fast. |
| `NUGET_XMLDOC_MODE` | `skip` | No | Instructs the NuGet/dotnet build pipeline to skip XML documentation file generation for faster builds. |
| `GREETING_DEFAULT_NAME` | `World` | No | Default greeting subject used when `hello` is run without arguments. Currently informational: `hello/Program.cs` falls back to `"World"` and does not read this variable yet. |

To apply the variables from `.env` in a shell, export them before running
the app:

```bash
set -a; . ./.env; set +a
dotnet run --project hello
```

When new environment variables are added to the project (for example, a
future configuration switch), add them to `.env.example` and to the table
above in the same pull request.
