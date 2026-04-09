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
import { dag, Container, argument, Directory, File, object, func, Secret, CacheVolume } from "@dagger.io/dagger"

const NUGET_SOURCE_GITHUB_SEGES = "https://nuget.pkg.github.com/segesdk/index.json"
const NUGET_SOURCE_PUBLIC = "https://api.nuget.org/v3/index.json"
const NUGET_SOURCE_DEFAULT_USER = "github"
const DOTNET_IMAGE = "mcr.microsoft.com/dotnet/sdk:8.0"
const SRC_FOLDER = "src"
const ARTIFACTS_FOLDER = "/artifacts"

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
  async dotnetRestore(
    @argument({ defaultPath: "/" }) root: Directory,
    githubFeedToken?: Secret,
    githubUsername: string = NUGET_SOURCE_DEFAULT_USER,
    githubFeedUrl: string = NUGET_SOURCE_GITHUB_SEGES,
  ): Promise<Container> {
    let pipeline = this.dotnetContainer(root)
    const solutions = await this.findSolutionFiles(root)
    const sources = [NUGET_SOURCE_PUBLIC]
    let addRemoveCommands = ""

    let githubSourceWasAdded = false
    if (githubFeedToken) {
      const tokenValue = await githubFeedToken.plaintext()
      if (tokenValue.length < 8) {
        throw new Error(`githubFeedToken is too short (${tokenValue.length} chars), must be at least 8 characters`)
      }
      console.log(`Restoring with GitHub PAT: ${tokenValue.slice(0, 8)}... (${tokenValue.length} chars)`)
      sources.push(githubFeedUrl)
      pipeline = pipeline.withSecretVariable("GITHUB_FEED_TOKEN", githubFeedToken)
      addRemoveCommands = [
        `if dotnet nuget list source --format short | grep -q "^github "; then`,
        `  echo "GitHub nuget source already registered, skipping add/remove"`,
        `else`,
        `  dotnet nuget add source "${githubFeedUrl}" --name github --username "${githubUsername}" --password $GITHUB_FEED_TOKEN --store-password-in-clear-text && touch /tmp/github_source_added`,
        `fi`,
      ].join("\n")
    }

    const restoreCommands = solutions
      .map(sln => {
        const sourceFlags = sources.map(s => `--source "${s}"`).join(" ")
        return `dotnet restore "${sln}" --use-lock-file ${sourceFlags}`
      })
      .join(" && ")

    const removeCommand = githubFeedToken ? "if [ -f /tmp/github_source_added ]; then dotnet nuget remove source github && rm /tmp/github_source_added; fi" : ""

    const commands = ["set -eu"]
    if (addRemoveCommands) commands.push(addRemoveCommands)
    if (restoreCommands) commands.push(restoreCommands)
    if (removeCommand) commands.push(removeCommand)

    pipeline = pipeline.withExec([
      "sh",
      "-lc",
      commands.join(" && "),
    ])

    return pipeline;
  }

  @func({ cache: "session" })
  async dotnetBuild(
    @argument({ defaultPath: "/" }) root: Directory,
    githubFeedToken?: Secret,
    githubUsername: string = NUGET_SOURCE_DEFAULT_USER,
    githubFeedUrl: string = NUGET_SOURCE_GITHUB_SEGES,
  ): Promise<Container> {
    const restoredContainer = await this.dotnetRestore(root, githubFeedToken, githubUsername, githubFeedUrl)
    const solutions = await this.findSolutionFiles(root)
    const buildCommands = solutions
      .map(sln => `dotnet build "${sln}" --no-restore -c Release`)
      .join(" && ")

    const pipeline = restoredContainer.withExec([
      "sh",
      "-lc",
      `set -eu && ${buildCommands}`,
    ])

    return pipeline;
  }

  @func({ cache: "session" })
  async dotnetPublish(
    @argument({ defaultPath: "/" }) root: Directory,
    publishConfig: File,
    githubFeedToken?: Secret,
    githubUsername: string = NUGET_SOURCE_DEFAULT_USER,
    githubFeedUrl: string = NUGET_SOURCE_GITHUB_SEGES,
  ): Promise<Directory> {
    type PublishEntry = { PackageName: string; ProjectFile: string }
    let entries: PublishEntry[]
    try {
      const content = await publishConfig.contents()
      entries = JSON.parse(content)
      if (!Array.isArray(entries)) {
        throw new Error("JSON must be an array")
      }
    } catch (e) {
      throw new Error(`Failed to parse publish config JSON: ${e instanceof Error ? e.message : String(e)}`)
    }

    const restoredContainer = await this.dotnetRestore(root, githubFeedToken, githubUsername, githubFeedUrl)
    const allCsprojFiles = await this.findCsprojRecursive(root.directory(SRC_FOLDER), SRC_FOLDER)

    const publishCommands: string[] = []
    for (const entry of entries) {
      const projectPath = allCsprojFiles.find(f => f.endsWith(`/${entry.ProjectFile}`) || f.endsWith(entry.ProjectFile))
      if (!projectPath) {
        throw new Error(`Project file "${entry.ProjectFile}" not found in ${SRC_FOLDER}. Available: ${allCsprojFiles.join(", ")}`)
      }
      const outputPath = `${ARTIFACTS_FOLDER}/${entry.PackageName}`
      publishCommands.push(`dotnet publish "${projectPath}" --no-restore -c Release --output "${outputPath}"`)
    }

    const pipeline = restoredContainer.withExec([
      "sh",
      "-lc",
      `set -eu && ${publishCommands.join(" && ")}`,
    ])

    return pipeline.directory(ARTIFACTS_FOLDER);
  }

  @func()
  async listFiles(@argument({ defaultPath: "/" }) root: Directory): Promise<string> {
    return this.dotnetContainer(root)
      .withExec(["ls", "-la"])
      .stdout()
  }

  private async findSolutionFiles(root: Directory): Promise<string[]> {
    const srcDir = root.directory(SRC_FOLDER)
    const entries = await srcDir.entries()
    const slnFiles = entries.filter((f: string) => f.endsWith(".sln"))
    const slnxFiles = entries.filter((f: string) => f.endsWith(".slnx"))
    const allSolutions = [...slnFiles, ...slnxFiles].map((f: string) => `${SRC_FOLDER}/${f}`)
    if (allSolutions.length === 0) {
      console.warn(`⚠️ No .sln or .slnx files found in /${SRC_FOLDER} folder`)
    }
    return allSolutions
  }

  private async findProjectFiles(root: Directory, projectNames: string[]): Promise<string[]> {
    const allCsprojFiles = await this.findCsprojRecursive(root.directory(SRC_FOLDER), SRC_FOLDER)
    const matchedProjects: string[] = []

    for (const projectName of projectNames) {
      const matchingProject = allCsprojFiles.find(f => f.includes(projectName))
      if (!matchingProject) {
        throw new Error(`Project "${projectName}" not found in ${SRC_FOLDER}. Available: ${allCsprojFiles.join(", ")}`)
      }
      matchedProjects.push(matchingProject)
    }

    return matchedProjects
  }

  private async findCsprojRecursive(dir: Directory, basePath: string): Promise<string[]> {
    const entries = await dir.entries()
    const results: string[] = []

    for (const entry of entries) {
      if (entry.endsWith(".csproj")) {
        results.push(`${basePath}/${entry}`)
      } else if (!entry.includes(".")) {
        try {
          const subDir = dir.directory(entry)
          const subResults = await this.findCsprojRecursive(subDir, `${basePath}/${entry}`)
          results.push(...subResults)
        } catch {
          // Not a directory, skip
        }
      }
    }

    return results
  }

  @func({ cache: "60m" })  
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
