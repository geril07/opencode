export * as NpmConfig from "./npm-config"

import path from "path"
import { createRequire } from "module"
import { fileURLToPath } from "url"
// @ts-expect-error npm does not publish types for this internal config API.
import Config from "@npmcli/config"
// @ts-expect-error npm does not publish types for this internal config API.
import { definitions, flatten, nerfDarts, shorthands } from "@npmcli/config/lib/definitions/index.js"
import { Effect } from "effect"
import * as Log from "@opencode-ai/core/util/log"

const log = Log.create({ service: "npm-config" })

const npmPath = (() => {
  try {
    // Resolve npm from the system Node.js installation (where npm is bundled).
    // Using createRequire with process.execPath gives us access to system modules.
    const systemRequire = createRequire(process.execPath + "/")
    const pkg = systemRequire.resolve("npm/package.json")
    return path.dirname(pkg)
  } catch {
    log.warn("could not resolve system npm, falling back to opencode path")
    return fileURLToPath(new URL("..", import.meta.url))
  }
})()

export const load = (dir: string) =>
  Effect.tryPromise({
    try: async () => {
      const config = new Config({
        npmPath,
        cwd: dir,
        env: { ...process.env },
        argv: [process.execPath, process.execPath],
        execPath: process.execPath,
        platform: process.platform,
        definitions,
        flatten,
        nerfDarts,
        shorthands,
        warn: false,
      })
      await config.load()
      return config.flat as Record<string, unknown>
    },
    catch: (cause) => cause,
  }).pipe(Effect.orElseSucceed(() => ({}) as Record<string, unknown>))

export const registry = (dir: string) =>
  load(dir).pipe(
    Effect.map((config) => {
      const registry = typeof config.registry === "string" ? config.registry : "https://registry.npmjs.org"
      return registry.endsWith("/") ? registry.slice(0, -1) : registry
    }),
  )
