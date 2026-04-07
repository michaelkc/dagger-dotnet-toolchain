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
import { dag, Container, Directory, object, func } from "@dagger.io/dagger"

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
  async calVer(gitDirectory: Directory, buildNumber: number): Promise<string> {
    const head = gitDirectory.asGit().head()
    const sha = await head.commit()
    if (!/^[0-9a-f]{40}$/i.test(sha)) {
      throw new Error(`Expected git SHA, got: ${sha}`)
    }
    const now = new Date()
    const year = String(now.getUTCFullYear()).padStart(4, "0")
    const month = String(now.getUTCMonth() + 1).padStart(2, "0")
    const day = String(now.getUTCDate() + 1).padStart(2, "0")
    const shortSha = sha.slice(0, 10)
    const calVer = `${year}.${month}.${day}`
    const version = `${calVer}+sha.${shortSha}`
    return version;
  }
}
