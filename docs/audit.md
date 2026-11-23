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
