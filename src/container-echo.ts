import { Container } from "@dagger.io/dagger"

import { containerEcho as containerEchoImpl } from "./utilities.js"

export function containerEcho(stringArg: string): Container {
  return containerEchoImpl(stringArg)
}
