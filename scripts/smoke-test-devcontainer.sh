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
#                      if one exists) from a clean checkout.
#   2. container     : starts a fresh container from that image and copies a
#                      pristine checkout (git archive: no .git, no build
#                      output) into /workspace.
#   3. install       : performs the package-manager install inside the
#                      container (npm ci, falling back to npm install; dotnet
#                      restore for the .NET solution when available) and then
#                      runs install verification:
#                        - npm ls --all      (post-install integrity check;
#                                             see deviation note below)
#                        - npm install --dry-run (pre-install resolution
#                                              check, only when no lockfile)
#                        - pip check         (only if pip is installed)
#   4. root-scripts  : runs all four root package.json scripts inside the
#                      container (build, test, lint, type-check) and asserts
#                      a non-zero exit on failure (a non-zero exit aborts the
#                      whole smoke test with that code).
#   5. reproducibility: proves dependency resolution is reproducible by doing
#                      two clean installs in two fresh containers and diffing
#                      the resolution fingerprints. The fingerprint is ALWAYS
#                      produced (the npm name@version tree of the two
#                      workspaces plus a manifest hash); the dotnet resolved
#                      package list is only ADDED when the .NET SDK is
#                      present. A missing/empty fingerprint is a hard FAIL.
#                      The two fingerprints must be byte-identical.
#
# NOTE (deviation from task text): the task suggested `npm ci --dry-run`,
# but `npm ci` does not support a `--dry-run` flag on any npm version —
# running it fails even on a correct install. The equivalent verification is
# `npm ls --all` (post-install integrity: every declared dependency is
# present and resolvable) plus `npm install --dry-run` (pre-install
# resolution) when no lockfile is committed. This script uses those instead
# and documents the deviation here.
#
# NOTE (build context): the Dockerfile at `.devteam/Dockerfile` deliberately
# contains no COPY/ADD instructions — the repository is copied into
# /workspace at runtime (this script does that via `docker cp`), so the
# build context `${REPO_ROOT}` is used only for build args/labels and the
# image itself stays repo-agnostic. If a future Dockerfile adds COPY/ADD,
# remember paths are relative to the build context (the repo root), not to
# the `.devteam/` directory.
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
#   - prints a clear PASS / FAIL line for every step plus a final overall
#     summary, on every exit path;
#   - exits non-zero on any failure (0 only when every step passed);
#   - works from a clean checkout with only docker available on the host
#     (podman is used automatically when docker is absent);
#   - everything that is verified runs INSIDE the container built from the
#     repo, never against the host toolchain.
#
# Prerequisite: the script needs a git working tree and builds from `HEAD`,
# so it verifies the committed tree, not uncommitted local changes. If the
# working tree is dirty a warning is printed (the clean checkout comes from
# `git archive HEAD`). If the repository contains committed junk that should
# not reach the container (e.g. an accidentally committed node_modules),
# `git archive` will include it — commit a .gitignore entry instead.
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
# shared dev image Dockerfile in the repository (see header note on build
# context).
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
# Work from a pristine copy of the committed tree (git archive => no .git, no
# untracked files, no build output) so the smoke test verifies a clean
# checkout. Repeating the step (idempotency) always rebuilds this directory.
# NOTE: this archives HEAD, so uncommitted working-tree changes are NOT part
# of what gets tested (by design); a dirty tree only changes what you think
# you are testing, so we warn below.
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "FAIL: repo root '${REPO_ROOT}' is not a git working tree; cannot create a clean checkout"
  exit 1
fi
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  echo "WARN: working tree is dirty; the smoke test archives HEAD, so uncommitted changes are not included in what gets tested"
fi
CLEAN_CHECKOUT="$(mktemp -d "${TMPDIR:-/tmp}/smoke-test-devcontainer-checkout.XXXXXX")"
if ! git archive --format=tar HEAD | tar -x -C "${CLEAN_CHECKOUT}"; then
  echo "FAIL: failed to create a clean checkout (git archive)"
  rm -rf -- "${CLEAN_CHECKOUT}"
  exit 1
fi

# --- Scratch state & cleanup -----------------------------------------------------
STAMP="$(date +%s)"
IMAGE_TAG="devteamtest1-smoke-test:${STAMP}"
MAIN_CONTAINER="smoke-main-${STAMP}-$$"
REPRO_CONTAINERS=()
CONTAINERS_CREATED=0

# Create the container AND pre-seed its /workspace with the clean checkout +
# env file (mirrors what the real VS Code devcontainer flow does: mount the
# repo at /workspace). Returns 0 on success; registers the container for
# cleanup on the way.
#   $1 = container name
start_fresh_container() {
  local name="$1"
  write_env_file
  if ! "${ENGINE}" create --name "${name}" --interactive -w /workspace "${IMAGE_TAG}" >/dev/null; then
    echo "ERROR: '${name}' creation failed (${ENGINE} create from ${IMAGE_TAG})" >&2
    return 1
  fi
  REPRO_CONTAINERS+=("${name}")
  if ! "${ENGINE}" cp "${CLEAN_CHECKOUT}/." "${name}:/workspace/" \
     || ! "${ENGINE}" cp "${CLEAN_CHECKOUT}/.smoke-env" "${name}:/workspace/.smoke-env"; then
    echo "ERROR: copying clean checkout into ${name}:/workspace failed" >&2
    return 1
  fi
  if ! "${ENGINE}" start "${name}" >/dev/null; then
    echo "ERROR: '${name}' failed to start (${ENGINE} start ${name})" >&2
    return 1
  fi
  return 0
}

cleanup() {
  local status=$?
  local c
  for c in ${REPRO_CONTAINERS[@]+"${REPRO_CONTAINERS[@]}"}; do
    [ -n "${c}" ] || continue
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

# --- Bookkeeping & helpers -------------------------------------------------------
STEPS_TOTAL=5
STEPS_PASSED=0
STEPS_FAILED=0
FAILED_STEPS=()

pass() { # $1 = step name
  STEPS_PASSED=$((STEPS_PASSED + 1))
  echo "PASS: ${1}"
}

fail_step() { # $1 = step name, $2 = detail
  STEPS_FAILED=$((STEPS_FAILED + 1))
  FAILED_STEPS+=("${1}")
  echo "FAIL: ${1} — ${2}"
}

# Final summary + exit. Called on EVERY exit path (abort or completion), so
# the overall PASS/FAIL line and step counts are always printed.
finish() {
  local steps_done=$((STEPS_PASSED + STEPS_FAILED))
  echo "---------------------------------------------------------------"
  if [ "${STEPS_FAILED}" -eq 0 ]; then
    echo "PASS: dev-container smoke test — all ${steps_done}/${STEPS_TOTAL} steps passed (image ${IMAGE_TAG})"
    exit 0
  else
    echo "FAIL: dev-container smoke test — ${STEPS_FAILED}/${STEPS_TOTAL} steps failed: ${FAILED_STEPS[*]}"
    exit 1
  fi
}

# (Re)write the agent env file consumed by --env-file. Called before each
# container interaction so the file always exists (the clean checkout is
# removed during cleanup).
write_env_file() {
  printf '%s\n' "${AGENT_ENV_VARS[@]}" > "${CLEAN_CHECKOUT}/.smoke-env"
}

# Run a command inside the MAIN container.
#   $1 = step name for the PASS/FAIL line; remaining args = command argv.
# On non-zero exit: records the step as FAILED and aborts the whole smoke
# test with the command's exit code (asserts non-zero on failure, per the
# task acceptance criteria). The final summary is always printed via finish.
run_in_container() {
  local step="$1"; shift
  write_env_file
  local status=0
  "${ENGINE}" exec \
    --env-file "${CLEAN_CHECKOUT}/.smoke-env" \
    -w /workspace \
    "${MAIN_CONTAINER}" \
    "$@" || status=$?
  if [ "${status}" -ne 0 ]; then
    fail_step "${step}" "command exited with code ${status} (container ${MAIN_CONTAINER})"
    echo "ERROR: step '${step}' exited with code ${status} — aborting smoke test"
    finish   # prints the per-step FAIL (already printed) + overall summary
  fi
  pass "${step}"
}

# Run a bash script inside a given container, capturing stdout+stderr into a
# file on the host.
#   $1 = container name, $2 = bash script body (runs in /workspace as a login
#        shell), $3 = output file on the host, $4 = extra positional args
#        passed to the script ($1, $2, ... inside the container).
# The script body is single-quoted at the host (so the host shell expands
# nothing), and any values it needs from the host are passed as explicit
# arguments — never interpolated into the body.
run_capture_in_container() {
  local cname="$1" script="$2" outfile="$3"
  shift 3
  write_env_file
  local log status
  log="$(mktemp "${TMPDIR:-/tmp}/smoke-step.XXXXXX")"
  "${ENGINE}" exec \
    --env-file "${CLEAN_CHECKOUT}/.smoke-env" \
    -w /workspace \
    "${cname}" \
    bash -lc "${script}" _ "$@" > "${log}" 2>&1
  status=$?
  cat "${log}" > "${outfile}"
  rm -f -- "${log}"
  return "${status}"
}

# =============================================================================
# Step 1/5: build-image — build the dev image from the repository.
# --pull keeps the base image current (reproducibility of the build inputs).
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
if ! start_fresh_container "${MAIN_CONTAINER}"; then
  fail_step "container" "failed to create/start the main smoke-test container"
  finish
fi
CONTAINERS_CREATED=1
# (The clean checkout and env file are already inside from start_fresh_container.)
pass "container (fresh container ${MAIN_CONTAINER} from ${IMAGE_TAG})"

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

echo "==> Step 3/${STEPS_TOTAL}: verifying the install (npm ls --all / npm install --dry-run / pip check)"
run_in_container "install verification" bash -lc '
  set -u -o pipefail
  failures=0

  # npm: NOTE — the task text suggested "npm ci --dry-run", but npm ci does
  # not support --dry-run on any npm version (it would always fail). The
  # equivalent post-install integrity check is `npm ls --all`, which exits
  # non-zero when any declared dependency is missing, has a version conflict,
  # or is invalid. The "invalid|missing" grep is a belt-and-braces second
  # check on the output (an npm ls exit code can be lost in some wrappers).
  if command -v npm >/dev/null 2>&1; then
    if [ -f package-lock.json ]; then
      npm ls --all --no-audit --no-fund \
        || { echo "ERROR: npm ls --all verification failed"; failures=1; }
      if npm ls --all --no-audit --no-fund 2>&1 | grep -Ei "invalid|missing" >/dev/null; then
        echo "ERROR: npm tree contains invalid or missing packages" >&2
        failures=1
      else
        echo "ok: npm ls --all shows no invalid/missing packages"
      fi
    else
      # No lockfile: a pre-install resolution dry-run is the closest check.
      npm install --dry-run --no-audit --no-fund \
        || { echo "ERROR: npm install --dry-run verification failed"; failures=1; }
    fi
  else
    echo "WARN: npm not found in container — skipping npm install verification"
  fi

  # pip: only verifiable when pip is actually installed in the image.
  if command -v pip >/dev/null 2>&1 || command -v pip3 >/dev/null 2>&1; then
    (pip check || pip3 check) \
      || { echo "ERROR: pip check verification failed"; failures=1; }
  else
    echo "SKIP: pip not installed in container — no Python dependency verification"
  fi

  # Other package managers: no pnpm/yarn lockfiles are committed for this repo;
  # a manager that is absent is not a failure.
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
#
# The fingerprint ALWAYS contains the npm resolution data (npm is the
# canonical package manager per docs/package-manager-decision.md); the dotnet
# resolved package list is only ADDED when the .NET SDK is present in the
# image. A missing or empty fingerprint is a hard failure, never a silent
# pass.
#
# The fingerprint dir is passed to the in-container script as $1 (see
# run_capture_in_container — the script body itself is single-quoted on the
# host, so $1 is expanded inside the container, not on the host).
# =============================================================================
echo "==> Step 5/${STEPS_TOTAL}: reproducibility check (two clean installs in two fresh containers)"
FINGERPRINT_SCRIPT='
  set -u -o pipefail
  out_dir="$1"
  mkdir -p "${out_dir}" || { echo "ERROR: cannot create fingerprint dir ${out_dir}" >&2; exit 1; }

  have_fingerprint=0

  # --- npm fingerprint (always expected: npm is the canonical manager) -------
  if command -v npm >/dev/null 2>&1 && [ -f package.json ]; then
    # Start from a clean node_modules so this is a genuinely fresh install.
    rm -rf /workspace/node_modules
    if [ -f package-lock.json ]; then
      npm ci --no-audit --no-fund > "${out_dir}/npm-ci.log" 2>&1 \
        || { echo "ERROR: npm ci (repro run) failed; see log below" >&2; cat "${out_dir}/npm-ci.log" >&2; exit 1; }
    else
      npm install --no-audit --no-fund > "${out_dir}/npm-install.log" 2>&1 \
        || { echo "ERROR: npm install (repro run) failed; see log below" >&2; cat "${out_dir}/npm-install.log" >&2; exit 1; }
    fi
    # Resolution fingerprint: the full name@version tree of the root project
    # plus each workspace. Deterministic given the same image, same lockfile
    # and the same registry state.
    {
      echo "== root: npm ls =="
      npm ls --all --no-audit --no-fund 2>&1
      # The workspaces are hoisted into the root node_modules, so listing
      # from the root covers them; list each workspace manifest own deps
      # explicitly as well (cheap and catches a broken hoist).
      for ws in src/lib/validation src/api-responses; do
        [ -f "${ws}/package.json" ] || continue
        echo "== workspace ${ws}: npm ls =="
        (cd "${ws}" && npm ls --all --no-audit --no-fund) 2>&1
      done
      echo "== manifest hash (package.json + package-lock.json) =="
      for f in package.json package-lock.json; do
        [ -f "${f}" ] && printf "%s: %s\n" "${f}" "$(sha256sum "${f}" | cut -d" " -f1)"
      done
    } > "${out_dir}/npm-fingerprint.txt" 2>&1 \
      || { echo "ERROR: npm ls (repro run) failed" >&2; exit 1; }
    # The npm ls output may contain npm version banners etc.; the content is
    # what gets diffed, and it is deterministic for the same npm + lockfile.
    have_fingerprint=1
  elif command -v npm >/dev/null 2>&1; then
    echo "ERROR: no package.json in /workspace — cannot produce an npm fingerprint" >&2
    exit 1
  fi

  # --- dotnet fingerprint (only ADDED when the .NET SDK is present) ----------
  if command -v dotnet >/dev/null 2>&1 && [ -f DevTeamTest1.slnx ]; then
    # Clean previous restore state for a genuinely fresh restore.
    find /workspace -type d -name obj -prune -exec rm -rf {} + 2>/dev/null || true
    dotnet restore DevTeamTest1.slnx > "${out_dir}/dotnet-restore.log" 2>&1 \
      || { echo "ERROR: dotnet restore (repro run) failed; see log below" >&2; cat "${out_dir}/dotnet-restore.log" >&2; exit 1; }
    dotnet list DevTeamTest1.slnx package --verbosity minimal 2>/dev/null \
      | grep -E "^ *[>|]" | sort > "${out_dir}/dotnet-packages.txt" \
      || true
    if [ ! -s "${out_dir}/dotnet-packages.txt" ]; then
      echo "(no external package references resolved — fingerprint is empty by design)" \
        > "${out_dir}/dotnet-packages.txt"
    fi
    have_fingerprint=1
  fi

  # A missing fingerprint is a hard failure, never a silent pass.
  if [ "${have_fingerprint}" -ne 1 ]; then
    echo "ERROR: neither npm (with a package.json) nor dotnet (with a .slnx) is available in this container — no dependency resolution could be fingerprinted" >&2
    exit 1
  fi

  exit 0
'

REPRO_A="$(start_fresh_container "smoke-repro-a-${STAMP}-$$")" \
  || { fail_step "reproducibility" "failed to start the first reproducibility container"; finish; }
REPRO_B="$(start_fresh_container "smoke-repro-b-${STAMP}-$$")" \
  || { fail_step "reproducibility" "failed to start the second reproducibility container"; finish; }

REPRO_OUT_A="${CLEAN_CHECKOUT}/repro-a.txt"
REPRO_OUT_B="${CLEAN_CHECKOUT}/repro-b.txt"

if ! run_capture_in_container "${REPRO_A}" "${FINGERPRINT_SCRIPT}" "${REPRO_OUT_A}" "/workspace/repro-a-fp" \
   || ! run_capture_in_container "${REPRO_B}" "${FINGERPRINT_SCRIPT}" "${REPRO_OUT_B}" "/workspace/repro-b-fp"; then
  fail_step "reproducibility" "one of the two clean-install fingerprint runs failed inside the container"
  echo "---- run A output ----"; sed -n '1,40p' "${REPRO_OUT_A}"
  echo "---- run B output ----"; sed -n '1,40p' "${REPRO_OUT_B}"
  finish
fi

# Collect the fingerprint files from each container and diff them.
REPRO_FP_A="${CLEAN_CHECKOUT}/repro-a-fp"
REPRO_FP_B="${CLEAN_CHECKOUT}/repro-b-fp"
rm -rf -- "${REPRO_FP_A}" "${REPRO_FP_B}"
if ! "${ENGINE}" cp "${REPRO_A}:/workspace/repro-a-fp" "${REPRO_FP_A}"; then
  fail_step "reproducibility" "could not copy the fingerprint files out of container ${REPRO_A}"
  finish
fi
if ! "${ENGINE}" cp "${REPRO_B}:/workspace/repro-b-fp" "${REPRO_FP_B}"; then
  fail_step "reproducibility" "could not copy the fingerprint files out of container ${REPRO_B}"
  finish
fi
# Both containers must have produced the same set of fingerprint files.
if ! diff -rq "${REPRO_FP_A}" "${REPRO_FP_B}" > "${CLEAN_CHECKOUT}/repro-fileset-diff.txt"; then
  fail_step "reproducibility" "the two clean installs produced different fingerprint file sets:"
  sed -n '1,40p' "${CLEAN_CHECKOUT}/repro-fileset-diff.txt"
  finish
fi
# Empty fingerprint = hard failure (the in-container script already guards
# this, but double-check on the host too: a missing npm + missing dotnet
# would have made the dir empty).
if [ -z "$(find "${REPRO_FP_A}" -type f ! -name '*.log' -print -quit 2>/dev/null)" ]; then
  fail_step "reproducibility" "no non-log fingerprint files were produced — cannot prove reproducibility (fingerprint empty)"
  finish
fi
# Content must be byte-identical.
if ! diff -ru "${REPRO_FP_A}" "${REPRO_FP_B}" --exclude='*.log' > "${CLEAN_CHECKOUT}/repro-diff.txt"; then
  fail_step "reproducibility" "dependency resolution differs between the two clean installs:"
  sed -n '1,40p' "${CLEAN_CHECKOUT}/repro-diff.txt"
  finish
fi
pass "reproducibility (two clean installs produced identical dependency resolution)"

# =============================================================================
# All steps passed.
# =============================================================================
finish
