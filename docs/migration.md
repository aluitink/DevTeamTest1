# Core Migration Documentation

## Overview

This document is the central reference for the core migration effort. It
explains where the migration currently stands, how individual features
should be migrated, and records the decisions made along the way. Every
feature being migrated is tracked in the table below so owners, status,
and rationale are always visible in one place.

Related documents:

- [Migration Statuses](migration/statuses.md) — the lifecycle states
  (`migrated`, `deprecated`, `dropped`) and their definitions, with the
  canonical source of truth in `src/migration/MigrationStatuses.cs`.

## Current Status

The migration is in progress. Features that have not yet been started are
not yet listed in the tracking table; add an entry as soon as a migration
is planned or begun.

### Tracking Table

| Feature Name | Legacy Location | Modern Location | Current Status | Date Updated | Responsible Owner | Justification/Notes |
| --- | --- | --- | --- | --- | --- | --- |
| _(example)_ Greeting | `Greeter/Greeter.cs` | `src/hello/` | migrated | 2026-01-01 | _(TBD)_ | Example row — replace with real entries. |

**Column descriptions:**

- **Feature Name** — short, human-readable name of the feature being
  migrated.
- **Legacy Location** — where the feature currently lives in the codebase
  (path or namespace).
- **Modern Location** — where the feature will live (or now lives) after
  the migration.
- **Current Status** — one of the lifecycle states defined in
  [Migration Statuses](migration/statuses.md): `migrated`, `deprecated`,
  or `dropped`.
- **Date Updated** — the date the row was last updated (ISO 8601,
  `YYYY-MM-DD`).
- **Responsible Owner** — the team member or team owning the migration.
- **Justification/Notes** — why the migration is happening and any
  relevant context or caveats.

## Migration Workflow

Each feature migration follows the same steps:

1. **Add a tracking entry.** Create a row in the [Tracking Table](#tracking-table)
   above with the legacy location, the intended modern location, the
   responsible owner, and the justification. Set the status to
   `deprecated` once the new code is in place.
2. **Implement the modern code.** Port the feature to its modern
   location, keeping the old code in place and still working.
3. **Update the status to `migrated`.** Once the new code is complete and
   tested, mark the row `migrated` and update the Date Updated.
4. **Deprecate the legacy code.** Mark the old code as deprecated
   (e.g. `[Obsolete]` attributes, README notes) so callers know to move
   off it.
5. **Drop the legacy code.** After the deprecation window, remove the old
   code and mark the row `dropped`. **Dropping requires senior maintainer
   approval** (see [Migration Statuses](migration/statuses.md)).
6. **Record the decision.** Note any non-obvious decisions in the
   [Decision Log](#decision-log) below.

## Decision Log

Record significant decisions made during the migration here, newest
first. Each entry should state the decision, the rationale, and the date.

| Date | Decision | Rationale |
| --- | --- | --- |
| 2026-01-01 | Established this migration document and tracking table. | Provides a single source of truth for migration status, ownership, and rationale (task #52). |
