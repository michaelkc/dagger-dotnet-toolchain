/**
 * A generated module for DaggerDotnetToolchain functions
 *
 * This module has been generated via dagger init and serves as a reference to
 * basic module structure as you get started with Dagger.
 *
 * Two functions have been pre-created. You can modify, delete, or add to them,
 * as needed. They demonstrate usage of arguments and return types using simple
 * echo and grep commands. The functions can be called from the dagger CLI or
 * from one of the SDKs.
 *
 * The first line in this comment block is a short description line and the
 * rest is a long description with more detail on the module's purpose or usage,
 * if appropriate. All modules should have a short description.
 */
import { dag, Container, argument, Directory, object, func, Secret, CacheVolume } from "@dagger.io/dagger"

const GITHUB_NUGET_SOURCE_SEGES = "https://nuget.pkg.github.com/segesdk/index.json"
const DOTNET_IMAGE = "mcr.microsoft.com/dotnet/sdk:10.0"
const PUBLIC_NUGET_SOURCE = "https://api.nuget.org/v3/index.json"

@object()
export class DaggerDotnetToolchain {
  /**
   * Returns a container that echoes whatever string argument is provided
   */
  @func()
  containerEcho(stringArg: string): Container {
    return dag.container().from("alpine:latest").withExec(["echo", stringArg])
  }

  /**
   * Returns lines that match a pattern in the files of the provided Directory
   */
  @func()
  async grepDir(directoryArg: Directory, pattern: string): Promise<string> {
    return dag
      .container()
      .from("alpine:latest")
      .withMountedDirectory("/mnt", directoryArg)
      .withWorkdir("/mnt")
      .withExec(["grep", "-R", pattern, "."])
      .stdout()
  }

  @func({ cache: "session" })
  async calVer(
    @argument({ defaultPath: "/" }) root: Directory,
    buildNumber: number = 0
  ): Promise<string> {
    const head = root.asGit().head()
    const sha = await head.commit()
    if (!/^[0-9a-f]{40}$/i.test(sha)) {
      throw new Error(`Expected git SHA, got: ${sha}`)
    }
    const branchRef = await head.ref()     // e.g. "refs/heads/main"
    const branchName = branchRef.replace(/^refs\/heads\//, "")
    const safeBranchName = branchName.replace(/[^a-zA-Z0-9._-]/g, "")
    const shortSafeBranchName = safeBranchName.length > 20 ?
      safeBranchName.slice(0, 20) :
      safeBranchName
    const now = new Date()
    const year = String(now.getUTCFullYear()).padStart(4, "0")
    const month = String(now.getUTCMonth() + 1).padStart(2, "0")
    const day = String(now.getUTCDate() + 1).padStart(2, "0")
    const shortSha = sha.slice(0, 10)
    const calVer = `${year}.${month}.${day}`
    const version = `${calVer}+branch.${shortSafeBranchName}.build.${buildNumber}.sha.${shortSha}`
    return version;
  }

  @func({ cache: "session" })
  dotnetRestore(
    @argument({ defaultPath: "/" }) root: Directory,
    solution: string = "src/sampleapp.sln",
    githubFeedToken?: Secret,
    githubUsername: string = "github",
    githubFeedUrl: string = GITHUB_NUGET_SOURCE_SEGES,
  ): Container {
    let pipeline = this.dotnetContainer(root)
    // TODO: Find slns in path
    if (githubFeedToken) {
      pipeline = pipeline
        .withSecretVariable("GITHUB_FEED_TOKEN", githubFeedToken)
        .withExec([
          "sh",
          "-lc",
          [
            "set -eu",
            `dotnet nuget add source "${githubFeedUrl}" --name dagger-github-temp --username "${githubUsername}" --password "$GITHUB_FEED_TOKEN" --store-password-in-clear-text`,
            `dotnet restore "${solution}" --source "${PUBLIC_NUGET_SOURCE}" --source "${githubFeedUrl}"`,
            "dotnet nuget remove source dagger-github-temp",
          ].join("\n"),
        ])
    } else {
      console.warn("Currently no-op.")
    }
    return pipeline;
  }

  private dotnetContainer(@argument({ defaultPath: "/" }) root: Directory): Container {
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

}
