import { Directory, File, Secret } from "@dagger.io/dagger"

import {
  ARTIFACTS_FOLDER,
  DEFAULT_GITHUB_FEED_URL,
  DEFAULT_GITHUB_USERNAME,
  findCsprojRecursive,
  SRC_FOLDER,
} from "./dotnet-common.js"
import { calVer } from "./cal-ver.js"
import { dotnetRestore } from "./dotnet-restore.js"

export async function dotnetPublish(
  root: Directory,
  publishConfig: File,
  githubFeedToken?: Secret,
  githubUsername: string = DEFAULT_GITHUB_USERNAME,
  githubFeedUrl: string = DEFAULT_GITHUB_FEED_URL,
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

  const version = await calVer(root)
  const restoredContainer = await dotnetRestore(root, githubFeedToken, githubUsername, githubFeedUrl)
  const allCsprojFiles = await findCsprojRecursive(root.directory(SRC_FOLDER), SRC_FOLDER)

  const publishCommands: string[] = []
  for (const entry of entries) {
    const projectPath = allCsprojFiles.find(
      (filePath) => filePath.endsWith(`/${entry.ProjectFile}`) || filePath.endsWith(entry.ProjectFile),
    )
    if (!projectPath) {
      throw new Error(`Project file "${entry.ProjectFile}" not found in ${SRC_FOLDER}. Available: ${allCsprojFiles.join(", ")}`)
    }

    const tempPath = `/tmp/publish-${entry.PackageName}`
    const outputPath = `${ARTIFACTS_FOLDER}/${entry.PackageName}`
    const zipFileName = `${entry.PackageName}.${version}.zip`
    publishCommands.push(
      `dotnet publish "${projectPath}" --no-restore -c Release --output "${tempPath}"`,
      `mkdir -p "${outputPath}"`,
      `cd "${tempPath}" && zip -r "${outputPath}/${zipFileName}" .`,
      `rm -rf "${tempPath}"`,
    )
  }

  return restoredContainer
    .withExec([
      "sh",
      "-lc",
      `set -eu && ${publishCommands.join(" && ")}`,
    ])
    .directory(ARTIFACTS_FOLDER)
}
