import { Directory } from "@dagger.io/dagger"

import { dotnetContainer } from "./dotnet-common.js"

export async function listFiles(root: Directory): Promise<string> {
  return dotnetContainer(root)
    .withExec(["ls", "-la"])
    .stdout()
}
