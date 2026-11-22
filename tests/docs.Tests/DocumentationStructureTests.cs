using System.Text.RegularExpressions;

namespace DocsTests;

/// <summary>
/// Verifies the structural integrity and required content of
/// <c>docs/migration.md</c> and <c>CONTRIBUTING.md</c> (task #56).
///
/// The test project links the documentation files in (see the
/// <c>None</c> items in docs.Tests.csproj) so the tests run against the
/// real repository files regardless of the current working directory.
/// </summary>
public class DocumentationStructureTests
{
    private const string MigrationDoc = "migration.md";
    private const string ContributingDoc = "CONTRIBUTING.md";

    private static string ReadDoc(string fileName)
    {
        var path = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, fileName));
        Assert.True(
            File.Exists(path),
            $"Expected documentation file '{fileName}' to be available to the tests at '{path}'.");
        return File.ReadAllText(path);
    }

    private static bool HasMarkdownHeading(string markdown, string title)
    {
        // Matches '#', '##', ... '######' headings whose text equals the title.
        var pattern = $@"^\s*#{{1,6}}\s+{Regex.Escape(title)}\s*$";
        return Regex.IsMatch(markdown, pattern, RegexOptions.Multiline);
    }

    // -----------------------------------------------------------------
    // docs/migration.md — required sections
    // -----------------------------------------------------------------

    [Theory]
    [InlineData("Current Status")]
    [InlineData("Migration Workflow")]
    [InlineData("Decision Log")]
    public void MigrationDocument_ContainsRequiredSection(string section)
    {
        var doc = ReadDoc(MigrationDoc);
        Assert.True(
            HasMarkdownHeading(doc, section),
            $"docs/migration.md is missing the required section heading: '{section}'");
    }

    [Fact]
    public void MigrationDocument_ContainsTrackingTableSection()
    {
        var doc = ReadDoc(MigrationDoc);
        Assert.True(
            HasMarkdownHeading(doc, "Tracking Table"),
            "docs/migration.md is missing the 'Tracking Table' section heading.");
    }

    // -----------------------------------------------------------------
    // docs/migration.md — tracking table columns
    // -----------------------------------------------------------------

    [Theory]
    [InlineData("Feature Name")]
    [InlineData("Legacy Location")]
    [InlineData("Modern Location")]
    [InlineData("Current Status")]
    [InlineData("Date Updated")]
    [InlineData("Responsible Owner")]
    [InlineData("Justification/Notes")]
    public void MigrationDocument_TrackingTableHasRequiredColumn(string column)
    {
        var doc = ReadDoc(MigrationDoc);
        var headerRow = GetTrackingTableHeaderRow(doc);
        Assert.False(
            headerRow is null,
            "docs/migration.md does not contain a tracking table header row.");
        Assert.Contains(
            column,
            SplitTableRow(headerRow!),
            StringComparer.Ordinal);
    }

    [Fact]
    public void MigrationDocument_TrackingTableHasAllRequiredColumns()
    {
        var doc = ReadDoc(MigrationDoc);
        var header = GetTrackingTableHeaderRow(doc);
        Assert.False(header is null, "docs/migration.md does not contain a tracking table header row.");

        var columns = SplitTableRow(header!);
        var required = new[]
        {
            "Feature Name",
            "Legacy Location",
            "Modern Location",
            "Current Status",
            "Date Updated",
            "Responsible Owner",
            "Justification/Notes",
        };

        var missing = required.Except(columns, StringComparer.Ordinal).ToArray();
        Assert.True(
            missing.Length == 0,
            $"Tracking table in docs/migration.md is missing required column(s): {string.Join(", ", missing)}.");
    }

    // -----------------------------------------------------------------
    // CONTRIBUTING.md — mandatory statements
    // -----------------------------------------------------------------

    [Fact]
    public void Contributing_MentionsTypeScriptStrictMode()
    {
        var doc = ReadDoc(ContributingDoc);
        Assert.Contains("strict", doc, StringComparison.OrdinalIgnoreCase);
        Assert.True(
            HasMarkdownHeading(doc, "TypeScript strict mode is mandatory")
                || Regex.IsMatch(doc, @"strict mode", RegexOptions.IgnoreCase),
            "CONTRIBUTING.md must mandate TypeScript strict mode (e.g. a 'TypeScript strict mode is mandatory' section).");
    }

    [Fact]
    public void Contributing_MentionsZod()
    {
        var doc = ReadDoc(ContributingDoc);
        Assert.Contains("Zod", doc, StringComparison.Ordinal);
        Assert.True(
            HasMarkdownHeading(doc, "Zod usage patterns"),
            "CONTRIBUTING.md is missing the 'Zod usage patterns' section heading.");
    }

    [Fact]
    public void Contributing_RequiresStrictFlagInTsconfig()
    {
        var doc = ReadDoc(ContributingDoc);
        Assert.Contains("strict: true", doc, StringComparison.Ordinal);
    }

    // -----------------------------------------------------------------
    // Cross-reference / internal-consistency checks
    // -----------------------------------------------------------------

    /// <summary>
    /// CONTRIBUTING.md must not point at TypeScript projects (or shared
    /// tsconfig files) that do not exist in the repository; its stack
    /// rules are the convention for modern projects going forward.
    /// </summary>
    [Fact]
    public void Contributing_DoesNotReferenceMissingTypeScriptProjects()
    {
        var doc = ReadDoc(ContributingDoc);
        foreach (var missing in new[]
        {
            "tsconfig.base.json",
            "src/api-responses",
            "src/lib/validation",
            "src/app/items",
        })
        {
            Assert.DoesNotContain(missing, doc, StringComparison.Ordinal);
        }

        Assert.Contains("none exist in the repository yet", doc, StringComparison.Ordinal);
    }

    /// <summary>
    /// CONTRIBUTING.md must not claim the CI pipeline enforces strict mode
    /// (the workflow only installs dependencies); strict mode is enforced
    /// through review instead.
    /// </summary>
    [Fact]
    public void Contributing_DoesNotClaimCiEnforcesStrictMode()
    {
        var doc = ReadDoc(ContributingDoc);
        Assert.DoesNotContain("The CI build fails", doc, StringComparison.Ordinal);
        Assert.Contains("blocking review comment", doc, StringComparison.Ordinal);
    }

    // -----------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------

    /// <summary>
    /// Returns the first markdown table header row that contains the
    /// tracking-table columns "Feature Name" and "Current Status".
    /// </summary>
    private static string? GetTrackingTableHeaderRow(string doc)
    {
        foreach (var line in doc.Split('\n'))
        {
            var trimmed = line.Trim();
            if (trimmed.StartsWith("|") && trimmed.EndsWith("|") && trimmed.Length > 2
                && trimmed.Contains("Feature Name")
                && trimmed.Contains("Current Status"))
            {
                return trimmed;
            }
        }

        return null;
    }

    /// <summary>Splits a markdown table row into trimmed cell values.</summary>
    private static List<string> SplitTableRow(string row)
    {
        // Drop the leading/trailing pipes, split on the remaining ones.
        var inner = row.Trim().Trim('|');
        return inner
            .Split('|')
            .Select(cell => cell.Trim())
            .Where(cell => cell.Length > 0)
            .ToList();
    }
}
