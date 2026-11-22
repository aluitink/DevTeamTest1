using System.Diagnostics;

namespace hello.Tests;

public class HelloAppIntegrationTests
{
    private static string RunApp(params string[] args)
    {
        // The test assembly is loaded by the dotnet test host. Locate the
        // compiled hello app (hello.dll) that was copied next to it, then
        // run it with "dotnet <app.dll> [arg...]".
        string assemblyLocation = typeof(HelloAppIntegrationTests).Assembly.Location;
        string testDir = Path.GetDirectoryName(assemblyLocation)!;
        string appDll = Path.Combine(testDir, "hello.dll");
        Assert.True(File.Exists(appDll), $"hello.dll not found at {appDll}.");

        using var process = new Process
        {
            StartInfo = new ProcessStartInfo
            {
                FileName = "dotnet",
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
            }
        };

        process.StartInfo.ArgumentList.Add(appDll);
        foreach (string arg in args)
        {
            process.StartInfo.ArgumentList.Add(arg);
        }

        Assert.True(process.Start(), "Failed to start the hello application.");
        string output = process.StandardOutput.ReadToEnd();
        process.WaitForExit();

        return output.Trim();
    }

    [Fact]
    public void HelloApp_WithArgument_Alice_Prints_Hello_Alice()
    {
        Assert.Equal("Hello, Alice!", RunApp("Alice"));
    }

    [Fact]
    public void HelloApp_WithoutArguments_Prints_Hello_World()
    {
        Assert.Equal("Hello, World!", RunApp());
    }
}
