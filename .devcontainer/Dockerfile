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

# ---- Base image: .NET SDK 10.0 (Ubuntu noble, ships as non-root "dotnet") ----
# Node.js is installed from the official NodeSource 20.x LTS apt repository,
# which provides native Ubuntu noble packages. This keeps the whole container
# on a single distro/toolchain (no cross-distro binary mixing) while pinning
# Node 20.x LTS to match CI (`actions/setup-node@v4`, `node-version: 20`) and
# the strictest transitive `engines` range (`^20.19.0 || ^22.13.0 || >=24`).
#
# The container keeps the dotnet SDK image's default non-root `dotnet` user.
# devcontainer.json sets `remoteUser: "root"` with a documented reason: the
# host bind-mounts the repository (usually uid 1000) onto /workspace, and a
# uid-mismatch between the host user and the `dotnet` user can make writes
# under /workspace (obj/, bin/, node_modules/) fail with EACCES on some
# machines. devcontainer.json additionally normalizes ownership in
# postCreateCommand so every host user works out of the box.
FROM mcr.microsoft.com/dotnet/sdk:10.0

ARG DEBIAN_FRONTEND=noninteractive

# Install the Node.js 20.x LTS toolchain (node + npm 10.x, as packaged by
# NodeSource for Ubuntu noble) plus system tooling:
#   - ca-certificates, curl, git, tzdata: parity with .devteam/Dockerfile
#     (source control + CI parity, network access, general tooling);
#   - gnupg: one-shot use to fetch and sign the NodeSource repository keyring;
#   - build-essential + python3: native build toolchain (insurance for
#     node-gyp packages / esbuild source builds; see DEVCONTAINER_NOTES.md).
# All flags are non-interactive; the NodeSource setup script is run with
# DEBIAN_FRONTEND=noninteractive (no tzdata prompt).
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        git \
        tzdata \
        build-essential \
        python3 \
        gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/* \
    && node --version \
    && npm --version \
    && dotnet --version

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
# NUGET_PACKAGES is intentionally /tmp/.nuget here AND in devcontainer.json, so
# the pre-warmed cache is reused at runtime (the verify script's env-file
# override in CI also points at /workspace/nuget/packages, which is fine for
# the smoke test).
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
