# Codebase Audit

This document is a living audit of the repository. Sections are filled in by
subsequent tasks.

## Routes

None. This repository is a .NET 10 console application. There is no
frontend, no UI framework, and no routing configuration.

The application entry point is `hello/Program.cs`
(`Program.Main(string[] args)`), which reads an optional command-line
argument and prints a greeting to standard output. It has no URL paths,
pages, components, route guards, or route parameters.

## API Endpoints

None. The repository contains no HTTP server, no web framework
(ASP.NET Core / Minimal API), and no REST or GraphQL endpoints.

The only programmatic interface is a single public method:

| Method | Signature | File | Description |
| --- | --- | --- | --- |
| `Greet` | `string Greet(string name)` | `Greeter/Greeter.cs` | Returns the greeting string `"Hello, {name}!"` for the given name. |

This method is invoked directly in-process (not over a network protocol);
it is not an HTTP endpoint.

## Database Entities

None. The repository has no data persistence layer.

- There are no ORM entities, POCO models mapped to database tables, or
  EF Core `DbContext` classes.
- No connection strings, migration files, or `.sql`/schema files exist.
- No files are read from or written to disk; the only input is an optional
  command-line argument and the only output is a single line printed to
  standard output.

The only types defined in the codebase are:

| Type | Kind | Fields | Relationships | File |
| --- | --- | --- | --- | --- |
| `Greeter.Greeter` | Plain class (not an entity) | none (stateless) | none | `Greeter/Greeter.cs` |
| `Program` | Static console entry point | `_greeter` (static field, `Greeter.Greeter`) | references `Greeter.Greeter` in-process | `hello/Program.cs` |

No migrations exist.

## Third-Party Dependencies

All external packages are NuGet packages (no `package.json`,
`requirements.txt`, `go.mod`, etc.). They appear only in the two test
projects; the `Greeter` library and `hello` console app reference no
external packages at all.

### Test framework & tooling

| Package | Version | Used in | Category | Purpose |
| --- | --- | --- | --- | --- |
| `xunit` | 2.9.3 | `Greeter.Tests`, `hello.Tests` | Testing | xUnit unit-testing framework (assertions, test discovery attributes). |
| `xunit.runner.visualstudio` | 3.1.4 | `Greeter.Tests`, `hello.Tests` | Testing | Adapter that runs xUnit tests under the VSTest runner (e.g. `dotnet test`). |
| `Microsoft.NET.Test.Sdk` | 17.14.1 | `Greeter.Tests`, `hello.Tests` | Testing | Microsoft test platform (VSTest) SDK that hosts and reports test execution. |
| `coverlet.collector` | 6.0.4 | `Greeter.Tests`, `hello.Tests` | Testing / coverage | Collects code-coverage data (e.g. via VS/VS Code coverage tools) when tests run. |

### Framework

Both test projects and the application target the **.NET 10**
(`net10.0`) shared framework, supplied by the runtime/SDK rather than as a
package reference.

### Internal project references (not third-party, listed for completeness)

| Reference | Referenced by | Purpose |
| --- | --- | --- |
| `Greeter` (project) | `hello`, `Greeter.Tests`, `hello.Tests` (transitively) | The greeting library under test. |
| `hello` (project) | `hello.Tests` | The console app, referenced by integration tests to build/copy its output assembly. |

### Package sources

`NuGet.Config` uses `nuget.org` (`https://api.nuget.org/v3/index.json`) and
stores the global package cache at `/workspace/nuget/packages`.

## UI Components

None. This repository is a .NET 10 **console application**; it contains no
graphical or web UI, no UI framework (WinForms, WPF, Blazor, ASP.NET Core
MVC/Razor, MAUI, Avalonia, etc.), and no frontend assets (no `.razor`,
`.cshtml`, `.xaml`, `.html`, `.css`, or `.js` files).

### Identified components

There are **no reusable UI components** to document — no buttons, forms,
cards, modals, views, or widgets exist anywhere in the codebase. The only
"interface" is plain text written to the console:

| Component | Kind | File | Description |
| --- | --- | --- | --- |
| *(none)* | — | — | No UI components exist. |

### Interactivity

There is no user interaction beyond the command line:

- **Input:** an optional single command-line argument (`args[0]`) read once
  at startup by `Program.Main(string[] args)` in `hello/Program.cs`. There
  are no click handlers, key bindings, form submissions, or event
  subscriptions.
- **State changes:** the only state is a `static readonly` `Greeter.Greeter`
  field (a stateless string formatter). No reactive state, view models, or
  observable properties exist.
- **Output:** a single line (`"Hello, {name}!"`, or `"Hello, World!"` when no
  argument is supplied) printed via `Console.WriteLine`.
- **API calls triggered:** none. `Greet` is called in-process; no HTTP
  client, WebSocket, or other network calls are made, and no side effects
  (file I/O, database writes) occur.
- **Process lifetime:** the process runs `Main` once and exits immediately;
  there is no event loop, message pump, or window lifecycle.

The test suite (`HelloAppIntegrationTests`) exercises this "interface" by
launching the compiled console app as a subprocess and asserting on its
stdout; it confirms the only observable behavior is the greeting text line.

## Existing Tests

_To be filled in._

## Feature Parity Checklist

_To be filled in._
