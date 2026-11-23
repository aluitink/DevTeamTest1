# Devcontainer / Toolchain Notes

Analysis of the repository configuration to determine what the devcontainer
needs (task #125, parent #106). This file is the summary deliverable: node
version, package manager + version, workspace layout, native modules,
required system packages, and the canonical install/build/test/lint/
type-check commands.

## Node version

| Source | Value |
| --- | --- |
| `.nvmrc` | **does not exist** in the repo |
| `engines` field | **not declared** in the root `package.json` or in any workspace `package.json` |
| `.github/workflows/ci.yml` | `actions/setup-node@v4` with `node-version: 20` — the authoritative, enforced version |
| `README.md` (Prerequisites) | Node.js **20.x** |

**Conclusion: Node.js 20.x LTS** (e.g. 20.19+). This satisfies the
"20.x or 22.x LTS" requirement — Node 20 is in the maintenance-LTS phase
(22.x is active LTS and also acceptable). CI is the single source of truth;
the devcontainer should pin Node 20.x to match. The strongest `engines`
range found in the dependency tree (e.g. `@types/node`-related tooling) is
`^20.19.0 || ^22.13.0 || >=24`, so 20.x must be a current 20.19+ release.

## Package manager + version

| Source | Value |
| --- | --- |
| `packageManager` field | **not declared** in the root `package.json` |
| Lockfiles | **`package-lock.json`** (npm, `lockfileVersion: 3`) — the only lockfile present (no `pnpm-lock.yaml`, no `yarn.lock`) |
| CI | runs `npm ci` (falling back to `npm install`) with npm caching enabled |
| `README.md` | npm **10.x** (ships with Node 20) |

**Conclusion: npm (10.x, as bundled with Node 20.x)** — no corepack /
`packageManager` pin is in place; `npm ci` against the committed
`package-lock.json` is the canonical install path.

## Workspace structure (npm workspaces)

The root `package.json` (`devteamtest1`, private, `type: module`) declares:

```json
"workspaces": [
  "src/lib/validation",
  "src/api-responses"
]
```

So the npm workspace set is **root + the two sub-workspaces**:

| Name | Path | Role |
| --- | --- | --- |
| (root) `devteamtest1` | `.` | Workspace root; holds shared dev tooling (typescript, eslint) and fan-out scripts |
| `@devteamtest1/validation` | `src/lib/validation/` | Centralized Zod schemas (`zod` is its only runtime dep) |
| `api-responses` | `src/api-responses/` | Response formatting / error handling utilities (`zod` runtime dep) |

Notes:

- `src/app/items/` (`@devteamtest1/app-items`) **is not a member of the
  npm workspaces** even though it has its own `package.json`. It is an
  independent package (it does not even appear in `package-lock.json`). Its
  only runtime dependency is the workspace package `@devteamtest1/validation`
  (via `"*"`, resolved from the root `node_modules`), and it declares
  `next` / `react` / `react-dom` as *optional peer dependencies* — no
  Next.js app runs in the repo, it is a reference Server Component
  implementation. Its dev tools (vitest, typescript) are provided by the
  root-hoisted install, which is why it can run `vitest run` / `tsc` from
  the root `node_modules` without its own lockfile.
- The `next`, `react`, `react-dom` dev dependencies exist **at the root**
  `package.json` intentionally: `eslint-config-next` (used by
  `eslint.config.mjs`) needs them at the root, and `src/app/items`
  type-checks/tests against those root-hoisted modules. They are not used
  by any runnable Next.js app.
- The .NET projects (`hello`, `Greeter`, `src/migration`, test projects,
  `tests/docs.Tests`) are **not** npm workspaces; they are managed by the
  two `.slnx` solutions (`DevTeamTest1.slnx`, `hello.slnx`) and NuGet.

## Native modules (install scripts / node-gyp)

`package-lock.json` contains exactly two `hasInstallScript` entries:

| Module | Why it has an install script | Build toolchain required? |
| --- | --- | --- |
| `esbuild@0.21.5` (dev, via `vitest`) | Postinstall verifies/downloads a platform-specific binary | **No C/C++ compile needed on supported platforms** — prebuilt binaries ship as optional dependencies (e.g. `@esbuild/linux-x64`). gcc/g++/make/python3 are only needed as a fallback if a prebuilt binary is unavailable. |
| `fsevents@2.3.3` (dev, optional, `os: darwin`) | macOS-only filesystem-watching helper | Not installed on Linux at all. |

**Conclusion: no true node-gyp/C++ native modules** (no `sharp`, `sqlite`,
better-sqlite3, etc.). `vitest` → `esbuild` is the only binary-bearing
dependency and uses prebuilt binaries on linux-x64. A C/C++ build
toolchain (gcc, g++, make, python3) is therefore **not strictly required**
for `npm ci` / `npm test` on linux-x64; it is only needed if a prebuilt
native package is added later or esbuild falls back to compiling from
source. Recommend installing `build-essential` + `python3` in the
devcontainer anyway, as cheap insurance.

## Required system packages (devcontainer)

| Package | Why |
| --- | --- |
| `nodejs` 20.x + `npm` 10.x | TypeScript workspaces (pinned by CI) |
| .NET SDK 10.0 (`net10.0`) | Console app, libraries, xUnit test projects (already the base of `.devteam/Dockerfile`) |
| `git` | Source control / CI parity |
| `ca-certificates`, `curl`, `tzdata` | Network access, general tooling (already in `.devteam/Dockerfile`) |
| `build-essential` (gcc, g++, make) + `python3` | **Recommended, not currently required** — no active node-gyp packages; future-proofing for native modules and esbuild fallback builds |

The existing `.devteam/Dockerfile` currently installs only the .NET-side
packages; it has **no Node.js** layer, so the TypeScript half of the repo
cannot be built/tested in it as-is.

## Canonical commands per workspace

All npm commands run from the **repository root** (workspaces are hoisted
there).

### Root (`devteamtest1`)

| Purpose | Command |
| --- | --- |
| Install (CI/clean) | `npm ci` |
| Install (ad hoc) | `npm install` |
| Build (fans out to workspaces) | `npm run build` → `npm run build --workspaces --if-present` |
| Test (fans out to workspaces) | `npm test` → `npm run test --workspaces --if-present` |
| Lint | `npm run lint` → `eslint .` (root `eslint.config.mjs`, `next/core-web-vitals`) |
| Type-check (whole tree) | `npm run type-check` → `tsc --noEmit` (root `tsconfig.json`, covers `src/**`) |

### `src/lib/validation` (`@devteamtest1/validation`)

| Purpose | Command |
| --- | --- |
| Build | `npm run build -w src/lib/validation` → `tsc -p tsconfig.json` |
| Test | `npm test -w src/lib/validation` → `vitest run` |
| Type-check | `npm run typecheck -w src/lib/validation` → `tsc -p tsconfig.json --noEmit` |
| Lint | covered by root `npm run lint` |

### `src/api-responses` (`api-responses`)

| Purpose | Command |
| --- | --- |
| Build | `npm run build -w src/api-responses` → `tsc -p tsconfig.json` |
| Test | `npm test -w src/api-responses` → `vitest run` |
| Type-check | `npm run typecheck -w src/api-responses` → `tsc -p tsconfig.json --noEmit` |
| Lint | covered by root `npm run lint` |

### `src/app/items` (`@devteamtest1/app-items`, **not** an npm workspace)

| Purpose | Command |
| --- | --- |
| Build | `npm run build --prefix src/app/items` → `tsc -p tsconfig.json && tsc -p tsconfig.react-server.json` |
| Test | `npm test --prefix src/app/items` → `vitest run` |
| Type-check | `npm run typecheck --prefix src/app/items` (and `typecheck:react-server`) → `tsc ... --noEmit` |
| Lint | covered by root `npm run lint` |

Note the script-name difference: the workspaces expose `typecheck` (no
hyphen) while the root exposes `type-check` (with hyphen) — both must be
used accordingly when scripting task validation.

### .NET side (for completeness)

| Purpose | Command |
| --- | --- |
| Build | `dotnet build DevTeamTest1.slnx` |
| Test | `dotnet test DevTeamTest1.slnx` |

## Full canonical CI-equivalent sequence

```bash
# Node 20.x + npm 10.x in the environment
npm ci                      # install all workspace dependencies
npm run lint                # eslint .
npm run type-check          # tsc --noEmit (root tsconfig)
npm run build               # tsc in src/lib/validation + src/api-responses
npm test                    # vitest in both workspaces
# optional, not workspace-linked:
npm test --prefix src/app/items
# .NET:
dotnet build DevTeamTest1.slnx
dotnet test DevTeamTest1.slnx
```
