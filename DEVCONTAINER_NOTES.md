# Devcontainer / Toolchain Notes

Analysis of the repository configuration to determine what the devcontainer
needs (task #125, parent #106). This file is the summary deliverable: node
version, package manager + version, workspace layout, native modules,
required system packages, and the canonical install/build/test/lint/
type-check commands.

> **Verification status.** Every claim below was re-checked against the
> actual repository files (see the [Verification log](#verification-log) at
> the end, which maps each claim to the exact file / line that was read).
> Where a claim was originally attributed loosely, it has been corrected in
> place and the correction is flagged.

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
the devcontainer should pin Node 20.x to match. The strictest `engines`
range found in the resolved dependency tree (declared by
`eslint-visitor-keys@5.0.1`, a transitive `@typescript-eslint` dependency in
`package-lock.json`) is `^20.19.0 || ^22.13.0 || >=24`, so a 20.x pin should
be a current 20.19+ release to stay within range.

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

## Verification log

Each claim above was confirmed by reading the listed file(s). Line numbers
are as of this analysis and are given to make re-verification mechanical.

| # | Claim | Verified in | Evidence |
| --- | --- | --- | --- |
| 1 | `.nvmrc` does not exist | repo root listing | `ls .nvmrc` → `No such file or directory` |
| 2 | No `engines` field in any of the four `package.json`s | `package.json`, `src/lib/validation/package.json`, `src/api-responses/package.json`, `src/app/items/package.json` | `grep '"engines"'` across all four returns nothing |
| 3 | No `packageManager` field (no corepack pin) | same four `package.json`s | `grep '"packageManager"'` returns nothing |
| 4 | CI pins Node 20 via `actions/setup-node@v4`, `cache: 'npm'` | `.github/workflows/ci.yml` | lines 17–21 (`node-version: 20`, `cache: 'npm'`) |
| 5 | CI installs with `npm ci` (fallback `npm install`) | `.github/workflows/ci.yml` | lines 23–31 |
| 6 | CI enforces `npm run lint` then `npm run type-check` | `.github/workflows/ci.yml` | lines 33–37 |
| 7 | Root `workspaces` = `src/lib/validation` + `src/api-responses` only | `package.json` | lines 7–10 |
| 8 | `package-lock.json` is the only lockfile, `lockfileVersion: 3` | `package-lock.json`; absence of `pnpm-lock.yaml` / `yarn.lock` | head of file (line 4); `ls pnpm-lock.yaml yarn.lock` → both missing |
| 9 | `@devteamtest1/validation` name / `zod` runtime dep / `build`, `typecheck`, `test` scripts | `src/lib/validation/package.json` | lines 2, 30, 24–28 |
| 10 | `api-responses` name / `zod` runtime dep / `build`, `typecheck`, `test` scripts | `src/api-responses/package.json` | lines 2, 20, 10–13 |
| 11 | `@devteamtest1/app-items` is **not** in `workspaces`; dep `@devteamtest1/validation: *`; optional `next`/`react`/`react-dom` peer deps; `build` runs two `tsc` configs; `typecheck` + `typecheck:react-server` scripts | `src/app/items/package.json` | lines 2, 36–43, 31–34; absence from `package.json` `workspaces` and from `package-lock.json` (`grep` for `app-items` returns nothing) |
| 12 | Root `next`/`react`/`react-dom` + `eslint-config-next` are root devDependencies; root scripts `build`/`test`/`lint`/`type-check` | `package.json` | lines 11–16, 17–28 |
| 13 | Root eslint extends `next/core-web-vitals` | `eslint.config.mjs` | line 9 |
| 14 | Exactly two `hasInstallScript` packages: `esbuild@0.21.5` and `fsevents@2.3.3` | `package-lock.json` | `grep -c 'hasInstallScript'` → `2`; entries at lines 2969–2971 (`esbuild`, `version 0.21.5`) and 3636–3644 (`fsevents`, `optional: true`, `os: [darwin]`) |
| 15 | `esbuild` ships prebuilt binaries as optional platform deps (e.g. `@esbuild/linux-x64`) → no C/C++ compile on linux-x64 | `package-lock.json` | `@esbuild/{aix-arm64,android-arm,…,linux-x64,…}` optional-dep entries with per-platform `os`/`cpu` fields (entries start at line 31 and continue through the linux-* and win32-* blocks, with `@esbuild/linux-x64` at line 303); the linux-x64 entry carries only an optional-dep `os`/`cpu` gate, no `hasInstallScript` |
| 16 | No node-gyp/native packages (`sharp`, `sqlite`, `better-sqlite3`, `node-gyp`, `bcrypt`) anywhere in the tree | `package-lock.json` | `grep -iE 'node_modules/(sharp|sqlite|better-sqlite3|node-gyp|bcrypt)'` → no matches |
| 17 | Strictest `engines` range `^20.19.0 \|\| ^22.13.0 \|\| >=24` comes from `eslint-visitor-keys@5.0.1` (transitive) | `package-lock.json` | lines 1631–1639 (package name at 1632, `engines.node` at 1638) |
| 18 | `vitest@2.1.9` is the resolved test runner (dev, via workspaces) | `package-lock.json` | lines 6476–6477 |
| 19 | `.devteam/Dockerfile` is `mcr.microsoft.com/dotnet/sdk:10.0`, installs only `ca-certificates`, `curl`, `git`, `tzdata`; **no Node.js layer** | `.devteam/Dockerfile` | lines 8 and 13–19 |
| 20 | .NET projects are not npm workspaces; managed by `DevTeamTest1.slnx` / `hello.slnx` + NuGet | `DevTeamTest1.slnx`, `hello.slnx`, `NuGet.Config`; absence of any `*.csproj` reference in `package.json` | solution files present at repo root; `package.json` has no C# references |
| 21 | README documents Node 20.x + npm 10.x prerequisites and the `npm ci` / `npm run build` / `npm test` / `dotnet build DevTeamTest1.slnx` / `dotnet test DevTeamTest1.slnx` canonical commands | `README.md` | Prerequisites table (lines 38–42); Build (lines 81–94); Run the tests (lines 113–128) |

### Corrections made during verification

- **Node `engines` attribution (item 17).** An earlier draft of these notes
  described the `^20.19.0 || ^22.13.0 || >=24` range as coming from
  "`@types/node`-related tooling." The actual declaring package is
  `eslint-visitor-keys@5.0.1` (a transitive dependency of
  `@typescript-eslint`). The range itself was correct; the attribution was
  not. The Node-version conclusion (pin 20.19+) is unaffected.

All other claims verified as originally stated with no correction required.
