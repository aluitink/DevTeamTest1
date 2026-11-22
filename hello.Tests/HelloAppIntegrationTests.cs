using System.Diagnostics;
using System.Text;

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

        // Read stdout and stderr concurrently. If only stdout were drained
        // synchronously (ReadToEnd), any data the child writes to stderr
        // could fill the OS pipe buffer and block the child, causing
        // ReadToEnd() on stdout to deadlock. Using the output event handlers
        // keeps both streams drained on the async pump thread.
        var stdout = new StringBuilder();
        var stderr = new StringBuilder();
        var stdoutDone = new ManualResetEventSlim(false);
        var stderrDone = new ManualResetEventSlim(false);

        process.OutputDataReceived += (_, e) =>
        {
            if (e.Data is null)
            {
                stdoutDone.Set();
            }
            else
            {
                lock (stdout)
                {
                    stdout.AppendLine(e.Data);
                }
            }
        };
        process.ErrorDataReceived += (_, e) =>
        {
            if (e.Data is null)
            {
                stderrDone.Set();
            }
            else
            {
                lock (stderr)
                {
                    stderr.AppendLine(e.Data);
                }
            }
        };

        process.BeginOutputReadLine();
        process.BeginErrorReadLine();

        process.WaitForExit();

        // Ensure both streams are fully drained before reading them.
        stdoutDone.Wait();
        stderrDone.Wait();

        string output;
        lock (stdout)
        {
            output = stdout.ToString();
        }

        string error;
        lock (stderr)
        {
            error = stderr.ToString();
        }

        // If the app failed (non-zero exit or stderr content), fail the test
        // with diagnostic information.
        Assert.True(string.IsNullOrWhiteSpace(error), $"hello app wrote to stderr: {error}");
        Assert.True(process.ExitCode == 0, $"hello app exited with code {process.ExitCode}: {error}");

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
