# Decision: Canonical Package Manager

- **Date:** 2026-01-14
- **Decision:** **npm** is the single canonical package manager for this
  repository.
- **Downstream flag:** `PM = npm` (downstream tasks should branch on this:
  use `npm`, `package-lock.json`, and npm workspace scripts — do not adopt
  pnpm or commit a `pnpm-lock.yaml`).
- **Tasks:** #111 (this decision); re-scopes/closes #64 ("Propose adopting
  pnpm"), which is no longer actionable.

This note is written so it can be lifted into a PR description verbatim.

## Decision

We adopt **npm** (version 10.x, shipped with the required Node.js 20.x) as
the one and only package manager for the modern TypeScript projects in this
repository. pnpm is explicitly **not** adopted. All future dependency work
— installs, lockfile updates, CI caching, workspace scripts — must go
through npm.

## Rationale

1. **The repository is already npm end to end.** The root
   `package.json` declares an npm workspace
   (`"workspaces": ["src/lib/validation", "src/api-responses"]`) and npm
   workspace scripts (`npm run build --workspaces --if-present`, etc.);
   `package-lock.json` (lockfileVersion 3) is committed at the root;
   `CONTRIBUTING.md`, `README.md`, and `.github/workflows/ci.yml` all
   document and run `npm ci` / `npm run ...`. Choosing npm means the
   decision matches every existing artifact instead of rewriting them.

2. **It directly fixes the agent install-failure problem this task
   targets.** The ambiguity (npm vs. pnpm, no committed lockfile) is the
   most likely cause of failed agent installs. Declaring npm — with a
   *committed* `package-lock.json` and a CI step that already prefers
   `npm ci` when the lockfile is present — removes the ambiguity with
   zero migration churn. The lockfile-must-be-committed rule below closes
   the second half of that failure mode.

3. **The `"type": "module"` + workspaces layout needs no special tooling.**
   Both workspaces are ESM packages consumed via the `exports` field and
   built with `tsc` + tested with Vitest. npm's native workspaces support
   (hoisted `node_modules`, `npm run ... --workspaces`) already handles
   this layout, and CI has been running it successfully. pnpm's stricter
   isolation (non-hoisted `node_modules`, `workspace:` protocol, its own
   lockfile and store) would buy nothing here — there are no phantom
   dependency or disk-usage problems to solve — while forcing every
   existing npm-specific script, doc, and CI step to change at once.

4. **It resolves the open #64 proposal decisively.** Task #64 proposed
   evaluating pnpm. This decision closes that question: pnpm was considered
   and rejected for this repo today (see #111). #64 must be re-scoped or
   closed so that it no longer proposes pnpm; the single source of truth
   for the package-manager question is this document plus the entry in the
   Decision Log below. No second manager may be introduced without a new
   Decision Log entry that supersedes this one.

## Consequences / rules going forward

- **npm is the only supported manager.** Never run `pnpm install`
  (or yarn) in this repo, and never commit `pnpm-lock.yaml` or a
  `packageManager` field pinning a non-npm manager.
- **`package-lock.json` must be committed.** Any change to any
  `package.json` (root or workspace) must be committed together with the
  regenerated `package-lock.json` so that `npm ci` works from a clean
  clone. CI already enforces reproducibility via `npm ci` when the
  lockfile is present.
- **All documentation and CI already reference npm** and remain correct as
  written; no script or workflow changes are needed for this decision.

## Alternatives considered

- **pnpm** (the #64 proposal) — rejected: the repo is already npm-native
  (lockfile, workspace scripts, CI, docs); pnpm's benefits (disk usage,
  strict isolation) do not apply to a small two-workspace repository, and
  adopting it would rewrite every npm-specific artifact and re-introduce
  transition risk instead of removing the ambiguity.
- **yarn** — rejected: same arguments as pnpm, with no existing yarn
  artifacts; not part of the #64 proposal.

## Record in the Decision Log

Per the golden rule in `docs/migration.md`, the matching append-only
Decision Log entry has been added to `docs/migration.md` under
"### Entries".
