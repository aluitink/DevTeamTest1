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

## Decision Log

Record significant decisions made during the migration here, newest
first. Each entry should state the decision, the rationale, and the date.

| Date | Decision | Rationale |
| --- | --- | --- |
| 2026-01-01 | Established this migration document and tracking table. | Provides a single source of truth for migration status, ownership, and rationale (task #52). |

## Migration Workflow

Each feature in the tracking table moves through the lifecycle
`migrated` → `deprecated` → `dropped` (see
[Migration Statuses](migration/statuses.md)). The steps below describe the
whole workflow, including exactly when and how to mark a feature as
`migrated`, `deprecated`, or `dropped`.

**Golden rule: documentation updates must accompany code changes.** Every
code change made during a migration — adding an `[Obsolete]` attribute,
deleting a file, porting a method — is committed in the same pull request
as the corresponding update to this document (the [Tracking Table](#tracking-table)
row, and the [Decision Log](#decision-log) when a decision was made). A
status may not be changed in the table without a matching code change, and
a status-affecting code change may not be merged without its documentation
update.

### 1. Add a tracking entry (planning)

Before any code changes, create a row in the [Tracking Table](#tracking-table)
with the feature name, legacy location, intended modern location, the
responsible owner, and the justification. The row is updated as each step
below completes; the status column is set at the transition points in
steps 3, 4, and 5.

### 2. Implement the modern code

Port the feature to its modern location. The legacy code stays in place
and keeps working so nothing breaks during the transition. Update any
affected entries in the [Feature Parity Checklist](audit.md) as the ported
behavior is verified.

### 3. Mark the feature `migrated`

Once the new code is complete, builds cleanly, and has passing tests:

1. Set **Current Status** to `migrated`, fill in **Modern Location**, and
   update **Date Updated** in the tracking table.
2. Commit the table update in the same pull request as the new code.

**Example (`migrated`):** The `Greet` method is ported from
`Greeter/Greeter.cs` to `src/hello/`. The new implementation is covered by
tests and the old method still exists. The tracking row reads:

| Feature Name | Legacy Location | Modern Location | Current Status | Date Updated | Responsible Owner | Justification/Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Greeting | `Greeter/Greeter.cs` | `src/hello/` | migrated | 2026-01-01 | Alice | Modern implementation complete and tested; legacy copy kept for one release. |

### 4. Mark the legacy code `deprecated`

With the migration done, flag the old code so callers know to move off it:

1. Add `[Obsolete("...")]` attributes (or the equivalent for the language)
   to the legacy API surface and note the deprecation in the nearest
   README.
2. Set **Current Status** to `deprecated` in the tracking table and
   update **Date Updated**; record the deprecation window (e.g. "one
   release" or a date) in the **Justification/Notes** column.
3. Commit the code annotations and the table update together.

**Example (`deprecated`):** After the `Greeting` feature is `migrated`,
the old method is annotated and the row is updated:

```csharp
// Greeter/Greeter.cs
[Obsolete("Greeting is migrated to src/hello/. Use the new implementation; this method is scheduled for removal.")]
public string Greet(string name) => ...;
```

| Feature Name | Legacy Location | Modern Location | Current Status | Date Updated | Responsible Owner | Justification/Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Greeting | `Greeter/Greeter.cs` | `src/hello/` | deprecated | 2026-02-01 | Alice | Legacy `Greet` marked `[Obsolete]`; removal planned for the release after the deprecation window (2026-03-01). |

### 5. Mark the feature `dropped` (senior maintainer approval required)

After the deprecation window has elapsed and no callers remain:

1. **Request senior maintainer approval.** Moving a feature to `dropped`
   requires a senior maintainer to explicitly approve the removal before
   any legacy code is deleted (see [Migration Statuses](migration/statuses.md);
   in code, `MigrationStatuses.RequiresSeniorMaintainerApproval(MigrationStatus.Dropped)`
   returns `true`). Record the approver and date in the pull request.
2. Delete the legacy code.
3. Set **Current Status** to `dropped`, update **Date Updated**, and fill
   in the **Justification/Notes** column with the *justification for
   dropping* — why the legacy code is safe to remove (deprecation window
   elapsed, no remaining callers, how it was verified) and who approved
   the removal.
4. Commit the deletion and the table update together.

**Example (`dropped` with justification):** One release after
deprecation, a code search shows no remaining callers of the legacy
`Greet`. A senior maintainer (Carol) approves the removal in the pull
request. The legacy method is deleted and the row becomes:

| Feature Name | Legacy Location | Modern Location | Current Status | Date Updated | Responsible Owner | Justification/Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Greeting | `Greeter/Greeter.cs` | `src/hello/` | dropped | 2026-04-01 | Alice | Legacy `Greet` removed: deprecation window (2026-02-01 → 2026-03-01) elapsed, code search confirmed zero remaining callers, behavior covered by tests in `src/hello/`. Senior maintainer approval: Carol, 2026-03-28. |

A `dropped` row is final for that feature: if the feature later needs to
be reworked, it gets a *new* tracking entry rather than being moved back.

### 6. Record the decision

Any non-obvious decision made along the way (changed deprecation window,
approval conditions, re-planning) is recorded in the [Decision Log](#decision-log)
below, and in the same pull request as the code change it relates to.

