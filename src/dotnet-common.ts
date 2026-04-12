import { dag, CacheVolume, Container, Directory } from "@dagger.io/dagger"

export const DEFAULT_GITHUB_FEED_URL = "https://nuget.pkg.github.com/segesdk/index.json"
export const DEFAULT_NUGET_SOURCE = "https://api.nuget.org/v3/index.json"
export const DEFAULT_GITHUB_USERNAME = "github"
export const SRC_FOLDER = "src"
export const ARTIFACTS_FOLDER = "/artifacts"

const DOTNET_IMAGE = "mcr.microsoft.com/dotnet/sdk:8.0"

export async function findSolutionFiles(root: Directory): Promise<string[]> {
  const srcDir = root.directory(SRC_FOLDER)
  const entries = await srcDir.entries()
  const slnFiles = entries.filter((fileName: string) => fileName.endsWith(".sln"))
  const slnxFiles = entries.filter((fileName: string) => fileName.endsWith(".slnx"))
  const allSolutions = [...slnFiles, ...slnxFiles].map((fileName: string) => `${SRC_FOLDER}/${fileName}`)

  if (allSolutions.length === 0) {
    console.warn(`⚠️ No .sln or .slnx files found in /${SRC_FOLDER} folder`)
  }

  return allSolutions
}

export async function findCsprojRecursive(dir: Directory, basePath: string): Promise<string[]> {
  const entries = await dir.entries()
  const results: string[] = []

  for (const entry of entries) {
    if (entry.endsWith(".csproj")) {
      results.push(`${basePath}/${entry}`)
    } else if (!entry.includes(".")) {
      try {
        const subDir = dir.directory(entry)
        const subResults = await findCsprojRecursive(subDir, `${basePath}/${entry}`)
        results.push(...subResults)
      } catch {
        // Not a directory, skip.
      }
    }
  }

  return results
}

export function dotnetContainer(root: Directory): Container {
  const nugetPackages: CacheVolume = dag.cacheVolume("dotnet-toolchain-nuget-packages")
  const nugetHttp: CacheVolume = dag.cacheVolume("dotnet-toolchain-nuget-http")

  return dag
    .container()
    .from(DOTNET_IMAGE)
    .withMountedCache("/root/.nuget/packages", nugetPackages)
    .withMountedCache("/root/.local/share/NuGet/v3-cache", nugetHttp)
    .withDirectory("/workspace", root)
    .withWorkdir("/workspace")
    .withExec([
      "sh",
      "-lc",
      "set -eu && apt-get update && apt-get install -y --no-install-recommends git zip ca-certificates curl && rm -rf /var/lib/apt/lists/*",
    ])
}
