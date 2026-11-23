# Shared development environment for all developer agents.
#
# #130 hardening of the dev image (parent #123):
#   - Node.js LTS 20.x base (Node 20 is maintenance-LTS and satisfies the
#     "LTS >= 18.17 (20.x/22.x)" requirement; CI in .github/workflows/ci.yml
#     pins node-version 20, so the dev image matches CI).
#   - The .NET 10 SDK is RETAINED (copied from mcr.microsoft.com/dotnet/sdk:10.0
#     via a second base stage): the repo still contains .NET projects
#     (DevTeamTest1.slnx, hello.slnx, tests/docs.Tests) and README.md /
#     CONTRIBUTING.md document `dotnet build` / `dotnet test` / `dotnet run`
#     as canonical commands, so removing .NET is NOT sanctioned by #130.
#   - The reconciled package manager (npm — docs/package-manager-decision.md,
#     #111) enabled via corepack, with the exact version pinned in the
#     package.json `packageManager` field (npm@10.8.2) so the baked
#     node_modules is fully reproducible instead of floating on `npm@10`.
#   - TypeScript / ESLint / Vitest available as workspace-root devDependencies.
#   - System build dependencies for future node-gyp packages (build-essential,
#     python3, pkg-config) plus the usual dev tooling (git, curl, tzdata).
#   - All npm workspace dependencies pre-baked (root, src/lib/validation,
#     src/api-responses) so /workspace/node_modules is fully populated in the
#     image even when the repo is bind-mounted over it at runtime.
#   - NuGet cache pre-warmed with the exact package versions the solution
#     restores, so agent .NET builds are fast even with limited network access.
#
# The repository is mounted at /workspace at runtime and the container runs as
# a non-root user with HOME=/tmp, so nothing from the repo is copied in and no
# USER is set here. Development workflow:
#   - source changes go to the bind-mounted volume;
#   - the pre-baked node_modules already satisfies the committed lockfile;
#     re-run `npm ci` (which reinstalls from the cache) only when
#     package.json / package-lock.json changes;
#   - canonical commands (run from /workspace):
#       npm run lint
#       npm run type-check
#       npm run build
#       npm test
#       dotnet build DevTeamTest1.slnx
#       dotnet test DevTeamTest1.slnx
#       dotnet run --project hello

# Stage "dotnet-sdk" exists only as a copy source for the .NET 10 SDK.
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS dotnet-sdk

# Final image: Node LTS 20.x (Debian Bookworm slim) + the .NET 10 SDK copied
# in from the official .NET image above.
FROM node:20-bookworm-slim

ARG DEBIAN_FRONTEND=noninteractive

# Minimal system tooling + build deps.
# build-essential / python3 / pkg-config are insurance for node-gyp builds
# (esbuild ships prebuilt binaries today; see DEVCONTAINER_NOTES.md).
# libicu-dev is required because the Debian slim images ship only the
# "small" ICU dataset and the .NET 10 runtime links against libicu.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        build-essential \
        curl \
        git \
        libicu-dev \
        pkg-config \
        python3 \
        tzdata \
    && rm -rf /var/lib/apt/lists/*

# .NET 10 SDK (retained from the pre-#130 dev image; see header). The SDK is
# self-contained under /usr/share/dotnet; recreate the standard /usr/bin
# symlink so `dotnet` is on PATH, and smoke-test it at build time.
COPY --from=dotnet-sdk /usr/share/dotnet /usr/share/dotnet
RUN ln -sf /usr/share/dotnet/dotnet /usr/bin/dotnet \
    && dotnet --version

# Keep agent runs quiet and hermetic (no telemetry, no analytics, no .NET
# first-run experience/logo, no npm update/fund/audit noise).
ENV NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false \
    DOTNET_NOLOGO=1 \
    DOTNET_CLI_TELEMETRY_OPTOUT=1 \
    DOTNET_SKIP_FIRST_TIME_EXPERIENCE=1 \
    NUGET_PACKAGES=/tmp/.nuget \
    NUGET_XMLDOC_MODE=skip

WORKDIR /workspace

# npm is the canonical package manager for this repository
# (docs/package-manager-decision.md, #111). Enable it through corepack and pin
# the EXACT version via the `packageManager` field in the committed
# package.json (npm@10.8.2 — the npm 10.x line that Node 20 LTS ships; pinning
# the full semver rather than a bare `npm@10` makes the baked node_modules
# fully reproducible).
COPY package.json package-lock.json ./
COPY src/lib/validation/package.json src/lib/validation/package.json
COPY src/api-responses/package.json src/api-responses/package.json

RUN corepack enable \
    && corepack prepare npm@10.8.2 --activate \
    && npm --version

# Pre-bake all workspace dependencies (root + src/lib/validation +
# src/api-responses) against the committed lockfile, so node_modules is fully
# populated and agents can build/test/lint offline. Only the manifests and
# the lockfile are copied in — the rest of the repo comes from the runtime
# bind mount at /workspace.
RUN npm ci --no-audit --no-fund

# Verify the pre-baked toolchain actually works before the image is released.
RUN npx --no-install tsc --version \
    && npx --no-install eslint --version \
    && npx --no-install vitest --version

# Pre-warm the global NuGet cache with the exact package versions the
# solution restores, so agent .NET builds are fast and work even with limited
# network access. Versions match the PackageReference entries in
# Greeter.Tests, hello.Tests, and src/migration.Tests.
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

# Development-oriented defaults: the repo is bind-mounted at /workspace and
# agents work against it directly (source edits, npm/dotnet scripts). The npm
# cache lives under /tmp so it survives a bind mount over /workspace and does
# not pollute the mounted repository.
ENV HOME=/tmp \
    npm_config_cache=/tmp/.npm
