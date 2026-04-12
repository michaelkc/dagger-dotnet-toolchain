import { Container, Directory, Secret } from "@dagger.io/dagger"

import {
  DEFAULT_GITHUB_FEED_URL,
  DEFAULT_GITHUB_USERNAME,
  findSolutionFiles,
} from "./dotnet-common.js"
import { dotnetRestore } from "./dotnet-restore.js"

export async function dotnetBuild(
  root: Directory,
  githubFeedToken?: Secret,
  githubUsername: string = DEFAULT_GITHUB_USERNAME,
  githubFeedUrl: string = DEFAULT_GITHUB_FEED_URL,
): Promise<Container> {
  const restoredContainer = await dotnetRestore(root, githubFeedToken, githubUsername, githubFeedUrl)
  const solutions = await findSolutionFiles(root)
  const buildCommands = solutions
    .map((sln) => `dotnet build "${sln}" --no-restore -c Release`)
    .join(" && ")

  return restoredContainer.withExec([
    "sh",
    "-lc",
    `set -eu && ${buildCommands}`,
  ])
}
