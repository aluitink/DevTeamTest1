# Migration Statuses

Every migration in this codebase is tracked in exactly one of three
lifecycle states: **migrated**, **deprecated**, and **dropped**. The
canonical, machine-readable definitions live in
[`src/migration/MigrationStatuses.cs`](../../src/migration/MigrationStatuses.cs)
(the `Migration.MigrationStatus` enum and the `Migration.MigrationStatuses`
static class), so code and docs always reference the same source of truth.

## Status definitions

| Status | Code symbol | Description |
| --- | --- | --- |
| Migrated | `MigrationStatus.Migrated` | The migration has been completed successfully. The code has been fully moved to the new structure/technology and no legacy code from the migration remains. |
| Deprecated | `MigrationStatus.Deprecated` | The old code has been superseded by a migration but is still present in the codebase. It is no longer recommended for use and is a candidate for removal. |
| Dropped | `MigrationStatus.Dropped` | The old code has been completely removed from the codebase. **Requires senior maintainer approval.** |

## Details

### `migrated`
The migration has been completed successfully. The code has been fully
moved to the new structure/technology and no legacy code from the migration
remains.

### `deprecated`
The old code has been superseded by a migration but is still present in the
codebase. It is no longer recommended for use and is a candidate for
removal.

### `dropped`
The old code has been completely removed from the codebase.

> **Note:** Moving a migration to `dropped` **requires senior maintainer
> approval**. The old code must not be deleted until a senior maintainer
> has explicitly approved the removal.

## Lifecycle order

```
migrated → deprecated → dropped
```

1. **migrated** — the new code is in place and working.
2. **deprecated** — the old code is marked as superseded and scheduled for
   removal.
3. **dropped** — the old code has been deleted (senior maintainer approval
   required).

## Referencing the definitions

- **Code:** use the `MigrationStatus` enum and `MigrationStatuses` helpers
  (`GetDescription`, `RequiresSeniorMaintainerApproval`, `All`) from
  `src/migration/MigrationStatuses.cs`.
- **Docs:** link to this page (`docs/migration/statuses.md`) and cite the
  table above.

## Tests

The definitions are covered by
`src/migration.Tests/MigrationStatusesTests.cs`. Run them with:

```bash
dotnet test src/migration.Tests/migration.Tests.csproj
```
