# DevTeamTest1

This repository is in the middle of a core migration. See
[`docs/migration.md`](docs/migration.md) for the migration status, workflow,
and decision log.

- [Contributing Guidelines](CONTRIBUTING.md) — modern stack conventions
  (TypeScript strict mode, Zod validation), and the pull request process
  for migration-related work.
- [Codebase Audit](docs/audit.md) — routes, API endpoints, database
  entities, UI components, and existing tests.
- [Migration Statuses](docs/migration/statuses.md) — the `migrated`,
  `deprecated`, and `dropped` lifecycle states.

## Environment variables

This repository does not require any mandatory environment variables to
build, run, or test — the console app reads only an optional command-line
argument. All supported variables are optional and have the same default
values in every environment, so `.env.example` documents them with the
values the project ships with (see the shared development image in
`.devteam/Dockerfile`).

Copy `.env.example` to `.env` as a starting point:

```bash
cp .env.example ./.env
```

Never commit a real `.env` file or its values to the repository.

The variables defined in [`.env.example`](.env.example) and their purpose:

| Variable | Example value | Required? | Purpose |
| --- | --- | --- | --- |
| `DOTNET_NOLOGO` | `1` | No | Suppresses the .NET copyright/logo banner printed to the console by .NET apps and tools. |
| `DOTNET_CLI_TELEMETRY_OPTOUT` | `1` | No | Disables .NET CLI usage telemetry so builds and test runs stay hermetic and do not make network calls. |
| `DOTNET_SKIP_FIRST_TIME_EXPERIENCE` | `1` | No | Skips the .NET first-time experience prompts (welcome screen, license text) during CLI use. |
| `NUGET_PACKAGES` | `/workspace/nuget/packages` | No | Location of the global NuGet package cache. Keep in sync with `globalPackagesFolder` in `NuGet.Config`; the dev image pre-warms this cache to keep builds fast. |
| `NUGET_XMLDOC_MODE` | `skip` | No | Instructs the NuGet/dotnet build pipeline to skip XML documentation file generation for faster builds. |
| `GREETING_DEFAULT_NAME` | `World` | No | Default greeting subject used when `hello` is run without arguments. Currently informational: `hello/Program.cs` falls back to `"World"` and does not read this variable yet. |

To apply the variables from `.env` in a shell, export them before running
the app:

```bash
set -a; . ./.env; set +a
dotnet run --project hello
```

When new environment variables are added to the project (for example, a
future configuration switch), add them to `.env.example` and to the table
above in the same pull request.
