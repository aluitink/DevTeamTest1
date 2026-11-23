# Task #131 — Inventory: Container Config & CI Wiring Points

Investigation-only note (no code/config changes). Inputs gathered before
writing code for the parent effort (#124). Evidence gathered from the
checked-out repository at `/workspace/repo` (branch
`feature/131-inventory-container-config-ci-wiring-poi`) and by probing the
agent container directly. Related prior work: #116 audit
(`docs/audit.md`, "Agent Development Environment & Container/Runtime"
section) and the #60 CI test/build commit (`172e132`).

## 1. Dev container definition

| Item | Value |
| --- | --- |
| Definition | **`.devteam/Dockerfile`** (single, in-repo Dockerfile; "Shared development environment for all developer agents") |
| `devcontainer.json` | **None.** No `devcontainer.json` at repo root and **no `.devcontainer/` directory at all** (directory does not exist — confirmed by direct listing and recursive `find`). The environment is a plain Docker image, not a VS Code devcontainer. |
| `docker-compose` / `Composefile` | **None** anywhere in the repo. |
| Base image | `mcr.microsoft.com/dotnet/sdk:10.0` (.NET 10 LTS, Ubuntu 24.04 "Noble"; runtime shows `DOTNET_SDK_VERSION=10.0.401`) |
| OS packages installed | `ca-certificates`, `curl`, `git`, `tzdata` (apt, `--no-install-recommends`, noninteractive) |
| Env vars baked in | `DOTNET_NOLOGO=1`, `DOTNET_CLI_TELEMETRY_OPTOUT=1`, `DOTNET_SKIP_FIRST_TIME_EXPERIENCE=1`, `NUGET_PACKAGES=/tmp/.nuget`, `NUGET_XMLDOC_MODE=skip` |
| NuGet cache pre-warm | Builds a throwaway `net10.0` console project in `/tmp/warm` with `Microsoft.NET.Test.Sdk 17.14.1`, `xunit 2.9.3`, `xunit.runner.visualstudio 3.1.4`, `coverlet.collector 6.0.4`, then deletes it. |
| `WORKDIR` | `/workspace` |
| **Entrypoint / CMD** | **None defined.** The image relies on the .NET SDK base image's default (interactive shell); no `ENTRYPOINT`/`CMD`/`USER` instructions. The orchestrator bind-mounts the repo at `/workspace/repo` and runs agent shell commands directly. |
| `USER` | Not set; runtime user is `ubuntu` (uid/gid 1000, the base image's non-root user). |

### Runtime overrides (orchestrator, not the image)

- Repo bind-mounted at `/workspace/repo`; `WORKDIR=/workspace`.
- `HOME=/workspace/.home`, `DOTNET_CLI_HOME=/workspace/.home`,
  `TMPDIR=/workspace/.tmp`, **`NUGET_PACKAGES=/workspace/.nuget`** (this
  env var overrides the Dockerfile's `/tmp/.nuget` at runtime).
- `GH_TOKEN` (fine-grained PAT) + git credential-helper env vars injected
  (see #116 audit, §"Provisioning / entrypoint").
- **Toolchain gap (from #116, still true now — re-verified in this
  container):** `dotnet` 10.0.401 present; **`node` and `npm` are not
  installed** (`which node`/`which npm` → not found), even though the
  modern stack needs Node 20.x / npm 10.x. Any TypeScript work must add
  Node to `.devteam/Dockerfile` (or provision at run time) first.

## 2. The four root scripts

There are **no shell scripts (`.sh`/`.ps1`/`.bat`) or Makefiles at the
repository root** — the only executable "scripts" in the repo are the
**npm workspace scripts in root `package.json`**. The four scripts
(referenced by README, CONTRIBUTING, and CI) are:

| # | Script | Invocation | Flags / behavior |
| --- | --- | --- | --- |
| 1 | `build` | `npm run build` | Runs `npm run build --workspaces --if-present` — `tsc` in each workspace with `--if-present`; must succeed with `strict: true` (CONTRIBUTING rule). |
| 2 | `test` | `npm test` (≡ `npm run test`) | Runs `npm run test --workspaces --if-present` — Vitest suites in each workspace. |
| 3 | `lint` | `npm run lint` | Runs `eslint .` from the repo root (flat config: `eslint.config.mjs`). |
| 4 | `type-check` | `npm run type-check` | Runs `tsc --noEmit` from the repo root (root `tsconfig.json` extends `tsconfig.base.json`). |

Workspaces covered: `src/lib/validation`, `src/api-responses`
(root `package.json` `workspaces`). `src/app/items` has its own
`package.json` but is **not** in the workspace list, so its scripts are
not reached by `--workspaces --if-present` today (worth noting if CI/test
coverage of that project matters). Dependency install is `npm ci`
(committed `package-lock.json`; npm is the canonical package manager per
#111 / `docs/package-manager-decision.md`).

The .NET equivalents invoked directly (not npm scripts, but the README's
"four" build/run/test commands): `dotnet build DevTeamTest1.slnx`,
`dotnet test DevTeamTest1.slnx`, `dotnet run --project hello [-- <name>]`.
A fuller solution `hello.slnx` also exists (incl. Greeter & migration
projects).

## 3. CI system & file paths

- **System:** GitHub Actions.
- **Only workflow file:** `.github/workflows/ci.yml` (workflow name `CI`).
  No other workflow files, no `.github/actions`, no reusable workflows.
- **Triggers:** `on: push` to `main` and `on: pull_request` (all PRs).
  **No `paths`/path filters** today, and no `concurrency` group.
- **Runner:** `ubuntu-latest`.

### Job structure (single job, linear steps)

```yaml
jobs:
  build:                      # name: "Checkout, setup Node.js and install dependencies"
    runs-on: ubuntu-latest
    steps:
      1. actions/checkout@v4
      2. actions/setup-node@v4  (node-version: 20, cache: 'npm')
      3. npm ci (falls back to npm install; skips if no package.json)
      4. Lint          -> npm run lint
      5. Type check    -> npm run type-check
      6. Run unit tests (Vitest) -> npm run test        # added by #60
      7. Build         -> npm run build                 # added by #60
```

History: skeleton created by #58 (`94f1995`), lint/type-check added by #59
(`532b4fd`), test/build steps added by #60 (`172e132`).

## 4. #60 ("CI test/build task") — what's extended vs. must be added

Issue #60 was delivered in commit **`172e132`** ("Configure Test and Build
Steps in CI (#60)"), which appended exactly two steps to the existing
single `build` job — no new job, no new workflow, no trigger changes:

```yaml
      - name: Run unit tests (Vitest)
        run: npm run test

      - name: Build
        run: npm run build
```

(i.e. "Run unit tests (Vitest)" **before** "Build", after "Type check";
its companion commit `096980f` only added the initial `package-lock.json`.)

**Implications for extension:**
- **Can be extended:** the `build` job's `steps:` list in
  `.github/workflows/ci.yml` — new steps (e.g. a `dotnet build` /
  `dotnet test` step using the baked-in .NET SDK) slot in after step 3 and
  before/after the npm steps; `actions/setup-node` and the cache stay as-is.
- **Must be added:**
  - **Path filters** — currently absent; to gate the job on container/CI
    config changes you must add `on: pull_request: paths:` /
    `on: push: paths:` (see §5).
  - A **separate job** (e.g. `dotnet-test` or `container`) if the .NET
    side should run in parallel/independently — nothing .NET-specific
    exists in CI at all today (`dotnet build`/`dotnet test` are **not**
    run by CI, despite the .NET solution and warm NuGet cache in the image).
  - Node.js in the dev image (`.devteam/Dockerfile`) if the container is
    expected to mirror CI (currently missing `node`/`npm`).

## 5. Where container-config change detection can hook (path filters)

The only container-config file is `.devteam/Dockerfile`. In
`.github/workflows/ci.yml` a GitHub Actions `paths` filter on the
`on:` trigger is the hook point:

```yaml
on:
  pull_request:
    paths:
      - ".devteam/**"          # dev container definition(s)
      - ".github/workflows/ci.yml"   # the pipeline itself
      # add more as new container files appear (e.g. a future
      # .devcontainer/** or docker-compose file — neither exists today)
```

Notes:
- `.github/workflows/**` should be included so pipeline edits re-trigger
  the pipeline (otherwise a change to `ci.yml` would not be validated).
- If detection should instead gate a *dedicated container job* (e.g.
  "build the dev image to validate the Dockerfile"), the `paths` filter
  belongs on that new job's trigger context via `on: ... paths:` plus a
  second workflow, or a `dorny/paths-filter` style step, since a single
  `paths:` list gates the whole workflow rather than per-job.
- Runtime env overrides (e.g. the `NUGET_PACKAGES` mismatch between the
  Dockerfile `/tmp/.nuget` and orchestrator `/workspace/.nuget`) are not
  in-repo, so path filters cannot catch them — document in
  `docs/audit.md` follow-ups instead.

## 6. Quick-reference map

| Input | Location / value |
| --- | --- |
| Container definition | `.devteam/Dockerfile` (base `mcr.microsoft.com/dotnet/sdk:10.0`) |
| `devcontainer.json` / `.devcontainer/` | **Absent** (no file, no directory) |
| Entrypoint / CMD | **None** — base image shell; orchestrator mounts repo at `/workspace/repo`, `WORKDIR=/workspace` |
| Four root scripts | `package.json`: `build`, `test`, `lint`, `type-check` (invoked as `npm run build` / `npm test` / `npm run lint` / `npm run type-check`) |
| CI system | GitHub Actions |
| CI file(s) | `.github/workflows/ci.yml` (single file, single `build` job, `ubuntu-latest`) |
| #60 job structure | Steps 6–7 appended to existing `build` job: `npm run test` then `npm run build` (commit `172e132`) |
| Container-config hook | `on: pull_request: paths: [".devteam/**", ".github/workflows/**"]` in `ci.yml` |
| Gaps to address | Node/npm missing from dev image; no .NET build/test in CI; no path filters; `src/app/items` not in npm workspaces; `NUGET_PACKAGES` path mismatch (Dockerfile vs. runtime vs. `NuGet.Config`) |
