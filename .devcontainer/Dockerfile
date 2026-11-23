# Dev container for DevTeamTest1 (VS Code Dev Containers + scripts/devcontainer-verify.sh).
#
# Stack (per .github/workflows/ci.yml, DEVCONTAINER_NOTES.md, docs/package-manager-decision.md):
#   * Node.js 20.x LTS (current 20.19+ release — CI pins `node-version: 20` and the
#     strictest transitive `engines` range is `^20.19.0 || ^22.13.0 || >=24`) with
#     npm 10.x (the canonical package manager; `package-lock.json` is committed).
#   * .NET SDK 10.0 (net10.0 solutions `DevTeamTest1.slnx` / `hello.slnx`).
#   * git, ca-certificates, curl, tzdata — same set as .devteam/Dockerfile (CI parity).
#   * build-essential + python3 — not strictly required today (no active node-gyp
#     packages; esbuild uses prebuilt binaries on linux-x64) but included as cheap
#     insurance for future native modules / esbuild fallback builds, per the
#     #125 analysis (DEVCONTAINER_NOTES.md, "Native modules" section).
#
# Build context: the `.devcontainer/` directory (the verify script builds with
# `--file .devcontainer/devcontainer.json --context .devcontainer`), so this
# Dockerfile must not COPY anything from the repository root.
#
# All apt installs are non-interactive (DEBIAN_FRONTEND=noninteractive) so the
# container builds cleanly in CI without a TTY.

# ---- Base layer 1: Node 20.x LTS (Debian bookworm-slim) ---------------------
FROM node:20.19-bookworm-slim AS node-base

# ---- Base layer 2: .NET SDK 10.0 (Ubuntu noble, non-root user "dotnet") -----
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS dotnet-base

FROM dotnet-base

ARG DEBIAN_FRONTEND=noninteractive

# Install the Node.js 20.x LTS toolchain (node + npm 10.x) from the official
# nodejs.org image. Pinned to 20.19+ so the container matches CI
# (`actions/setup-node@v4`, `node-version: 20`) and stays inside the strictest
# transitive `engines` range (`^20.19.0 || ^22.13.0 || >=24`).
#
# The `node:` image ships `npm` as a symlink into /usr/local/lib/node_modules,
# so the whole npm package tree is copied (not the symlink); `corepack` is
# deliberately dropped because npm is the only supported package manager for
# this repo (docs/package-manager-decision.md).
COPY --from=node-base /usr/local/bin/node /usr/local/bin/
COPY --from=node-base /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/npm
RUN rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
    && ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
    && ln -s /usr/local/lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx \
    && node --version \
    && npm --version

# System tooling:
#   - ca-certificates, curl, git, tzdata: parity with .devteam/Dockerfile
#     (source control + CI parity, network access, general tooling);
#   - build-essential + python3: native build toolchain (insurance for
#     node-gyp packages / esbuild source builds; see DEVCONTAINER_NOTES.md).
# All flags are non-interactive.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        --allow-unauthenticated \
        ca-certificates \
        curl \
        git \
        tzdata \
        build-essential \
        python3 \
    && rm -rf /var/lib/apt/lists/*

# Keep agent runs quiet and hermetic (no first-run experience, no telemetry),
# matching .devteam/Dockerfile and .env.example.
ENV DOTNET_NOLOGO=1 \
    DOTNET_CLI_TELEMETRY_OPTOUT=1 \
    DOTNET_SKIP_FIRST_TIME_EXPERIENCE=1 \
    NUGET_PACKAGES=/tmp/.nuget \
    NUGET_XMLDOC_MODE=skip

# Pre-warm the global NuGet cache with the exact package versions the
# solution restores (plus the SDK's own tooling packages), so agent builds are
# fast and work even with limited network access (parity with .devteam/Dockerfile).
RUN mkdir -p /tmp/warm && cd /tmp/warm \
    && dotnet new console -n warm -o warm --framework net10.0 \
    && cd warm \
    && dotnet add package Microsoft.NET.Test.Sdk --version 17.14.1 \
    && dotnet add package xunit --version 2.9.3 \
    && dotnet add package xunit.runner.visualstudio --version 3.1.4 \
    && dotnet add package coverlet.collector --version 6.0.4 \
    && dotnet restore \
    && cd / \
    && rm -rf /tmp/warm

# The repository (monorepo root: npm workspaces under src/, .NET solutions at
# the root) is mounted at /workspace by the devcontainer tooling.
WORKDIR /workspace
