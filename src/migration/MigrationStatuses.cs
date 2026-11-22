namespace Migration;

/// <summary>
/// The lifecycle status of a migration in the codebase.
///
/// Definitions (see also <c>docs/migration/statuses.md</c>):
///
/// <list type="bullet">
///   <item><description><see cref="Migrated"/> — The migration has been
///   completed successfully. The code has been fully moved to the new
///   structure/technology and no legacy code from the migration remains.</description></item>
///   <item><description><see cref="Deprecated"/> — The old code has been
///   superseded by a migration but is still present in the codebase. It is
///   no longer recommended for use and is a candidate for removal.</description></item>
///   <item><description><see cref="Dropped"/> — The old code has been
///   completely removed from the codebase. Reaching this status <b>requires
///   senior maintainer approval</b> before the code is deleted.</description></item>
/// </list>
/// </summary>
public enum MigrationStatus
{
    /// <summary>
    /// The migration has been completed successfully. The code has been
    /// fully moved to the new structure/technology and no legacy code
    /// from the migration remains.
    /// </summary>
    Migrated,

    /// <summary>
    /// The old code has been superseded by a migration but is still
    /// present in the codebase. It is no longer recommended for use and
    /// is a candidate for removal.
    /// </summary>
    Deprecated,

    /// <summary>
    /// The old code has been completely removed from the codebase.
    /// Reaching this status requires senior maintainer approval.
    /// </summary>
    Dropped
}

/// <summary>
/// Provides metadata and validation for the three migration states:
/// <see cref="MigrationStatus.Migrated"/>,
/// <see cref="MigrationStatus.Deprecated"/>, and
/// <see cref="MigrationStatus.Dropped"/>.
/// </summary>
public static class MigrationStatuses
{
    /// <summary>Description of the <see cref="MigrationStatus.Migrated"/> status.</summary>
    public const string MigratedDescription =
        "The migration has been completed successfully. The code has been fully moved to the " +
        "new structure/technology and no legacy code from the migration remains.";

    /// <summary>Description of the <see cref="MigrationStatus.Deprecated"/> status.</summary>
    public const string DeprecatedDescription =
        "The old code has been superseded by a migration but is still present in the codebase. " +
        "It is no longer recommended for use and is a candidate for removal.";

    /// <summary>Description of the <see cref="MigrationStatus.Dropped"/> status.</summary>
    public const string DroppedDescription =
        "The old code has been completely removed from the codebase. " +
        "Requires senior maintainer approval.";

    /// <summary>
    /// <c>true</c> because moving a migration to <see cref="MigrationStatus.Dropped"/>
    /// requires explicit senior maintainer approval before old code is deleted.
    /// </summary>
    public const bool DroppedRequiresSeniorMaintainerApproval = true;

    /// <summary>
    /// All defined migration statuses, in lifecycle order:
    /// <see cref="MigrationStatus.Migrated"/>, then
    /// <see cref="MigrationStatus.Deprecated"/>, then
    /// <see cref="MigrationStatus.Dropped"/>.
    /// </summary>
    public static readonly IReadOnlyList<MigrationStatus> All =
        [
            MigrationStatus.Migrated,
            MigrationStatus.Deprecated,
            MigrationStatus.Dropped,
        ];

    /// <summary>Returns the canonical description for the given status.</summary>
    /// <exception cref="ArgumentException">
    /// Thrown when <paramref name="status"/> is not a defined migration status.
    /// </exception>
    public static string GetDescription(MigrationStatus status) => status switch
    {
        MigrationStatus.Migrated => MigratedDescription,
        MigrationStatus.Deprecated => DeprecatedDescription,
        MigrationStatus.Dropped => DroppedDescription,
        _ => throw new ArgumentException(
            $"Unknown migration status: '{status}'.", nameof(status)),
    };

    /// <summary>
    /// Returns <c>true</c> when transitioning to the given status requires
    /// senior maintainer approval. Only <see cref="MigrationStatus.Dropped"/>
    /// requires approval.
    /// </summary>
    public static bool RequiresSeniorMaintainerApproval(MigrationStatus status) =>
        status == MigrationStatus.Dropped && DroppedRequiresSeniorMaintainerApproval;
}
