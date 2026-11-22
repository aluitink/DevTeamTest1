using Migration;

namespace Migration.Tests;

public class MigrationStatusesTests
{
    [Theory]
    [InlineData(MigrationStatus.Migrated)]
    [InlineData(MigrationStatus.Deprecated)]
    [InlineData(MigrationStatus.Dropped)]
    public void GetDescription_KnownStatus_ReturnsNonEmptyDescription(MigrationStatus status)
    {
        Assert.False(string.IsNullOrWhiteSpace(MigrationStatuses.GetDescription(status)));
    }

    [Fact]
    public void GetDescription_Migrated_MentionsCompletedSuccessfully()
    {
        Assert.Contains("completed successfully",
            MigrationStatuses.GetDescription(MigrationStatus.Migrated),
            StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void GetDescription_Deprecated_MentionsSupersededAndStillPresent()
    {
        string description = MigrationStatuses.GetDescription(MigrationStatus.Deprecated);

        Assert.Contains("superseded", description, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("still present", description, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void GetDescription_Dropped_MentionsRemoval()
    {
        Assert.Contains("removed",
            MigrationStatuses.GetDescription(MigrationStatus.Dropped),
            StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void All_ContainsExactlyTheThreeStatuses()
    {
        Assert.Equal(
            new[]
            {
                MigrationStatus.Migrated,
                MigrationStatus.Deprecated,
                MigrationStatus.Dropped,
            },
            MigrationStatuses.All);
    }

    [Fact]
    public void RequiresSeniorMaintainerApproval_Dropped_IsTrue()
    {
        Assert.True(MigrationStatuses.RequiresSeniorMaintainerApproval(MigrationStatus.Dropped));
    }

    [Theory]
    [InlineData(MigrationStatus.Migrated)]
    [InlineData(MigrationStatus.Deprecated)]
    public void RequiresSeniorMaintainerApproval_NonDropped_IsFalse(MigrationStatus status)
    {
        Assert.False(MigrationStatuses.RequiresSeniorMaintainerApproval(status));
    }

    [Fact]
    public void DroppedRequiresSeniorMaintainerApproval_ConstIsTrue()
    {
        Assert.True(MigrationStatuses.DroppedRequiresSeniorMaintainerApproval);
    }

    [Fact]
    public void GetDescription_UnknownStatus_ThrowsArgumentException()
    {
        Assert.Throws<ArgumentException>(
            () => MigrationStatuses.GetDescription((MigrationStatus)999));
    }
}
