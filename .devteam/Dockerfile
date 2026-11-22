# Shared development environment for all developer agents.
# .NET 10 (LTS) solution: console app + xUnit test project (dotnet build / dotnet test).
#
# The repository is mounted at /workspace at runtime and the container runs as a
# non-root user with HOME=/tmp, so nothing from the repo is copied in and no
# USER is set here.

FROM mcr.microsoft.com/dotnet/sdk:10.0

ARG DEBIAN_FRONTEND=noninteractive

# Minimal system tooling needed for building and running the repo.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        git \
        tzdata \
    && rm -rf /var/lib/apt/lists/*

# Keep agent runs quiet and hermetic (no first-run experience, no telemetry).
ENV DOTNET_NOLOGO=1 \
    DOTNET_CLI_TELEMETRY_OPTOUT=1 \
    DOTNET_SKIP_FIRST_TIME_EXPERIENCE=1 \
    NUGET_PACKAGES=/tmp/.nuget \
    NUGET_XMLDOC_MODE=skip

# Pre-warm the global NuGet cache with the exact package versions the
# solution restores (plus the SDK's own tooling packages), so agent builds
# are fast and work even with limited network access.
RUN mkdir -p /tmp/warm && cd /tmp/warm \
    && dotnet new console -n warm -o warm --framework net10.0 \
    && cd warm \
    && dotnet add package Microsoft.NET.Test.Sdk --version 17.14.1 \
    && dotnet add package xunit --version 2.9.3 \
    && dotnet add package xunit.runner.visualstudio --version 3.1.4 \
    && dotnet add package coverlet.collector --version 6.0.4 \
    && dotnet restore \
    && cd / \
    && rm -rf /tmp/warm

WORKDIR /workspace
