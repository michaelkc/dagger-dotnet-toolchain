import { dag, Container, Directory } from "@dagger.io/dagger"

export function containerEcho(stringArg: string): Container {
  return dag.container().from("alpine:latest").withExec(["echo", stringArg])
}

export async function grepDir(directoryArg: Directory, pattern: string): Promise<string> {
  return dag
    .container()
    .from("alpine:latest")
    .withMountedDirectory("/mnt", directoryArg)
    .withWorkdir("/mnt")
    .withExec(["grep", "-R", pattern, "."])
    .stdout()
}
