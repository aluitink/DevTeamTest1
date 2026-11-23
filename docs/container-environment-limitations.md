# Task #139 — Container Environment Limitations (parent #122)

Investigation-only note (no code/config changes). For each in-use container
identified in #138 (`docs/audit.md`, §"Docker / Container Definitions & Image
References (Task #138)") this section records the concrete environment
constraints, with every claim backed by a citation to a specific file + line
or by probe output run directly inside the container on **2026-11-23**.

## In-use containers (per #138)

| # | Container | How it is built/run |
| --- | --- | --- |
| A | **Agent dev container** — image built from `.devteam/Dockerfile` (the only in-repo Dockerfile) | Built by the external agent orchestrator (no in-repo build); repo bind-mounted at `/workspace/repo` |
| B | **Smoke-test container** — ephemeral image `devteamtest1-devcontainer-verify:<epoch>` | `scripts/devcontainer-verify.sh` step 1 (lines 153–186), run by CI job `devcontainer-verify` on GitHub-hosted runners |
| C | **CI runner (not a container)** — GitHub-hosted `ubuntu-latest` runner for job `build` | `.github/workflows/ci.yml` lines 9–37; no `container:` directive, no image references |

There is no other container surface: no `devcontainer.json`, no
`docker-compose`, no Kubernetes manifests, no other CI systems (negative
results in #138 §5).

---

## Container A — Agent dev container (`.devteam/Dockerfile`)

### A.1 Base image, Node.js version, pinning

| Item | Value | Evidence |
| --- | --- | --- |
| Base image | `mcr.microsoft.com/dotnet/sdk:10.0` — **floating tag, no digest pin** | `.devteam/Dockerfile` line 8 (`FROM mcr.microsoft.com/dotnet/sdk:10.0`) |
| OS in image | Ubuntu 24.04 "Noble" (`.5` at probe time) | `cat /etc/os-release` → `VERSION_ID="24.04"`, `PRETTY_NAME="Ubuntu 24.04.5 LTS"` (probe, 2026-11-23) |
| .NET SDK | 10.0.401; runtime `DOTNET_VERSION=10.0.12` | `dotnet --version` → `10.0.401`; `env` → `DOTNET_SDK_VERSION=10.0.401`, `DOTNET_VERSION=10.0.12` (probe) |
| Node.js version | **None — Node.js is not installed at all** | `command -v node` → not found; `find / -maxdepth 6 -name node` → no binary (probe, re-verified today; original audit `docs/audit.md` lines 288–295) |
| How the Node version would be set | **Not set by anything in the repo.** No `engines` field, no `packageManager` field in any `package.json` (grep over all `package.json` → zero hits, probe); no Node install step in the Dockerfile. The *expected* version (20.x) comes only from `README.md` line 43 ("Node.js \| 20.x") and CI's `node-version: 20` (`.github/workflows/ci.yml` line 20) — both outside the image. The image therefore carries **no Node version pin of any kind**; .NET is from the image (floating tag). | probes + cited lines |

### A.2 Package managers present

| Manager | In container | Evidence |
| --- | --- | --- |
| npm | **missing** | `command -v npm` → not found (probe); `docs/audit.md` line 284 |
| yarn / pnpm / bun | **missing** | `command -v` not found for each (probe) |
| .NET/NuGet CLI | present (10.0.401) — this is the only functional package system | `dotnet --version` (probe) |

Repo expectations for the *intended* stack: npm is canonical (`package.json`
workspaces, lines 7–10; committed `package-lock.json` `lockfileVersion 3`,
`package-lock.json` line 4; decision recorded in
`docs/package-manager-decision.md`). **Result: zero JS package managers exist
in the container, so no `package.json` script can run here today** (see #118
cross-check, `docs/audit.md` lines 556–591).

### A.3 Outbound network policy for package installs

- **Live egress, unrestricted (by probe):** `curl -s -o /dev/null -w %{http_code}`
  → `https://registry.npmjs.org/` **200**, `https://api.nuget.org/v3/index.json`
  **200** (probe, 2026-11-23).
- **No mirrors or proxies:** `env | grep -i proxy` → no `http_proxy`/`https_proxy`/`no_proxy`
  (probe); no internal Verdaccio/Artifactory reference anywhere in the repo
  (only sources are `nuget.org`, `NuGet.Config` line 7, and default
  `registry.npmjs.org` used by npm).
- **Offline-from-cache behavior:** **not in place.** The Dockerfile pre-warms
  only the **NuGet** cache (`.devteam/Dockerfile` lines 28–40: `Microsoft.NET.Test.Sdk
  17.14.1`, `xunit 2.9.3`, `xunit.runner.visualstudio 3.1.4`,
  `coverlet.collector 6.0.4`). Note the cache was built at *build time* into
  the image's default `NUGET_PACKAGES=/tmp/.nuget` (line 25); at **run time**
  the orchestrator overrides `NUGET_PACKAGES=/workspace/.nuget` (probe:
  `env` → `NUGET_PACKAGES=/workspace/.nuget`; that dir was empty at probe
  time), so the baked cache is not on the runtime path — first `dotnet restore`
  re-downloads. **There is no npm cache layer at all** (no `node_modules`,
  no `~/.npm` warm-up, no `npm ci --offline`).
- Hermeticity aids: `DOTNET_CLI_TELEMETRY_OPTOUT=1`, `NUGET_XMLDOC_MODE=skip`
  (`.devteam/Dockerfile` lines 22–26).
- Caveat (same as #116): egress verified by probe, not by firewall
  configuration evidence (`docs/audit.md` line 325).

### A.4 Missing system build tools (node-gyp prerequisites)

Probed directly (`command -v`) on 2026-11-23:

| Tool | Present | Needed? |
| --- | --- | --- |
| `make` | **missing** | node-gyp prerequisite |
| `g++` / `gcc` / `cc` | **all missing** | node-gyp prerequisite |
| `python3` | **missing** | node-gyp prerequisite |
| `pkg-config` | **missing** | needed by some native addons |
| `git` 2.43.0, `curl` 8.5.0 | present | installed by Dockerfile lines 13–19 |

Impact for this project's tree: **currently benign** — the lockfile's native
dependencies ship prebuilt binaries only (esbuild 0.21.5 `@esbuild/linux-x64`;
`fsevents` is macOS-only), so `npm ci` on linux-x64 triggers **no source
compilation** (analysis in #118, `docs/audit.md` lines 514–524 and footnote ²,
lines 552–554). The moment any package without a prebuilt binary is added,
`npm ci` will **fail** in this container because node-gyp has no
toolchain. The Dockerfile deliberately installs only
`ca-certificates curl git tzdata` (`--no-install-recommends`,
`.devteam/Dockerfile` lines 13–19) — no `build-essential`/`python3`.

### A.5 Resource limits (memory / CPU)

- **No limit is set anywhere in the repo:** no Docker daemon config
  (probe: `/etc/docker` absent, `/var/run/docker.sock` absent from inside),
  no compose/K8s file, no `--memory`/`--cpus` flag in
  `scripts/devcontainer-verify.sh` (the script's only flags are
  `--name/--interactive/-w`, lines 167–171, and `--quiet --pull --label --tag
  --file` for the build, lines 154–160).
- **Observed allocation at probe (2026-11-23):** `nproc` → **24 CPUs**;
  `free -g` → **62 GB** total RAM (≈23 GB available). This reflects the
  host/container cgroup ceiling as visible from inside, not a documented
  limit (consistent with #118's "24 CPUs, 62 GB RAM", `docs/audit.md`
  line 523).
- **The one explicit time limit in the repo:** CI job `devcontainer-verify`
  `timeout-minutes: 60` (`.github/workflows/ci.yml` line 42).

### A.6 How the image is built / pulled, auth, layer caching

- **Builder:** the external agent orchestrator — *not* any in-repo CI.
  Evidence it is a Docker container: `DOTNET_RUNNING_IN_CONTAINER=true`
  (probe env), Docker-generated `/etc/resolv.conf` (probe), hostname
  `7327d21dd3de` on bridge IP `172.17.0.6` (probe `/etc/hosts`); no
  `docker`/`podman` binary or socket inside, so the image cannot be rebuilt
  from within (`docs/audit.md` lines 250–252).
- **Pull:** the base image `mcr.microsoft.com/dotnet/sdk:10.0` is pulled by
  the orchestrator at image-build time; **no in-repo reference to any
  registry auth** (no `docker login`, no credentials in repo or CI; grep for
  `auth|token|secrets` in `ci.yml` and the verify script → no hits). MCR is
  public, so no auth is needed.
- **Layer caching:** **none configured in-repo.** The Dockerfile has two
  apt/restore layers (lines 13–19, 31–40) that benefit from the orchestrator's
  default build-cache, but there is no BuildKit cache mount, no `--cache-from`,
  no registry push of the built image, and no digest pin — rebuild behavior
  depends entirely on orchestrator settings that are not visible from the repo.
  Runtime hermeticity relies on the (misaligned) baked NuGet cache, see A.3.

---

## Container B — Smoke-test container (`scripts/devcontainer-verify.sh`)

| Item | Value | Evidence |
| --- | --- | --- |
| Image | `devteamtest1-devcontainer-verify:$(date +%s)`, label `devteamtest1.verify=smoke-test`; **local-only, never pushed** | script lines 104, 154–160; `docs/audit.md` lines 395–398 |
| Base image / Node / package managers | **Identical to Container A** (same `.devteam/Dockerfile`): Ubuntu 24.04, .NET 10.0.401, **no Node/npm** | script line 71–73 (uses `.devteam/Dockerfile`); therefore the script's own `npm ci` (line 193) and all four `npm run …` steps (line 200) **cannot pass until Node is added to the Dockerfile** — the script is effectively a failing gate today for the JS stack |
| Engine & build step | `docker` (fallback `podman`) on the host; `docker build --quiet --pull --label --tag --file <config> <context>` | script lines 80–87, 153–164 |
| Network policy | Default bridge egress, unrestricted; `npm ci` in-container relies on live egress to `registry.npmjs.org` with **no mirror, no proxy, no offline cache** | script line 193; A.3 applies to the same base image |
| Build tools | Same missing set as A (`make`/`gcc`/`g++`/`python3`/`pkg-config`) | same Dockerfile; A.4 |
| Resource limits | **None set** — `docker create` uses only `--name`, `--interactive`, `-w /workspace`; no `--memory`/`--cpus`; no compose/K8s limits | script lines 167–171 |
| Build/pull, auth, layer caching | CI job `devcontainer-verify` (`.github/workflows/ci.yml` lines 39–77) on `ubuntu-latest` hosts `docker build` (script line 154); `--pull` (line 156) re-checks the base image against MCR (public, **no auth configured or needed**; no token/secrets in the workflow — grep → no hits); the CI step performs a **full fresh build from a `git archive` of HEAD** (script lines 92–98) with **no `--cache-from`/BuildKit cache** — layer cache is whatever the GitHub runner's local Docker daemon provides by default | cited lines |
| Gating | Runs on every push to `main` (line 4 push trigger; `if: github.event_name != 'pull_request'` at line 74) and on PRs only when `.devcontainer/**`, `.devteam/**`, `package-lock.json` or `package.json` changed (path-gate, lines 51–71); job timeout 60 min (line 42) | cited lines |

---

## Container C — CI runner for the `build` job (GitHub-hosted, not an image)

| Item | Value | Evidence |
| --- | --- | --- |
| "Base image" | GitHub-hosted `ubuntu-latest` runner image (Microsoft-managed; version floats with GitHub's runner fleet — **not pinned in the repo**) | `.github/workflows/ci.yml` line 12 (`runs-on: ubuntu-latest`) |
| Node.js | **Installed at CI run time by `actions/setup-node@v4` with `node-version: 20`** — i.e. the Node version is *pinned by the workflow input* (major-20 line), not baked into any image and not installed by the project | lines 17–21 (`uses: actions/setup-node@v4`, `node-version: 20`, `cache: 'npm'`) |
| Package managers | npm (the version shipped with Node 20, i.e. npm 10.x); no yarn/pnpm/bun set up | lines 23–31 (`npm ci` with `npm install` fallback) |
| Network policy | Full egress from the runner; `npm ci` installs straight from the default `registry.npmjs.org` — **no mirror/proxy configured**, no `.npmrc` in the repo (confirmed #116, `docs/audit.md` line 306); layer cache = **Actions dependency cache** keyed by `package-lock.json` (`cache: 'npm'`, line 21) — this is the only configured install cache in the whole repo | cited lines |
| Build tools | The runner image ships `gcc`/`g++`/`make`/`python3` (standard GitHub runner image), so node-gyp fallback *would* work in CI even though it doesn't in Container A — the two environments are **not equivalent** | GitHub-hosted runner image (not in-repo; contrast with A.4) |
| Resource limits | None set in the workflow (no `resources` block, no `timeout-minutes` on this job); GitHub's default runner shape (ubuntu-latest: 4 vCPU / 16 GB) applies | `.github/workflows/ci.yml` lines 9–37 (no limit fields present) |
| Build/pull, auth, caching | The job never builds or pulls an image (no `container:`, no `docker build`); the only remote pulls are the action checkouts and the npm dependency cache restore. No `secrets` are referenced by the file (grep → no hits) | `.github/workflows/ci.yml` (whole file, 77 lines) |

---

## Cross-cutting findings

1. **The single blocking limitation in the agent container (A) and the
   smoke-test container (B) is the complete absence of Node.js + npm** —
   three prior audits agree (#116 `docs/audit.md` lines 329–333; #131
   `docs/inventory-container-config-ci-wiring.md` lines 34–38; #118
   `docs/audit.md` lines 556–591). Every npm script, and therefore the
   smoke-test script's steps 2–5, fail until Node 20 is added to
   `.devteam/Dockerfile` or provisioned at run time.
2. **The base image tag is unpinned** (`:10.0`, `.devteam/Dockerfile` line 8),
   so both A and B silently track upstream .NET 10 point releases; no digest
   pin exists anywhere in the repo (#138 §5: "no pinned digests").
3. **The baked NuGet cache is misaligned with the runtime cache path**
   (image: `/tmp/.nuget`, Dockerfile line 25; runtime:
   `/workspace/.nuget`, probe; `NuGet.Config` line 4 says
   `/workspace/nuget/packages`) — the "works even with limited network
   access" promise (Dockerfile line 30) does not hold at run time; the
   runtime cache was empty at probe time. There is **no npm cache layer** in
   the image at all; only the CI runner has an install cache (Actions npm
   cache, `ci.yml` line 21).
4. **No container anywhere is configured with CPU/memory limits** (no compose,
   no K8s, no `--memory`/`--cpus` in the verify script); the only explicit
   limit in the repo is the 60-minute CI job timeout (`ci.yml` line 42).
   Observed ceiling in the agent container: 24 CPUs / 62 GB (probe).
5. **The no-network / offline scenario is unsupported** for package installs
   in every in-repo container: no registry mirrors/proxies, no `--offline`
   installs, no npm cache image layer; egress to both registries was verified
   live (HTTP 200) with no proxy variables set.
6. **node-gyp prerequisites (`make`, `gcc`/`g++`, `python3`, `pkg-config`) are
   all absent** from the dev/smoke-test image; this is harmless today (prebuilt
   native binaries only — #118 footnote ²) but any new source-built native
   dependency would break `npm ci` in containers A and B while still working
   in CI (C).
7. **Image build ownership is outside the repo:** A is built by an opaque
   orchestrator (no auth, no digest, no visible cache config — all that is
   known is the runtime evidence in `docs/audit.md` lines 247–252); B is built
   by the `devcontainer-verify` CI job with `--pull` against public MCR and no
   layer-cache configuration. Nothing in the repo pins, signs, or caches
   either image.
