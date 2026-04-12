import { Directory } from "@dagger.io/dagger"

import { grepDir as grepDirImpl } from "./utilities.js"

export async function grepDir(directoryArg: Directory, pattern: string): Promise<string> {
  return grepDirImpl(directoryArg, pattern)
}
