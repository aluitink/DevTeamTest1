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

_To be filled in._

## Third-Party Dependencies

_To be filled in._

## UI Components

_To be filled in._

## Existing Tests

_To be filled in._

## Feature Parity Checklist

_To be filled in._
