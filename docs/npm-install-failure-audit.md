# Root-Cause Audit: `npm install` Failure in the Agent Environment

Task #117 (parent #102). Investigation + documentation only — **no code or
configuration changes were made** for this task. All evidence below was
captured by running commands directly inside the agent's container on
2026-11-23 (repo checkout at `/workspace/repo`, HEAD `5a2f64a`).

## TL;DR

**Primary root cause: the `node`/`npm` toolchain is not installed in the
agent container at all.** `npm install` never starts — the shell reports
`npm: command not found` and exits **127** (command not found) before any
npm step (resolution, lockfile check, fetching, extraction) can run. This is a
**missing package manager / missing runtime** problem caused by a **missing
container configuration** (`.devteam/Dockerfile` installs no Node.js), *not* a
network, DNS, lockfile, or Node-version problem.

## 1. Reproduction

Command executed in the agent container (repo root):

```console
$ npm install --no-audit --no-fund
bash: line N: npm: command not found
$ echo $?
127
```

- **Full log:** exactly one line — `npm: command not found` (no npm output at
  all; npm never ran).
- **Exit code:** `127` — the shell's "command not found" code, *not* an npm
  error code.
- **Failing step:** the very first step — locating and launching the `npm`
  executable. There is no subsequent failing npm step because npm never
  starts.

## 2. Concrete evidence

### 2.1 Missing binaries (`which` output)

```console
$ which node npm pnpm yarn git
/usr/bin/git
$ echo $?
1

node: NOT FOUND (exit 1)
npm:  NOT FOUND (exit 1)
pnpm: NOT FOUND (exit 1)
yarn: NOT FOUND (exit 1)
git:  /usr/bin/git   (git version 2.43.0)
curl: /usr/bin/curl
```

### 2.2 No Node.js runtime anywhere on disk

- `PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin`
- A bounded filesystem search for `node`/`npm` binaries across
  `/usr/bin /usr/local/bin /usr/lib /opt /snap /home /root /workspace/.home
  /workspace/.tmp` (and `/` at depth 4 per the #116 audit) found **no Node.js
  binary** (only kernel entries under `/proc`).
- `node -e 'x=1'` → `node: command not found` (exit 127) — confirms there is
  no Node runtime at any version, so "wrong Node version" is not even
  testable; there is simply no Node.

### 2.3 Container definition confirms the omission

`.devteam/Dockerfile` (the only Dockerfile in the repo; the image the
orchestrator builds for the agent environment) installs only:

```dockerfile
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        git \
        tzdata \
    && rm -rf /var/lib/apt/lists/*
```

i.e. `ca-certificates`, `curl`, `git`, `tzdata` — **no `nodejs`/`npm` apt
package, no Node tarball, no nvm, no Node base image**. Base image is
`mcr.microsoft.com/dotnet/sdk:10.0` (Ubuntu 24.04), which ships only the .NET
SDK, not Node.js. This matches the runtime observation: the image was
deliberately provisioned for .NET work only.

### 2.4 Network / DNS / proxy — ruled out as the cause

Egress is **healthy** at audit time, so "network egress blocked" and
"DNS failure" are **not** the cause:

```console
$ getent hosts registry.npmjs.org
2606:4700::6810:822 registry.npmjs.org   (plus 11 more A/AAAA records)  → exit 0
$ curl -sS -o /dev/null -w '%{http_code}' --max-time 15 https://registry.npmjs.org/
200
$ curl -sS -o /dev/null -w '%{http_code}' --max-time 15 https://api.nuget.org/v3/index.json
200
$ curl -sS -o /dev/null -w '%{http_code}' --max-time 15 https://example.com
200
```

- No proxy environment variables are set (`http_proxy`/`https_proxy`/
  `no_proxy` all empty).
- DNS resolves normally (Docker-generated `resolv.conf`, standard resolvers).
- Caveat: verified by probe at one point in time, same as the #116 audit.

### 2.5 Lockfile / package-manager / git-for-native-deps — ruled out

- **Lockfile exists:** `package-lock.json` (236,198 bytes, `lockfileVersion: 3`)
  is committed at the repo root. "Missing lockfile" is **not** a cause.
- **npm is the correct package manager:** root `package.json` uses npm
  workspaces (`src/lib/validation`, `src/api-responses`); CI
  (`.github/workflows/ci.yml`) uses `actions/setup-node` + `npm ci`; there is
  no `pnpm-lock.yaml`/`yarn.lock`/`bun.lockb` and no `packageManager` field.
  "pnpm-vs-npm confusion" is **not** a cause — and `pnpm`/`yarn` are not
  installed either, which is expected and irrelevant.
- **git is present** (`/usr/bin/git`, 2.43.0), so "missing git for native
  deps" is **not** a cause (this failure also never reaches dependency
  fetching).

### 2.6 Node version requirement (for completeness)

The repo expects **Node.js 20.x / ≥18.17** (README; CI `node-version: 20`;
`@types/node ^20`). The container has **no Node.js of any version**, so the
requirement is unmet in its strongest form. This is the same failure as the
missing runtime — not a separate "wrong version" issue.

## 3. Cause analysis (against the candidate list)

| Candidate cause | Verdict | Evidence |
| --- | --- | --- |
| Missing package manager (Node/npm not installed) | ✅ **PRIMARY** | `which node`/`which npm` → not found; no Node binary on disk; `npm install` → exit 127 before any npm step |
| Missing container config | ✅ **Root of the primary cause** | `.devteam/Dockerfile` installs only `ca-certificates curl git tzdata`; no Node in the `mcr.microsoft.com/dotnet/sdk:10.0` base |
| Network restriction | ❌ ruled out | `registry.npmjs.org` → HTTP 200, DNS resolves, no proxy vars |
| DNS failure | ❌ ruled out | `getent hosts registry.npmjs.org` → exit 0 |
| Missing lockfile | ❌ ruled out | `package-lock.json` (lockfileVersion 3) committed at root |
| pnpm-vs-npm confusion | ❌ ruled out | Only npm referenced; `package-lock.json` only; npm is the canonical PM |
| Missing git for native deps | ❌ ruled out | `git` 2.43.0 present; failure predates any fetch |
| Wrong Node version | ❌ not applicable as a separate cause | There is no Node at all, so no version to be wrong about |

**Explicit statement of root cause:** the `npm install` failure is caused by
the **Node.js/npm toolchain being absent from the agent container**
(**missing package manager / missing runtime**), which in turn stems from the
**container configuration** (`.devteam/Dockerfile`) never installing Node.js.
It is a **missing-container-config → missing-package-manager combination**,
with the missing package manager being the directly observable primary
failure. Network, DNS, lockfile, pnpm-vs-npm, git, and Node-version causes are
all excluded by the evidence above.

## 4. Recommended fix (not applied in this task)

- Add Node.js 20.x + npm to `.devteam/Dockerfile` (e.g. NodeSource apt repo
  or `nvm`/official tarball pinned to 20.x), so `which node`/`which npm`
  resolve and `npm ci` (preferred, lockfile present) can run.
- After Node is present, use `npm ci` (CI/lockfile-consistent) rather than
  `npm install` for reproducible installs.
