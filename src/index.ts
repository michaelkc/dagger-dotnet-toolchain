/**
 * A generated module for DaggerDotnetToolchain functions
 *
 * This module has been generated via dagger init and serves as a reference to
 * basic module structure as you get started with Dagger.
 */
import {
  argument,
  Container,
  Directory,
  File,
  func,
  object,
  Secret,
} from "@dagger.io/dagger"

import { DEFAULT_GITHUB_FEED_URL, DEFAULT_GITHUB_USERNAME } from "./dotnet-common.js"
import { calVer } from "./cal-ver.js"
import { containerEcho } from "./container-echo.js"
import { dotnetBuild } from "./dotnet-build.js"
import { dotnetPublish } from "./dotnet-publish.js"
import { dotnetRestore } from "./dotnet-restore.js"
import { grepDir } from "./grep-dir.js"
import { listFiles } from "./list-files.js"

@object()
export class DaggerDotnetToolchain {
  @func()
  containerEcho(stringArg: string): Container {
    return containerEcho(stringArg)
  }

  @func()
  async grepDir(directoryArg: Directory, pattern: string): Promise<string> {
    return grepDir(directoryArg, pattern)
  }

  @func({ cache: "session" })
  async calVer(
    @argument({ defaultPath: "/" }) root: Directory,
    buildNumber: number = 0,
  ): Promise<string> {
    return calVer(root, buildNumber)
  }

  @func({ cache: "session" })
  async dotnetRestore(
    @argument({ defaultPath: "/" }) root: Directory,
    githubFeedToken?: Secret,
    githubUsername: string = DEFAULT_GITHUB_USERNAME,
    githubFeedUrl: string = DEFAULT_GITHUB_FEED_URL,
  ): Promise<Container> {
    return dotnetRestore(root, githubFeedToken, githubUsername, githubFeedUrl)
  }

  @func({ cache: "session" })
  async dotnetBuild(
    @argument({ defaultPath: "/" }) root: Directory,
    githubFeedToken?: Secret,
    githubUsername: string = DEFAULT_GITHUB_USERNAME,
    githubFeedUrl: string = DEFAULT_GITHUB_FEED_URL,
  ): Promise<Container> {
    return dotnetBuild(root, githubFeedToken, githubUsername, githubFeedUrl)
  }

  @func({ cache: "session" })
  async dotnetPublish(
    @argument({ defaultPath: "/" }) root: Directory,
    publishConfig: File,
    githubFeedToken?: Secret,
    githubUsername: string = DEFAULT_GITHUB_USERNAME,
    githubFeedUrl: string = DEFAULT_GITHUB_FEED_URL,
  ): Promise<Directory> {
    return dotnetPublish(root, publishConfig, githubFeedToken, githubUsername, githubFeedUrl)
  }

  @func()
  async listFiles(@argument({ defaultPath: "/" }) root: Directory): Promise<string> {
    return listFiles(root)
  }
}
