import { Container, Directory, Secret } from "@dagger.io/dagger"

import {
  DEFAULT_GITHUB_FEED_URL,
  DEFAULT_GITHUB_USERNAME,
  DEFAULT_NUGET_SOURCE,
  dotnetContainer,
  findSolutionFiles,
} from "./dotnet-common.js"

export async function dotnetRestore(
  root: Directory,
  githubFeedToken?: Secret,
  githubUsername: string = DEFAULT_GITHUB_USERNAME,
  githubFeedUrl: string = DEFAULT_GITHUB_FEED_URL,
): Promise<Container> {
  let pipeline = dotnetContainer(root)
  const solutions = await findSolutionFiles(root)
  const sources = [DEFAULT_NUGET_SOURCE]
  let addRemoveCommands = ""

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
    .map((sln) => {
      const sourceFlags = sources.map((source) => `--source "${source}"`).join(" ")
      return `dotnet restore "${sln}" --use-lock-file ${sourceFlags}`
    })
    .join(" && ")

  const removeCommand = githubFeedToken
    ? "if [ -f /tmp/github_source_added ]; then dotnet nuget remove source github && rm /tmp/github_source_added; fi"
    : ""

  const commands = ["set -eu"]
  if (addRemoveCommands) commands.push(addRemoveCommands)
  if (restoreCommands) commands.push(restoreCommands)
  if (removeCommand) commands.push(removeCommand)

  return pipeline.withExec([
    "sh",
    "-lc",
    commands.join(" && "),
  ])
}
