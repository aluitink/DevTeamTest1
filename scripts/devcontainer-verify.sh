#!/usr/bin/env bash
# =============================================================================
# scripts/devcontainer-verify.sh
#
# Container smoke-test verification for the DevTeamTest1 dev container.
#
# What it does (fully non-interactive, no TTY required):
#   1. Container creation : builds/starts a fresh container from the shared
#                           dev-container configuration (`.devteam/Dockerfile`;
#                           use `.devcontainer/devcontainer.json` if present)
#                           in a clean, non-interactive checkout.
#   2. Install            : runs the package-manager install (`npm ci` with a
#                           `npm install` fallback) inside the container.
#   3. Root scripts       : runs the four root package.json scripts in order:
#                           `build`, `test`, `lint`, `type-check`.
#   4. Environment        : every in-container step runs with the agent
#                           environment variables listed below (per the audit
#                           findings, see .env.example / .devteam/Dockerfile).
#   5. Exit code & messaging: exits 0 only if every step exits 0; otherwise
#                           prints `ERROR: ...` naming the exact step/script
#                           that failed and exits with that step's code.
#
# Agent environment variables (exported and passed into the container for the
# install step and every script step, matching .devteam/Dockerfile and
# .env.example):
#   DOTNET_NOLOGO=1                          — suppress the .NET logo banner
#   DOTNET_CLI_TELEMETRY_OPTOUT=1            — opt out of .NET CLI telemetry
#   DOTNET_SKIP_FIRST_TIME_EXPERIENCE=1      — skip .NET first-run prompts
#   NUGET_PACKAGES=/workspace/nuget/packages — global NuGet package cache
#   NUGET_XMLDOC_MODE=skip                   — skip XML doc generation
#   GREETING_DEFAULT_NAME=World              — default greeting subject
#   CI=1                                     — mark runs as non-interactive
#
# Usage:
#   scripts/devcontainer-verify.sh
#
# The script requires `docker` (or `podman`) on the host. It works from any
# working directory; the repository root is derived from the script location.
# =============================================================================

set -u -o pipefail

# --- Locate the repository root (script lives in <repo>/scripts/) ------------
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." >/dev/null 2>&1 && pwd)"
cd -- "${REPO_ROOT}" || { echo "ERROR: could not enter repo root '${REPO_ROOT}'"; exit 1; }

# --- Agent environment variables (documented above) --------------------------
AGENT_ENV_VARS=(
  "DOTNET_NOLOGO=1"
  "DOTNET_CLI_TELEMETRY_OPTOUT=1"
  "DOTNET_SKIP_FIRST_TIME_EXPERIENCE=1"
  "NUGET_PACKAGES=/workspace/nuget/packages"
  "NUGET_XMLDOC_MODE=skip"
  "GREETING_DEFAULT_NAME=World"
  "CI=1"
)

# Export them in this script's environment as well, so any local (non-container)
# fallback behavior sees the same agent environment.
for kv in "${AGENT_ENV_VARS[@]}"; do
  export "${kv}"
done

# --- Locate the container configuration ---------------------------------------
# Prefer a VS Code devcontainer config when present, otherwise fall back to the
# shared dev image Dockerfile at the repository root.
if [ -f ".devcontainer/devcontainer.json" ]; then
  CONTAINER_CONFIG=".devcontainer/devcontainer.json"
  DOCKERFILE_CONTEXT="$(cd -- .devcontainer >/dev/null 2>&1 && pwd)"
elif [ -f ".devteam/Dockerfile" ]; then
  CONTAINER_CONFIG=".devteam/Dockerfile"
  DOCKERFILE_CONTEXT="${REPO_ROOT}"
else
  echo "ERROR: no container configuration found (expected .devcontainer/devcontainer.json or .devteam/Dockerfile)"
  exit 1
fi

# --- Choose a container engine -------------------------------------------------
if command -v docker >/dev/null 2>&1; then
  ENGINE=docker
elif command -v podman >/dev/null 2>&1; then
  ENGINE=podman
else
  echo "ERROR: neither 'docker' nor 'podman' found on PATH; cannot build/start the dev container"
  exit 1
fi

# --- Prepare a clean, non-interactive checkout ---------------------------------
# Work from a pristine copy of the working tree (git archive => no .git, no
# untracked files, no build output) so the smoke test verifies a clean checkout.
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  CLEAN_CHECKOUT="$(mktemp -d "${TMPDIR:-/tmp}/devcontainer-verify-checkout.XXXXXX")"
  if ! git archive --format=tar HEAD | tar -x -C "${CLEAN_CHECKOUT}"; then
    echo "ERROR: failed to create a clean checkout (git archive)"
    rm -rf -- "${CLEAN_CHECKOUT}"
    exit 1
  fi
else
  echo "ERROR: repo root '${REPO_ROOT}' is not a git working tree; cannot create a clean checkout"
  exit 1
fi

IMAGE_TAG="devteamtest1-devcontainer-verify:$(date +%s)"
CONTAINER_NAME="devcontainer-verify-$$"
CONTAINER_ID=""

cleanup() {
  local status=$?
  if [ -n "${CONTAINER_ID}" ] && command -v "${ENGINE}" >/dev/null 2>&1; then
    "${ENGINE}" rm -f -- "${CONTAINER_ID}" >/dev/null 2>&1 || true
  fi
  rm -rf -- "${CLEAN_CHECKOUT}" || true
  return ${status}
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# --- Helper: print an environment list for docker/podman --env-file -----------
env_file() {
  printf '%s\n' "${AGENT_ENV_VARS[@]}"
}

# --- Helper: run a command inside the container with the agent environment ----
# Prints an OK/ERROR line (naming $1) and exits the whole script with the
# command's exit code when the command fails.
run_in_container() {
  # $1 = human-readable step name; remaining args = command (argv)
  local step="$1"; shift
  env_file > "${CLEAN_CHECKOUT}/.verify-env"
  local status=0
  "${ENGINE}" exec \
    --env-file "${CLEAN_CHECKOUT}/.verify-env" \
    -w /workspace \
    "${CONTAINER_ID}" \
    "$@" || status=$?
  if [ "${status}" -ne 0 ]; then
    echo "ERROR: '${step}' exited with code ${status}"
    exit "${status}"
  fi
  echo "OK: '${step}' passed (exit code 0)"
}

fail() {
  echo "ERROR: $*"
  exit 1
}

# =============================================================================
# Step 1: Container creation — build a fresh image and start a fresh container.
# =============================================================================
echo "==> Step 1/5: building dev-container image '${IMAGE_TAG}' (config: ${CONTAINER_CONFIG})"
if ! "${ENGINE}" build \
    --quiet \
    --pull \
    --label devteamtest1.verify="smoke-test" \
    --tag "${IMAGE_TAG}" \
    --file "${REPO_ROOT}/${CONTAINER_CONFIG}" \
    "${DOCKERFILE_CONTEXT}" \
    > /dev/null; then
  echo "ERROR: 'container build' step failed (${ENGINE} build from ${CONTAINER_CONFIG})"
  exit 1
fi

echo "==> Step 1/5: starting fresh container '${CONTAINER_NAME}'"
CONTAINER_ID="$("${ENGINE}" create \
  --name "${CONTAINER_NAME}" \
  --interactive \
  -w /workspace \
  "${IMAGE_TAG}")" || fail "'container create' step failed (${ENGINE} create from ${IMAGE_TAG})"

echo "==> Step 1/5: copying clean checkout into the container"
if ! "${ENGINE}" cp "${CLEAN_CHECKOUT}/." "${CONTAINER_ID}:/workspace/"; then
  fail "'container copy' step failed (copying clean checkout into ${CONTAINER_ID}:/workspace)"
fi

env_file > "${CLEAN_CHECKOUT}/.verify-env"
if ! "${ENGINE}" cp "${CLEAN_CHECKOUT}/.verify-env" "${CONTAINER_ID}:/workspace/.verify-env"; then
  fail "'container copy' step failed (copying env file into ${CONTAINER_ID})"
fi

if ! "${ENGINE}" start "${CONTAINER_ID}" >/dev/null; then
  fail "'container start' step failed (${ENGINE} start ${CONTAINER_ID})"
fi
echo "OK: 'container creation' step passed (image ${IMAGE_TAG}, container ${CONTAINER_ID})"

# =============================================================================
# Step 2: Install — package-manager install inside the container (npm ci,
# falling back to npm install when there is no lockfile).
# =============================================================================
echo "==> Step 2/5: installing dependencies inside the container (npm ci / npm install)"
run_in_container "install" bash -lc 'if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi'

# =============================================================================
# Steps 3-5: Run the four root package.json scripts in order.
# =============================================================================
for script_name in build test lint type-check; do
  echo "==> Running root script: '${script_name}'"
  run_in_container "${script_name}" bash -lc "npm run ${script_name}"
done

# =============================================================================
# All steps passed.
# =============================================================================
echo "SUCCESS: dev-container smoke test passed (container creation, install, build, test, lint, type-check)"
exit 0
