# Shared development environment for all developer agents.
#
# #130 hardening of the dev image (parent #123):
#   - Node.js LTS 20.x (Node 20 is maintenance-LTS and satisfies the
#     "LTS >= 18.17 (20.x/22.x)" requirement; CI in .github/workflows/ci.yml
#     pins node-version 20, so the dev image matches CI).
#   - The reconciled package manager (npm — docs/package-manager-decision.md,
#     #111) enabled via corepack.
#   - TypeScript / ESLint available as workspace-root devDependencies.
#   - System build dependencies for future node-gyp packages (build-essential,
#     python3, pkg-config) plus the usual dev tooling.
#   - All npm workspace dependencies pre-baked (root, src/lib/validation,
#     src/api-responses) so /workspace/node_modules is fully populated in the
#     image even when the repo is bind-mounted over it at runtime.
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

FROM node:20-bookworm-slim

ARG DEBIAN_FRONTEND=noninteractive

# Minimal system tooling + build deps.
# build-essential / python3 / pkg-config are insurance for node-gyp builds
# (esbuild ships prebuilt binaries today; see DEVCONTAINER_NOTES.md).
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        build-essential \
        curl \
        git \
        pkg-config \
        python3 \
        tzdata \
    && rm -rf /var/lib/apt/lists/*

# Keep agent runs quiet and hermetic (no telemetry, no analytics).
ENV NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false

# npm is the canonical package manager for this repository
# (docs/package-manager-decision.md, #111). Enable it through corepack so the
# manager version can later be pinned with a `packageManager` field; today
# corepack simply exposes the npm bundled with Node 20.
RUN corepack enable \
    && corepack prepare npm@10 --activate

WORKDIR /workspace

# Pre-bake all workspace dependencies (root + src/lib/validation +
# src/api-responses) against the committed lockfile, so node_modules is fully
# populated and agents can build/test/lint offline. Only the manifest, the
# lockfile, and the two workspace manifests are copied in — the rest of the
# repo comes from the runtime bind mount at /workspace.
COPY package.json package-lock.json ./
COPY src/lib/validation/package.json src/lib/validation/package.json
COPY src/api-responses/package.json src/api-responses/package.json

RUN npm ci --no-audit --no-fund

# Verify the pre-baked toolchain actually works before the image is released.
RUN npx --no-install tsc --version \
    && npx --no-install eslint --version \
    && npx --no-install vitest --version

# Development-oriented defaults: the repo is bind-mounted at /workspace and
# agents work against it directly (source edits, npm scripts). The npm cache
# lives under /tmp so it survives a bind mount over /workspace and does not
# pollute the mounted repository.
ENV HOME=/tmp \
    npm_config_cache=/tmp/.npm
