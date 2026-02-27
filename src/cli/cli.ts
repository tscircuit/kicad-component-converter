#!/usr/bin/env node
import { program } from "commander"
import { perfectCli } from "perfect-cli"
import { convertKicadDirectoryToTs } from "./cmds"
import { PARAM_HANDLERS_BY_PARAM_NAME } from "./param-handlers"
import type { ParamHandler } from "./param-handlers/param-handler-type"

program.name("kicad-mod-converter")

program
  .command("convert-kicad-directory")
  .requiredOption("--input-dir <input>", "Input directory")
  .requiredOption("--output-dir <output>", "Output directory")
  .action((opts) => convertKicadDirectoryToTs(opts))

perfectCli(program, process.argv, {
  async customParamHandler({ commandPath, optionName }, { prompts }) {
    const optionNameHandler: ParamHandler | undefined =
      PARAM_HANDLERS_BY_PARAM_NAME[optionName.replace(/-/g, "_")]

    if (optionNameHandler) {
      return optionNameHandler({
        commandPath,
        optionName,
        prompts,
        ctx: undefined,
      })
    }
  },
})
