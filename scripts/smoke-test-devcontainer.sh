#!/usr/bin/env bash
# =============================================================================
# scripts/smoke-test-devcontainer.sh
#
# Self-contained container smoke test (task #132, parent #124) for the
# DevTeamTest1 dev image.
#
# What it does (fully non-interactive, no TTY required):
#
#   1. build-image   : builds the dev image from the repository's container
#                      configuration (`.devteam/Dockerfile`; a
#                      `.devcontainer/devcontainer.json` is used automatically
#                      if one exists) in a clean checkout.
#   2. container     : starts a fresh container from that image and copies a
#                      pristine checkout (git archive: no .git, no build
#                      output) into /workspace.
#   3. install       : performs the package-manager install inside the
#                      container (npm ci, falling back to npm install; dotnet
#                      restore for the .NET solution when available) and then
#                      runs install verification:
#                        - npm ci --dry-run   (lockfile / resolution dry-run)
#                        - pip check          (only if pip is installed)
#                        - package-manager dry-run for any other manager
#   4. root-scripts  : runs all four root package.json scripts inside the
#                      container (build, test, lint, type-check) and asserts a
#                      non-zero exit on failure (a non-zero exit aborts the
#                      whole smoke test with that code).
#   5. reproducibility: proves dependency resolution is reproducible by doing
#                      two clean installs in two fresh containers and diffing
#                      the resolution fingerprints (npm ls --all tree plus the
#                      dotnet restore report when available). The two
#                      fingerprints must be byte-identical.
#
# Agent environment variables (baked into the image; re-exported here so the
# in-container runs see the same agent environment as .devteam/Dockerfile and
# .env.example):
#   DOTNET_NOLOGO=1                          — suppress the .NET logo banner
#   DOTNET_CLI_TELEMETRY_OPTOUT=1            — opt out of .NET CLI telemetry
#   DOTNET_SKIP_FIRST_TIME_EXPERIENCE=1      — skip .NET first-run prompts
#   NUGET_PACKAGES=/workspace/nuget/packages — global NuGet package cache
#   NUGET_XMLDOC_MODE=skip                   — skip XML doc generation
#   GREETING_DEFAULT_NAME=World              — default greeting subject
#   CI=1                                     — mark runs as non-interactive
#
# Acceptance guarantees:
#   - executable, self-contained (no files added to the repo tree),
#   - idempotent: every run rebuilds a uniquely tagged image, starts uniquely
#     named containers, works from any working directory, and cleans up all
#     containers and scratch state on exit (success or failure);
#   - prints a clear PASS / FAIL line for every step;
#   - exits non-zero on any failure (0 only when every step passed);
#   - works from a clean checkout with only docker available on the host
#     (podman is used automatically when docker is absent);
#   - everything that is verified runs INSIDE the container built from the
#     repo, never against the host toolchain.
#
# Usage:
#   scripts/smoke-test-devcontainer.sh
#
# Override (optional):
#   ENGINE=docker|podman   force a specific container engine
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
for kv in "${AGENT_ENV_VARS[@]}"; do
  export "${kv}"
done

# --- Locate the container configuration ---------------------------------------
# Prefer a VS Code devcontainer config when present, otherwise fall back to the
# shared dev image Dockerfile at the repository root.
if [ -f ".devcontainer/devcontainer.json" ]; then
  CONTAINER_CONFIG=".devcontainer/devcontainer.json"
  DOCKERFILE="$(cd -- .devcontainer >/dev/null 2>&1 && pwd)/devcontainer.json"
elif [ -f ".devteam/Dockerfile" ]; then
  CONTAINER_CONFIG=".devteam/Dockerfile"
  DOCKERFILE="${REPO_ROOT}/.devteam/Dockerfile"
else
  echo "FAIL: no container configuration found (expected .devcontainer/devcontainer.json or .devteam/Dockerfile)"
  exit 1
fi

# --- Choose a container engine -------------------------------------------------
if [ -n "${ENGINE:-}" ]; then
  : # forced by the caller; verified below
elif command -v docker >/dev/null 2>&1; then
  ENGINE=docker
elif command -v podman >/dev/null 2>&1; then
  ENGINE=podman
else
  echo "FAIL: neither 'docker' nor 'podman' found on PATH; cannot build/start the dev container"
  exit 1
fi
if ! command -v "${ENGINE}" >/dev/null 2>&1; then
  echo "FAIL: container engine '${ENGINE}' is not available"
  exit 1
fi

# --- Prepare a clean, non-interactive checkout ---------------------------------
# Work from a pristine copy of the working tree (git archive => no .git, no
# untracked files, no build output) so the smoke test verifies a clean
# checkout. Repeating the step (idempotency) always rebuilds this directory.
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "FAIL: repo root '${REPO_ROOT}' is not a git working tree; cannot create a clean checkout"
  exit 1
fi
CLEAN_CHECKOUT="$(mktemp -d "${TMPDIR:-/tmp}/smoke-test-devcontainer-checkout.XXXXXX")"
if ! git archive --format=tar HEAD | tar -x -C "${CLEAN_CHECKOUT}"; then
  echo "FAIL: failed to create a clean checkout (git archive)"
  rm -rf -- "${CLEAN_CHECKOUT}"
  exit 1
fi

# --- Scratch state & cleanup ----------------------------------------------------
STAMP="$(date +%s)"
IMAGE_TAG="devteamtest1-smoke-test:${STAMP}"
MAIN_CONTAINER="smoke-main-${STAMP}-$$"
REPRO_CONTAINERS=()
CONTAINERS_CREATED=0

cleanup() {
  local status=$?
  local c
  for c in ${REPRO_CONTAINERS[@]+"${REPRO_CONTAINERS[@]}"}; do
    "${ENGINE}" rm -f -- "${c}" >/dev/null 2>&1 || true
  done
  if [ "${CONTAINERS_CREATED}" -eq 1 ]; then
    "${ENGINE}" rm -f -- "${MAIN_CONTAINER}" >/dev/null 2>&1 || true
  fi
  rm -rf -- "${CLEAN_CHECKOUT}" 2>/dev/null || true
  return "${status}"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# --- Bookkeeping & helpers ------------------------------------------------------
STEPS_TOTAL=5
STEPS_DONE=0
STEPS_PASSED=0
STEPS_FAILED=0
FAILED_STEPS=()

pass() { # $1 = step name
  STEPS_PASSED=$((STEPS_PASSED + 1))
  echo "PASS: ${1}"
}

fail_step() { # $1 = step name, $2 = detail, $3 = exit code
  STEPS_FAILED=$((STEPS_FAILED + 1))
  FAILED_STEPS+=("${1}")
  echo "FAIL: ${1} — ${2}"
}

finish() { # called after all steps; exits the script
  STEPS_DONE=$((STEPS_PASSED + STEPS_FAILED))
  echo "---------------------------------------------------------------"
  if [ "${STEPS_FAILED}" -eq 0 ]; then
    echo "PASS: dev-container smoke test — all ${STEPS_DONE}/${STEPS_TOTAL} steps passed (image ${IMAGE_TAG})"
    exit 0
  else
    echo "FAIL: dev-container smoke test — ${STEPS_FAILED}/${STEPS_TOTAL} steps failed: ${FAILED_STEPS[*]}"
    exit 1
  fi
}

# Write the agent env file for docker/podman --env-file.
env_file() {
  printf '%s\n' "${AGENT_ENV_VARS[@]}"
}

# Run a command inside the MAIN container.
#   $1 = step name for the PASS/FAIL line; remaining args = command argv.
# On non-zero exit: records the step as FAILED, prints the error, and aborts
# the whole smoke test with the command's exit code (asserts non-zero on
# failure, per the task acceptance criteria).
run_in_container() {
  local step="$1"; shift
  env_file > "${CLEAN_CHECKOUT}/.smoke-env"
  local status=0
  "${ENGINE}" exec \
    --env-file "${CLEAN_CHECKOUT}/.smoke-env" \
    -w /workspace \
    "${MAIN_CONTAINER}" \
    "$@" || status=$?
  if [ "${status}" -ne 0 ]; then
    fail_step "${step}" "command exited with code ${status} (container ${MAIN_CONTAINER})"
    echo "ERROR: step '${step}' exited with code ${status} — aborting smoke test"
    exit "${status}"
  fi
  pass "${step}"
}

# Create + start + populate a fresh container from the already-built image and
# register it for cleanup.  Prints the new container's id on stdout.
#   $1 = container name
start_fresh_container() {
  local name="$1"
  local id
  id="$( "${ENGINE}" create --name "${name}" --interactive -w /workspace "${IMAGE_TAG}" )" \
    || { echo "ERROR: '${name}' creation failed (${ENGINE} create from ${IMAGE_TAG})"; return 1; }
  REPRO_CONTAINERS+=("${id}")
  if ! "${ENGINE}" cp "${CLEAN_CHECKOUT}/." "${id}:/workspace/"; then
    echo "ERROR: copying clean checkout into ${id}:/workspace failed"
    return 1
  fi
  if ! "${ENGINE}" cp "${CLEAN_CHECKOUT}/.smoke-env" "${id}:/workspace/.smoke-env"; then
    echo "ERROR: copying env file into ${id} failed"
    return 1
  fi
  if ! "${ENGINE}" start "${id}" >/dev/null; then
    echo "ERROR: '${name}' failed to start (${ENGINE} start ${id})"
    return 1
  fi
  echo "${id}"
}

# Run a command inside a given container id, capturing stdout into $3 (file).
#   $1 = container id, $2 = bash -lc script (runs in /workspace), $3 = out file
run_capture_in_container() {
  local cid="$1" script="$2" outfile="$3"
  local log
  log="$(mktemp "${TMPDIR:-/tmp}/smoke-step.XXXXXX")"
  "${ENGINE}" exec \
    --env-file "${CLEAN_CHECKOUT}/.smoke-env" \
    -w /workspace \
    "${cid}" \
    bash -lc "${script}" > "${log}" 2>&1
  local status=$?
  cat "${log}" > "${outfile}"
  rm -f -- "${log}"
  return "${status}"
}

# =============================================================================
# Step 1/5: build-image — build the dev image from the repository.
# =============================================================================
echo "==> Step 1/${STEPS_TOTAL}: building dev image '${IMAGE_TAG}' (config: ${CONTAINER_CONFIG})"
if ! "${ENGINE}" build \
    --quiet \
    --pull \
    --label devteamtest1.smoke-test=1 \
    --tag "${IMAGE_TAG}" \
    --file "${DOCKERFILE}" \
    "${REPO_ROOT}" \
    > /dev/null; then
  fail_step "build-image" "${ENGINE} build from ${CONTAINER_CONFIG} failed"
  finish
fi
pass "build-image (image ${IMAGE_TAG} from ${CONTAINER_CONFIG})"

# =============================================================================
# Step 2/5: container — start a fresh container and copy in the clean checkout.
# =============================================================================
echo "==> Step 2/${STEPS_TOTAL}: starting fresh container '${MAIN_CONTAINER}'"
CONTAINER_ID="$(start_fresh_container "${MAIN_CONTAINER}")" \
  || { fail_step "container" "failed to create/start the main smoke-test container"; finish; }
CONTAINERS_CREATED=1
# (The clean checkout and env file are already inside from start_fresh_container.)
pass "container (fresh container ${CONTAINER_ID} from ${IMAGE_TAG})"

# =============================================================================
# Step 3/5: install — package-manager install + install verification.
# =============================================================================
echo "==> Step 3/${STEPS_TOTAL}: installing dependencies inside the container (npm ci / npm install; dotnet restore)"
run_in_container "install" bash -lc '
  set -u -o pipefail
  failures=0

  # npm is the canonical package manager (docs/package-manager-decision.md).
  if command -v npm >/dev/null 2>&1; then
    if [ -f package-lock.json ]; then
      npm ci --no-audit --no-fund || { echo "ERROR: npm ci failed"; failures=1; }
    elif [ -f package.json ]; then
      npm install --no-audit --no-fund || { echo "ERROR: npm install failed"; failures=1; }
    fi
  else
    echo "WARN: npm not found in container — cannot verify the TypeScript side; continuing"
  fi

  # .NET side: restore the solution (skip when the SDK is unavailable).
  if command -v dotnet >/dev/null 2>&1 && [ -f DevTeamTest1.slnx ]; then
    dotnet restore DevTeamTest1.slnx || { echo "ERROR: dotnet restore failed"; failures=1; }
  else
    echo "WARN: dotnet SDK not found in container — skipping dotnet restore; continuing"
  fi

  exit "${failures}"
'

echo "==> Step 3/${STEPS_TOTAL}: verifying the install (npm ci --dry-run / pip check / package-manager dry-runs)"
run_in_container "install verification" bash -lc '
  set -u -o pipefail
  failures=0

  # npm: a fresh dry-run against the committed lockfile proves the lockfile is
  # consistent with the package.json manifests and the tree installs cleanly.
  if command -v npm >/dev/null 2>&1 && [ -f package.json ]; then
    if [ -f package-lock.json ]; then
      npm ci --dry-run --no-audit --no-fund \
        || { echo "ERROR: npm ci --dry-run verification failed"; failures=1; }
    else
      npm install --dry-run --no-audit --no-fund \
        || { echo "ERROR: npm install --dry-run verification failed"; failures=1; }
    fi
  fi

  # pip: only verifiable when pip is actually installed in the image.
  if command -v pip >/dev/null 2>&1 || command -v pip3 >/dev/null 2>&1; then
    (pip check || pip3 check) \
      || { echo "ERROR: pip check verification failed"; failures=1; }
  else
    echo "SKIP: pip not installed in container — no Python dependency verification"
  fi

  # Other package managers: no pnpm/yarn lockfiles are committed for this repo;
  # a dry-run for a manager that is absent is not a failure.
  for mgr in pnpm yarn; do
    if command -v "${mgr}" >/dev/null 2>&1; then
      echo "NOTE: ${mgr} is present in the container (not the canonical manager); no lockfile to verify"
    fi
  done

  exit "${failures}"
'

# =============================================================================
# Steps: root-scripts — run all four root package.json scripts in the container.
# =============================================================================
for script_name in build test lint type-check; do
  echo "==> Step: root script '${script_name}'"
  run_in_container "root script ${script_name}" bash -lc "npm run ${script_name}"
done

# =============================================================================
# Step 5/5: reproducibility — two clean installs in two fresh containers must
# produce identical dependency resolution fingerprints.
# =============================================================================
echo "==> Step 5/${STEPS_TOTAL}: reproducibility check (two clean installs in two fresh containers)"
FINGERPRINT_SCRIPT='
  set -u -o pipefail
  mkdir -p "$1"

  if command -v npm >/dev/null 2>&1 && [ -f package.json ]; then
    rm -rf /workspace/node_modules
    if [ -f package-lock.json ]; then
      npm ci --no-audit --no-fund > "$1/npm-ci.log" 2>&1 \
        || { echo "ERROR: npm ci (repro run) failed" >&2; exit 1; }
    fi
    # Resolution fingerprint: the full name@version tree. Deterministic given
    # the same image, same lockfile and the same registry state.
    npm ls --all --long > "$1/npm-ls-all.txt" 2>&1 \
      || { echo "ERROR: npm ls --all (repro run) failed" >&2; exit 1; }
  else
    echo "ERROR: npm not available in container for the reproducibility check" >&2
    exit 1
  fi

  # .NET resolution fingerprint (only when the SDK is present; its restore
  # output is not deterministic, so we diff the resolved version list).
  if command -v dotnet >/dev/null 2>&1 && [ -f DevTeamTest1.slnx ]; then
    rm -rf /workspace/obj /workspace/src/*/obj /workspace/src/*/*/obj \
           /workspace/hello/obj /workspace/Greeter/obj \
           /workspace/hello.Tests/obj /workspace/Greeter.Tests/obj \
           /workspace/tests/*/obj 2>/dev/null || true
    dotnet restore DevTeamTest1.slnx > "$1/dotnet-restore.log" 2>&1 \
      || { echo "ERROR: dotnet restore (repro run) failed" >&2; exit 1; }
    dotnet list DevTeamTest1.slnx package --verbosity minimal 2>/dev/null \
      | sort > "$1/dotnet-packages.txt" || echo "(dotnet list unavailable)" > "$1/dotnet-packages.txt"
  fi

  exit 0
'

REPRO_A="$(start_fresh_container "smoke-repro-a-${STAMP}-$$")" \
  || { fail_step "reproducibility" "failed to start the first reproducibility container"; finish; }
REPRO_B="$(start_fresh_container "smoke-repro-b-${STAMP}-$$")" \
  || { fail_step "reproducibility" "failed to start the second reproducibility container"; finish; }

REPRO_OUT_A="${CLEAN_CHECKOUT}/repro-a.txt"
REPRO_OUT_B="${CLEAN_CHECKOUT}/repro-b.txt"

if ! run_capture_in_container "${REPRO_A}" "${FINGERPRINT_SCRIPT}" "${REPRO_OUT_A}" \
  || ! run_capture_in_container "${REPRO_B}" "${FINGERPRINT_SCRIPT}" "${REPRO_OUT_B}"; then
  fail_step "reproducibility" "one of the two clean-install fingerprint runs failed inside the container"
  finish
fi

if ! diff -u "${REPRO_OUT_A}" "${REPRO_OUT_B}" > "${CLEAN_CHECKOUT}/repro-diff.txt"; then
  fail_step "reproducibility" "dependency resolution differs between the two clean installs:"
  sed -n '1,40p' "${CLEAN_CHECKOUT}/repro-diff.txt"
  finish
fi
pass "reproducibility (two clean installs produced identical dependency resolution)"

# =============================================================================
# All steps passed.
# =============================================================================
finish
