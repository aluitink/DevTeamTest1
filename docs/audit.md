# Codebase Audit

This document is a living audit of the repository. Sections are filled in by
subsequent tasks.

## Routes

None. This repository is a .NET 10 console application. There is no
frontend, no UI framework, and no routing configuration.

The application entry point is `hello/Program.cs`
(`Program.Main(string[] args)`), which reads an optional command-line
argument and prints a greeting to standard output. It has no URL paths,
pages, components, route guards, or route parameters.

## API Endpoints

None. The repository contains no HTTP server, no web framework
(ASP.NET Core / Minimal API), and no REST or GraphQL endpoints.

The only programmatic interface is a single public method:

| Method | Signature | File | Description |
| --- | --- | --- | --- |
| `Greet` | `string Greet(string name)` | `Greeter/Greeter.cs` | Returns the greeting string `"Hello, {name}!"` for the given name. |

This method is invoked directly in-process (not over a network protocol);
it is not an HTTP endpoint.

## Database Entities

None. The repository has no data persistence layer.

- There are no ORM entities, POCO models mapped to database tables, or
  EF Core `DbContext` classes.
- No connection strings, migration files, or `.sql`/schema files exist.
- No files are read from or written to disk; the only input is an optional
  command-line argument and the only output is a single line printed to
  standard output.

The only types defined in the codebase are:

| Type | Kind | Fields | Relationships | File |
| --- | --- | --- | --- | --- |
| `Greeter.Greeter` | Plain class (not an entity) | none (stateless) | none | `Greeter/Greeter.cs` |
| `Program` | Static console entry point | `_greeter` (static field, `Greeter.Greeter`) | references `Greeter.Greeter` in-process | `hello/Program.cs` |

No migrations exist.

## Third-Party Dependencies

All external packages are NuGet packages (no `package.json`,
`requirements.txt`, `go.mod`, etc.). They appear only in the two test
projects; the `Greeter` library and `hello` console app reference no
external packages at all.

### Test framework & tooling

| Package | Version | Used in | Category | Purpose |
| --- | --- | --- | --- | --- |
| `xunit` | 2.9.3 | `Greeter.Tests`, `hello.Tests` | Testing | xUnit unit-testing framework (assertions, test discovery attributes). |
| `xunit.runner.visualstudio` | 3.1.4 | `Greeter.Tests`, `hello.Tests` | Testing | Adapter that runs xUnit tests under the VSTest runner (e.g. `dotnet test`). |
| `Microsoft.NET.Test.Sdk` | 17.14.1 | `Greeter.Tests`, `hello.Tests` | Testing | Microsoft test platform (VSTest) SDK that hosts and reports test execution. |
| `coverlet.collector` | 6.0.4 | `Greeter.Tests`, `hello.Tests` | Testing / coverage | Collects code-coverage data (e.g. via VS/VS Code coverage tools) when tests run. |

### Framework

Both test projects and the application target the **.NET 10**
(`net10.0`) shared framework, supplied by the runtime/SDK rather than as a
package reference.

### Internal project references (not third-party, listed for completeness)

| Reference | Referenced by | Purpose |
| --- | --- | --- |
| `Greeter` (project) | `hello`, `Greeter.Tests`, `hello.Tests` (transitively) | The greeting library under test. |
| `hello` (project) | `hello.Tests` | The console app, referenced by integration tests to build/copy its output assembly. |

### Package sources

`NuGet.Config` uses `nuget.org` (`https://api.nuget.org/v3/index.json`) and
stores the global package cache at `/workspace/nuget/packages`.

## UI Components

None. This repository is a .NET 10 **console application**; it contains no
graphical or web UI, no UI framework (WinForms, WPF, Blazor, ASP.NET Core
MVC/Razor, MAUI, Avalonia, etc.), and no frontend assets (no `.razor`,
`.cshtml`, `.xaml`, `.html`, `.css`, or `.js` files).

### Identified components

There are **no reusable UI components** to document — no buttons, forms,
cards, modals, views, or widgets exist anywhere in the codebase. The only
"interface" is plain text written to the console:

| Component | Kind | File | Description |
| --- | --- | --- | --- |
| *(none)* | — | — | No UI components exist. |

### Interactivity

There is no user interaction beyond the command line:

- **Input:** an optional single command-line argument (`args[0]`) read once
  at startup by `Program.Main(string[] args)` in `hello/Program.cs`. There
  are no click handlers, key bindings, form submissions, or event
  subscriptions.
- **State changes:** the only state is a `static readonly` `Greeter.Greeter`
  field (a stateless string formatter). No reactive state, view models, or
  observable properties exist.
- **Output:** a single line (`"Hello, {name}!"`, or `"Hello, World!"` when no
  argument is supplied) printed via `Console.WriteLine`.
- **API calls triggered:** none. `Greet` is called in-process; no HTTP
  client, WebSocket, or other network calls are made, and no side effects
  (file I/O, database writes) occur.
- **Process lifetime:** the process runs `Main` once and exits immediately;
  there is no event loop, message pump, or window lifecycle.

The test suite (`HelloAppIntegrationTests`) exercises this "interface" by
launching the compiled console app as a subprocess and asserting on its
stdout; it confirms the only observable behavior is the greeting text line.

## Existing Tests

The repository uses **xUnit 2** (via the VSTest / `dotnet test` runner) for
all testing. Two test projects exist, both targeting `net10.0`. All 7 tests
were executed locally with `dotnet test` and **pass**.

| Test project | Test file | Type | Tests | Status |
| --- | --- | --- | --- | --- |
| `Greeter.Tests` | `Greeter.Tests/GreeterTests.cs` | Unit tests for `Greeter.Greet` (normal, empty, and `null` input) | 3 | **Passing** |
| `hello.Tests` | `hello.Tests/GreeterTests.cs` | Unit tests for `Greeter.Greet` (normal and empty input) | 2 | **Passing** |
| `hello.Tests` | `hello.Tests/HelloAppIntegrationTests.cs` | Integration tests: launches the compiled `hello` console app as a subprocess and asserts on its stdout (with and without a CLI argument) | 2 | **Passing** |

### Test details

**`Greeter.Tests/GreeterTests.cs`** (3 tests, all passing)

| Test method | Asserts |
| --- | --- |
| `Greet_World_Returns_Hello_World_Exclamation` | `Greet("World")` returns `"Hello, World!"` |
| `Greet_EmptyString_Returns_Hello_Exclamation` | `Greet("")` returns `"Hello, !"` |
| `Greet_Null_Returns_Hello_Exclamation` | `Greet(null)` returns `"Hello, !"` |

**`hello.Tests/GreeterTests.cs`** (2 tests, all passing)

| Test method | Asserts |
| --- | --- |
| `Greet_World_Returns_Hello_World_Exclamation` | `Greet("World")` returns `"Hello, World!"` |
| `Greet_EmptyString_Returns_Hello_Exclamation` | `Greet(string.Empty)` returns `"Hello, !"` |

**`hello.Tests/HelloAppIntegrationTests.cs`** (2 tests, all passing)

| Test method | Asserts |
| --- | --- |
| `HelloApp_WithArgument_Alice_Prints_Hello_Alice` | Running `dotnet hello.dll Alice` prints `Hello, Alice!` with exit code 0 and empty stderr |
| `HelloApp_WithoutArguments_Prints_Hello_World` | Running `dotnet hello.dll` prints `Hello, World!` with exit code 0 and empty stderr |

### Execution summary

- `dotnet test DevTeamTest1.slnx` (includes `hello.Tests`):
  `Passed! - Failed: 0, Passed: 4, Skipped: 0, Total: 4` — **Passing**
- `dotnet test Greeter.Tests/Greeter.Tests.csproj`:
  `Passed! - Failed: 0, Passed: 3, Skipped: 0, Total: 3` — **Passing**

No CI configuration (e.g. `.github/workflows`) exists in the repository, so
status was determined by running the tests locally. There are no skipped,
disabled (`[Fact(Skip = ...)]`), or failing tests.

## Feature Parity Checklist

Synthesized from the audits of routes, API endpoints, database entities,
third-party dependencies, UI components, and existing tests. Because this
repository is a small .NET 10 console application, the "features" are
limited to the console program's behavior, the `Greeter` library, and the
test/tooling surface. Every checkbox is intentionally **unchecked** so the
list can be used to track functionality as the codebase is refactored —
tick a box once the feature is verified to behave identically after the
change.

### Core greeting functionality

- [ ] `Greeter.Greet(string name)` returns `"Hello, {name}!"` for a normal (non-empty) name
- [ ] `Greeter.Greet(string name)` returns `"Hello, !"` when passed an empty string
- [ ] `Greeter.Greet(string name)` returns `"Hello, !"` when passed `null`
- [ ] `Greeter` remains a stateless class with no fields or dependencies

### Console application behavior (`hello`)

- [ ] `Program.Main(string[] args)` is the application entry point
- [ ] With a single command-line argument, the app prints `Hello, {arg}!` to stdout
- [ ] With no command-line arguments, the app prints `Hello, World!` to stdout
- [ ] Output is written to standard output (stdout) only; nothing is written to stderr on success
- [ ] The process exits with exit code `0` for the above invocations
- [ ] The `hello` app references and uses the `Greeter` library in-process

### API surface

- [ ] The only public programmatic interface remains `string Greet(string name)` in `Greeter/Greeter.cs`
- [ ] No HTTP/network endpoints are introduced or removed (none exist)

### Data & persistence

- [ ] No data persistence layer is introduced or removed (none exist)
- [ ] The program performs no file reads or writes

### UI / presentation

- [ ] No UI framework or components exist or are introduced (none exist)
- [ ] Output remains plain text on the console

### Testing & tooling

- [ ] `Greeter.Tests` unit tests (3) continue to pass after refactoring
- [ ] `hello.Tests` unit tests (2) continue to pass after refactoring
- [ ] `hello.Tests` integration tests (2, subprocess-based) continue to pass after refactoring
- [ ] xUnit / VSTest / Coverlet test stack and versions remain compatible
- [ ] Full suite (`dotnet test DevTeamTest1.slnx`) passes: 0 failed, 4 passed (plus the 3 Greeter.Tests)
- [ ] Project references are preserved: `hello` → `Greeter`, `hello.Tests` → `hello`, `Greeter.Tests` → `Greeter`
- [ ] Both application projects target `net10.0`

## Agent Development Environment & Container/Runtime

Audit of the environment the developer agents run in today (task #116,
parent #102). Investigation and documentation only — no configuration
changes were made. All evidence below was gathered by running commands
directly inside the agent's container on 2026-11-23.

### Container / runtime

- **A Docker container is in use** (not a devcontainer). There is **no
  `.devcontainer.json`** anywhere in the repository (confirmed at repo
  root and under a `.devcontainer/` directory — neither exists), which
  matches the 404s observed via raw URLs. The agent environment is a
  plain **Docker image** built from the in-repo
  **`.devteam/Dockerfile`** ("Shared development environment for all
  developer agents"), added in commit `5fd886e` ("Set up the development
  environment (.devteam/Dockerfile)").
- **Base image:** `mcr.microsoft.com/dotnet/sdk:10.0` (official .NET SDK
  image, Ubuntu 24.04 "Noble" based — `DOTNET_VERSION=10.0.12`,
  `DOTNET_SDK_VERSION=10.0.401`, `POWERSHELL_DISTRIBUTION_CHANNEL=PSDocker-DotnetSDK-Ubuntu-24.04`).
- The Dockerfile installs only `ca-certificates`, `curl`, `git`,
  `tzdata` via apt and pre-warms the global NuGet cache
  (`Microsoft.NET.Test.Sdk 17.14.1`, `xunit 2.9.3`,
  `xunit.runner.visualstudio 3.1.4`, `coverlet.collector 6.0.4`).
- Container evidence at runtime: `DOTNET_RUNNING_IN_CONTAINER=true`,
  hostname `fe7197a843a0` (Docker container id), `/etc/resolv.conf`
  marked "Generated by Docker Engine", container IP `172.17.0.6` on the
  Docker bridge network (see `/etc/hosts`). No Docker daemon / socket is
  reachable from inside (`/var/run/docker.sock` absent, no `docker`
  binary).

### Provisioning / entrypoint

- **Repository mount:** the checkout is bind-mounted at
  `/workspace/repo`; `/workspace` is the container `WORKDIR` (per
  `.devteam/Dockerfile`) and also holds per-run scratch state:
  `.home` (`HOME`/`DOTNET_CLI_HOME`), `.nuget` (`NUGET_PACKAGES`),
  `.tmp` (`TMPDIR`). Nothing from the repo is copied into the image.
- **No custom entrypoint/CMD** is defined in the Dockerfile — the
  image runs with the .NET SDK base image's shell behavior; the
  orchestrator injects environment (including the mount, `HOME`,
  `TMPDIR`, `NUGET_PACKAGES`) and executes the agent's shell commands
  directly. No supervisor, init system, or provisioning script was
  found in the image or the repo.
- **User:** `ubuntu` (uid/gid 1000), i.e. the base image's non-root
  user (the Dockerfile sets no `USER`; per its comment, nothing in the
  repo is run as root).
- **Identity/credentials injected by the orchestrator (not the image):**
  `GH_TOKEN` (a `github_pat_…` fine-grained PAT) plus git credential
  helper env vars (`GIT_CONFIG_COUNT=1`, `GIT_CONFIG_KEY_0=credential.helper`
  using `x-access-token`), `GIT_AUTHOR_NAME=DevTeam Developer` /
  `GIT_AUTHOR_EMAIL=devteam@users.noreply.github.com` (and committer
  equivalents). Note: the PAT is visible in the container environment.
- **Repo remote:** `origin https://github.com/aluitink/DevTeamTest1.git`.

### Toolchain present vs. expected

| Tool | Present in container | Expected by repo | Status |
| --- | --- | --- | --- |
| .NET SDK | 10.0.401 (`dotnet --version`) | 10.0 / `net10.0` | ✅ matches |
| Node.js | **not installed** (`which node` → not found; no `node` binary anywhere under `/`) | README: **Node.js 20.x** (task requirement: ≥18.17) | ❌ **missing** |
| npm | **not installed** (no `npm` binary) | README: npm 10.x; CI uses `npm ci` | ❌ **missing** |
| pnpm | not installed | not referenced by the repo | n/a |
| yarn | not installed | not referenced by the repo | n/a |

- **Node version evidence:** `which node` and `which npm` both return
  "not found"; `find / -maxdepth 4 -name node -type f` finds no Node.js
  binary (only kernel entries under `/proc/irq`). **No Node.js runtime
  is available at all**, so no `node --version` output exists — the
  required ≥18.17 is currently *unmet in this container*. Any
  TypeScript work (`npm ci`, `npm run build`, `npm test`,
  `npm run type-check`) cannot be executed here today without installing
  Node (e.g. via `apt`, `nvm`, or adding it to `.devteam/Dockerfile`).
- `.NET` side is fully provisioned: `dotnet build` / `dotnet test` work
  out of the box (warm NuGet cache).

### Package manager expectations (repo side)

- **The repo expects npm:** root `package.json` uses npm workspaces
  (`src/lib/validation`, `src/api-responses`) with `npm run` scripts;
  the committed lockfile is **`package-lock.json`**; CI
  (`.github/workflows/ci.yml`) runs `npm ci`/`npm install` with
  `actions/setup-node` (`node-version: 20`, `cache: 'npm'`).
- **No `.npmrc`** (repo or user) and **no `packageManager` field** in
  any `package.json`; **no `pnpm-lock.yaml` / `yarn.lock` / `bun.lockb`**
  anywhere. So npm is the unambiguous expected package manager.

### Network / egress

- **No egress restrictions observed.** At audit time, all of the
  following succeeded with HTTP 200/301: `https://registry.npmjs.org/`,
  `https://api.nuget.org/v3/index.json`, `https://raw.githubusercontent.com/`,
  `https://example.com`. No proxy environment variables
  (`http_proxy`/`https_proxy`/`no_proxy`) are set; DNS is standard
  (`1.1.1.1`, `8.8.8.8` via the Docker-generated `resolv.conf`);
  `/etc/hosts` contains only Docker defaults.
- Hermeticity aids that exist by design (to reduce reliance on
  egress): pre-warmed NuGet cache in the image, `DOTNET_CLI_TELEMETRY_OPTOUT=1`,
  `NUGET_XMLDOC_MODE=skip`. GitHub API access is additionally available
  via the injected `GH_TOKEN`.
- Caveat: egress was tested at one point in time; no allowlist evidence
  (e.g. proxy rules, firewalling) was found, but absence of restrictions
  was verified by probe, not by configuration.

### Findings / follow-ups

1. **Node.js/npm are missing from the agent container** even though the
   repo's modern stack (npm workspaces, `package-lock.json`, CI) requires
   Node ≥18.17 (README pins 20.x). This is the single biggest gap for
   doing TypeScript work in the agent environment and should be addressed
   (install Node into `.devteam/Dockerfile` or provision at run time).
2. There is no `.devcontainer.json`; the devcontainer feature (parent
   issue #102) would be net-new. The de-facto environment is the
   orchestrator-provisioned Docker image from `.devteam/Dockerfile`.
3. The `GH_TOKEN` fine-grained PAT is exposed as a plain environment
   variable visible to any process in the container; worth noting in
   future hardening reviews.
4. `NuGet.Config` sets `globalPackagesFolder` to
   `/workspace/nuget/packages`, while the runtime environment sets
   `NUGET_PACKAGES=/workspace/.nuget` (the Dockerfile default was
   `/tmp/.nuget`); the env var wins at runtime, so the in-repo path is
   currently unused. Minor inconsistency, documented for completeness.

## Docker / Container Definitions & Image References (Task #138)

Audit of every container definition and image reference in the repository
and its CI/CD configuration (task #138, parent #122). Full sweep of the
entire tree on `main` (HEAD `159f886`), all remote branches, and tags, for
Dockerfiles, docker-compose files, Containerfiles, Kaniko/Buildpacks/
`nix-docker` configs, `.devcontainer/` directories, inline/heredoc
Dockerfiles in shell scripts, and container directives in CI.

### Findings

**1. The in-repo dev-container definition: `.devteam/Dockerfile`**

- The development container is **defined in-repo** at the non-conventional
  path **`.devteam/Dockerfile`** (header comment: "Shared development
  environment for all developer agents"). Conventional paths — `Dockerfile`
  at root, `docker-compose.yml/.yaml`, `.docker/dev.Dockerfile`,
  `.devcontainer/`, `Containerfile` — do **not** exist on `main`.
- **Base image:** `mcr.microsoft.com/dotnet/sdk:10.0` (the only `FROM`
  line; upstream source is Microsoft's official .NET SDK image on the
  Microsoft Container Registry, `mcr.microsoft.com`).
- Content: installs `ca-certificates`, `curl`, `git`, `tzdata` via apt;
  sets `DOTNET_NOLOGO`, `DOTNET_CLI_TELEMETRY_OPTOUT`,
  `DOTNET_SKIP_FIRST_TIME_EXPERIENCE`, `NUGET_PACKAGES=/tmp/.nuget`,
  `NUGET_XMLDOC_MODE=skip`; pre-warms the NuGet cache with
  `Microsoft.NET.Test.Sdk 17.14.1`, `xunit 2.9.3`,
  `xunit.runner.visualstudio 3.1.4`, `coverlet.collector 6.0.4`;
  `WORKDIR /workspace`. No `USER`, no `ENTRYPOINT`/`CMD` — the repo is
  bind-mounted at runtime by the orchestrator and nothing is `COPY`'d in.
- The image is **never built by anything in the repo** and is not pushed to
  a registry; it is built by the external agent orchestrator from this
  Dockerfile (see the "Agent Development Environment" section above for
  runtime evidence: `DOTNET_RUNNING_IN_CONTAINER=true`, repo mounted at
  `/workspace/repo`, orchestrator-injected `GH_TOKEN`/git identity).
- Branches: present and **byte-identical** on `main`,
  `origin/feature/21-set-up-the-development-environment-devte`,
  `origin/feature/116-audit-current-agent-dev-environment-cont`, and
  `origin/feature/107-create-the-container-smoke-test-verifica`.
  Introduced in commit `34e2eb3` / `5fd886e` ("Set up the development
  environment (.devteam/Dockerfile) (#21)"). No other branch, tag, or
  commit anywhere in the repo's history adds or modifies a Dockerfile.

**2. Reference from a smoke-test script: `scripts/devcontainer-verify.sh`**

- Builds and runs the container for a non-interactive smoke test
  (created in #107). It looks for `.devcontainer/devcontainer.json`
  first, **falls back to `.devteam/Dockerfile`** (which is what exists),
  then runs `npm ci` + the root `build`, `test`, `lint`, `type-check`
  scripts inside the container via `docker` or `podman`.
- Creates a **local-only, ephemeral image tag**
  `devteamtest1-devcontainer-verify:<epoch-seconds>` (with label
  `devteamtest1.verify=smoke-test`); this tag is never pushed or referenced
  anywhere else. No other image tags appear in the script.
- Referenced only by the script itself; it is **not wired into any CI
  job**.

**3. CI/CD configuration: `.github/workflows/ci.yml`**

- The only CI file in the repo. **No container references of any kind**:
  no `docker build`/`docker pull`/`docker run`, no image tags/digests,
  no `container:` directives, no job-level `image:` fields. The single
  `build` job uses the GitHub-hosted runner
  (`runs-on: ubuntu-latest`) plus `actions/checkout@v4` and
  `actions/setup-node@v4` (`node-version: 20`, `cache: 'npm'`).
- No other CI/CD systems are present: no `.gitlab-ci.yml`, `Jenkinsfile`,
  `azure-pipelines.yml`, `buildkite.yml`, `.circleci/`, `bitbucket-pipelines.yml`.

**4. Documentation references (no definitions, no additional tags)**

- `README.md` (§Environment variables): points to `.devteam/Dockerfile` as
  the "shared development image" and documents the agent env vars
  (`NUGET_PACKAGES=/workspace/nuget/packages` etc. — runtime value, differs
  from the Dockerfile default `/tmp/.nuget`; documented in the #116
  findings above).
- `docs/audit.md` (§Agent Development Environment & Container/Runtime,
  task #116): runtime evidence of the Docker container and the
  `mcr.microsoft.com/dotnet/sdk:10.0` base image.
- `.env.example`: documents the same agent env vars; no image tags.

**5. Negative results (searched and not found, all branches)**

- No `Dockerfile`/`*.Dockerfile`/`Containerfile` anywhere except
  `.devteam/Dockerfile`; no `docker-compose*.yml/.yaml`; no
  `.devcontainer/` directory or `devcontainer.json`; no Kaniko, Buildpacks,
  or `nix-docker` configs; no inline/heredoc `docker build` Dockerfiles in
  shell scripts (the only shell script is `scripts/devcontainer-verify.sh`,
  which references the file-based Dockerfile); no `scripts/`, `infra/`,
  `deploy/`, or `.ci/` directories; no registry pushes (`docker push`),
  no pinned digests, and no externally-pulled image tags in CI.
- No tags exist in the repo (no container definitions hide on tags).
- No Node image or any other registry reference beyond the single
  `mcr.microsoft.com/dotnet/sdk:10.0` base image.

### Summary table

| # | Path | Kind | Image tag / digest | Referenced by | Branches |
| --- | --- | --- | --- | --- | --- |
| 1 | `.devteam/Dockerfile` | Dockerfile (in-repo dev-container definition) | base: `mcr.microsoft.com/dotnet/sdk:10.0`; the built image itself has no in-repo tag (built by the external agent orchestrator) | orchestrator (not in-repo); `scripts/devcontainer-verify.sh` fallback; `README.md`; `docs/audit.md` | `main` + 3 feature branches (identical) |
| 2 | `scripts/devcontainer-verify.sh` | shell script building/running the container | local ephemeral tag `devteamtest1-devcontainer-verify:<epoch>` (never pushed) | the script itself (manual smoke test; not in CI) | `main` + `feature/107-*` branch |
| 3 | `.github/workflows/ci.yml` | GitHub Actions CI | none (no container/image references; GitHub-hosted runner) | CI (push/PR to `main`) | `main` |

Conclusion: the development container **is** defined in this repository, at
the non-standard path `.devteam/Dockerfile` (base image
`mcr.microsoft.com/dotnet/sdk:10.0`). It is not built or consumed by any
in-repo CI; the in-repo consumers are the manual smoke-test script
`scripts/devcontainer-verify.sh` (local-only image tag) and documentation.
No externally-pulled, pre-published dev image tag is referenced anywhere —
the image is always built from this Dockerfile by the external orchestrator.

## Dev Tools & System Dependencies for the Four Root Scripts (Task #118)

Enumeration of the exact dev tools and system dependencies the four root
`package.json` scripts — `build`, `test`, `lint`, `type-check` — require
inside the container (task #118, parent #102). Investigation and
documentation only — no configuration changes were made. Cross-checked
against the #116 container findings (§"Agent Development Environment &
Container/Runtime") and #131 (`docs/inventory-container-config-ci-wiring.md`),
with a fresh probe of this agent container on 2026-11-23 (all "status" notes
below re-verified by direct command execution, not just cited from #116).

### The four root scripts (verbatim from root `package.json`)

| # | Script | Command | What it executes |
| --- | --- | --- | --- |
| 1 | `build` | `npm run build --workspaces --if-present` | `tsc -p tsconfig.json` in `src/lib/validation` and `src/api-responses` (emits `dist/`) |
| 2 | `test` | `npm run test --workspaces --if-present` | `vitest run` in `src/lib/validation` and `src/api-responses` |
| 3 | `lint` | `eslint .` | ESLint 8.57.1 (flat config `eslint.config.mjs`, extends `next/core-web-vitals` via `@eslint/eslintrc` FlatCompat) from the repo root |
| 4 | `type-check` | `tsc --noEmit` | TypeScript 5.7.x type-check from the root `tsconfig.json` (extends `tsconfig.base.json`, includes `src/**/*`) |

**Workspace scope note:** `src/app/items` has its own `package.json` but is
**not** listed in the root `workspaces` array, so `--workspaces --if-present`
does not reach it. Its build/test/lint/typecheck scripts are not executed by
any of the four root scripts. Its source is, however, reached by `type-check`
(3) and `lint` (4) because both scan from the repo root (`tsconfig.json`
includes `src/**/*`; `eslint .` lints everything outside the `ignores`
list). So `src/app/items` requires **TypeScript + React types at type-check
time** and **ESLint + the Next.js lint plugin at lint time**, even though its
own `build`/`test` scripts never run.

All four scripts assume dependencies are already installed with
**`npm ci`** (root `package-lock.json`, lockfileVersion 3; npm is the
canonical manager per task #111 / `docs/package-manager-decision.md` and
CONTRIBUTING.md). Install is a precondition, not one of the four scripts.

### Dev tools required (JavaScript/Node toolchain)

All are resolved from the repo-root `node_modules` after `npm ci` (single
hoisted install across root + 2 workspaces):

| Tool | Pinned/declared version (lockfile unless noted) | Required by script(s) | Where declared |
| --- | --- | --- | --- |
| Node.js | **20.x** (README prerequisite table; CI `actions/setup-node` `node-version: 20`). Hard floor: **≥ 18.0** (Vitest 2.x); no `engines` or `packageManager` field in any `package.json` to pin it | all four (npm, tsc, eslint, and vitest are all Node CLIs) | README; `.github/workflows/ci.yml` |
| npm | **10.x** (ships with Node 20) | all four (script runner; `npm run … --workspaces` needs npm workspace support, npm ≥ 7) | README; CI |
| TypeScript compiler (`tsc`) | 5.7.3 (root); workspaces declare ^5.7.2 | `build`, `type-check` | root + each workspace `devDependencies` |
| Vitest | 2.1.9 (declared ^2.1.8) | `test` | workspace `devDependencies` |
| esbuild (Vitest/vite transitive) | 0.21.5, **prebuilt platform binaries only** (e.g. `@esbuild/linux-x64`) | `test` (JS transformation) | `package-lock.json` transitive |
| ESLint | 8.57.1 (declared ^8.57.1) | `lint` | root `devDependencies` |
| `@eslint/eslintrc` | ^3.3.7 | `lint` (FlatCompat in `eslint.config.mjs`) | root `devDependencies` |
| `eslint-config-next` | ^14.2.15 (pulls the `eslint-plugin-*` rules it ships) | `lint` (config extended in `eslint.config.mjs`) | root `devDependencies` |
| `next` | 14.2.15 (exact) | `lint` only (config import). **Not** needed at runtime by any of the four scripts — `src/app/items` tests/build alias/mock `next` locally; the root `build`/`test` workspaces don't import it | root `devDependencies` |
| `react`, `react-dom` | 18.3.1 (exact) | **types only** at `type-check`/`build` time (via `@types/react`, `@types/react-dom`, for `src/app/items/**/*.tsx`); not loaded at runtime by the four scripts | root `devDependencies` |
| `@types/node` | root ^20.19.43; workspaces ^20.17.10 | `build`, `type-check` (Node type definitions; `"types": ["node"]` in every tsconfig) | root + workspace `devDependencies` |
| `@types/react`, `@types/react-dom` | ^18.3.12 / ^18.3.1 | `type-check` (and `build` of `src/app/items` if it were ever a workspace) — JSX type-checking for `src/app/items/src/**/*.tsx` | root `devDependencies` |
| `zod` | ^3.24.1 (dep of both workspaces) | runtime import by code type-checked/tested by `build`, `type-check`, `test` | workspace `dependencies` |

No other JS tooling is invoked: no prettier, no bundler (the "build" is bare
`tsc`), no Next.js CLI (`next build` is never run), no codegen.

### System / OS dependencies required inside the container

| Dependency | Required by | Notes |
| --- | --- | --- |
| **POSIX shell (`bash`)** + standard coreutils (`mktemp`, `tar`, …) | npm itself, all four scripts | npm launches scripts via `sh`/`bash`; the smoke-test script explicitly uses `bash -lc` |
| **libc + a C toolchain capable of running prebuilt native binaries** | `test` (esbuild), transitively everything Node | All native deps in this tree (`esbuild`, `fsevents`) ship **prebuilt platform binaries**; no source compilation of native modules is triggered by `npm ci`. A C/C++ compiler (`gcc`/`make`) is needed **only** if a package fell back to building from source, which none do today. `fsevents` is macOS-only and its install is skipped on Linux |
| **Node.js ≥ 18 (20.x expected) + npm 10.x** | all four | see table above |
| **git** | none of the four directly | Required by the repo workflow around them: `npm ci` does not call git (lockfile only), but `scripts/devcontainer-verify.sh` (which drives the four scripts) requires `git archive` on the host, and the orchestrator's clone/commit does. Installed in `.devteam/Dockerfile` |
| **egress to `https://registry.npmjs.org`** | install only (`npm ci`) | Not needed by the four scripts once `node_modules` exists. #116 verified no egress restrictions in the container |
| **Sufficient CPU/RAM** | `test` | Vitest is configured conservatively (`pool: "forks"`, `singleFork: true` in both workspaces) specifically so it runs in constrained sandbox/CI environments; container here: 24 CPUs, 62 GB RAM (no constraint in practice) |
| **`.NET SDK`, NuGet** | **none of the four** | The four root scripts are pure-JS; the .NET stack is a separate dependency tree exercised by `dotnet build`/`dotnet test`, not by any npm script |

### Per-script requirement matrix

| Requirement | build | test | lint | type-check |
| --- | :-: | :-: | :-: | :-: |
| Node.js 20.x runtime (≥ 18 floor) | ✅ | ✅ | ✅ | ✅ |
| npm (script runner / workspaces) | ✅ | ✅ | ✅ | ✅ |
| `node_modules` installed via `npm ci` | ✅ | ✅ | ✅ | ✅ |
| TypeScript (`tsc` 5.7.3) | ✅ | — | — | ✅ |
| Vitest 2.1.9 (+ esbuild 0.21.5 prebuilt binaries) | — | ✅ | — | — |
| ESLint 8.57.1 + `@eslint/eslintrc` + `eslint-config-next` (14.2.15) | — | — | ✅ | — |
| `@types/node`, `@types/react`, `@types/react-dom` | ✅ | — | — | ✅ |
| `react` / `react-dom` / `next` (type-check & lint config only) | partial¹ | — | ✅ | ✅ |
| `zod` (runtime of tested/type-checked code) | partial¹ | ✅ | — | partial¹ |
| bash / coreutils | ✅ | ✅ | ✅ | ✅ |
| C compiler toolchain (`gcc`/`make`) | ⚠️ not needed² | ⚠️ not needed² | ⚠️ not needed² | ⚠️ not needed² |
| git | — | — | — | — |
| network egress | — (post-install) | — (post-install) | — (post-install) | — (post-install) |

¹ The root `build`/`type-check` compile the two workspaces only; `zod` and
React types matter to them only insofar as the workspace source imports
them (`src/app/items` — which imports both — is outside the workspaces and
outside the root `build`'s per-project scope, but *is* inside the root
`type-check`'s `src/**/*` glob, so **type-check** genuinely needs
`@types/react(-dom)`; React/next values are never *executed* by any of the
four scripts).

² Required only as a fallback if `npm ci` ever needed to compile a native
module from source; no package in the current lockfile does that on
linux-x64.

### Cross-check against container findings (task #116) — what is unmet

Re-probed in this agent container (2026-11-23): `which node` → not found,
`which npm` → not found, no `node`/`npm` binary anywhere,
`node_modules/` not present (install never ran); `git 2.43.0` present;
`gcc`/`g++`/`make`/`python3` all **not** installed (only needed as a
fallback — see note ² — so their absence is harmless); `.NET SDK 10.0.401`
present but irrelevant to these four scripts.

| Requirement (from tables above) | In container? | Status vs. #116 findings |
| --- | --- | --- |
| Node.js 20.x (≥18) | **no** — no Node runtime at all | ❌ **UNMET** (identical to #116 finding #1: "Node.js/npm are missing from the agent container") |
| npm 10.x | **no** — no npm binary | ❌ **UNMET** (same gap) |
| `node_modules` (post `npm ci`) | **no** — directory absent | ❌ UNMET, direct consequence of the npm gap |
| `tsc`, Vitest, ESLint, esbuild binaries, React/Next/zod packages | no (all in `node_modules`) | ❌ UNMET, direct consequence of the npm gap |
| bash + coreutils | **yes** (Ubuntu 24.04 base) | ✅ met |
| git | **yes** (2.43.0, installed by `.devteam/Dockerfile`) | ✅ met |
| C toolchain (`gcc`/`make`) | no | ✅ not required (prebuilt native binaries only; see note ²) |
| Egress to registry.npmjs.org | **yes** (no proxy/firewall found) | ✅ met — install would work if npm existed |
| CPU/RAM for Vitest | 24 CPUs / 62 GB | ✅ met (Vitest's single-fork config removes thread pressure regardless) |
| `.NET SDK` (needed by the four scripts) | not required | n/a — the four scripts are JS-only |

**Bottom line:** every one of the four root scripts is currently **unable to
run in the agent container**. The single blocking requirement is **Node.js
20.x + npm 10.x** (which also pulls in, via `npm ci`, `tsc`, Vitest, ESLint,
esbuild prebuilt binaries, and the type packages). Nothing else is missing:
the OS-level dependencies (bash/coreutils, prebuilt-binary execution, egress,
git) are all satisfied, and no compiler toolchain is required. This matches
#116 finding #1 and #131 §1 ("Toolchain gap") exactly — both prior audits
flagged the same Node/npm absence, and this task adds the per-script
enumeration confirming that the four scripts' *entire* unmet dependency
surface reduces to that one gap. Fix options noted there still stand: add
Node to `.devteam/Dockerfile` or provision at run time;
`scripts/devcontainer-verify.sh` would exercise all four scripts end-to-end
once Node is present (its host-side `docker`/`podman` requirement is a
host tool, not a container dependency).
