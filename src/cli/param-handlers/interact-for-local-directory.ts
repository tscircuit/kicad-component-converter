import * as fs from "node:fs/promises"
import type { ParamHandler } from "./param-handler-type"

export const interactForLocalDirectory: ParamHandler = async ({ prompts }) => {
  const { selectionMode } = await prompts({
    type: "select",
    name: "selectionMode",
    message: "Select a directory",
    choices: [
      { title: "Manually Enter Path", value: "manual" },
      { title: "Browse for Directory", value: "browse" },
    ],
  })

  if (selectionMode === "manual") {
    const { manualPath } = await prompts({
      type: "text",
      name: "manualPath",
      message: "Enter the path to the directory",
    })
    return manualPath
  }

  let currentDirectory = "."
  while (true) {
    const files = await fs.readdir(currentDirectory)
    const dirChoices = files
      .filter((d) => !d.includes("."))
      .map((file) => ({ title: file, value: file }))
    const { selectedDir } = await prompts({
      type: "autocomplete",
      name: "selectedDir",
      message: "Select a directory",
      initial: "__select__",
      choices: [
        { title: ".. (Go Up)", value: ".." },
        { title: `["${currentDirectory}"]`, value: "__select__" },
        ...dirChoices,
      ],
    })
    if (selectedDir === "..") {
      // Go up one directory
      const lastIndex = currentDirectory.lastIndexOf("/")
      currentDirectory = currentDirectory.substring(0, lastIndex)
    } else if (selectedDir === "__select__") {
      return currentDirectory
    } else {
      // Check if selectedFile is a file or directory
      const stats = await fs.stat(`${currentDirectory}/${selectedDir}`)
      if (stats.isFile()) {
        throw new Error("Selected file is a file, not a directory")
      }

      // Go into the selected directory
      currentDirectory = `${currentDirectory}/${selectedDir}`
    }
  }
}
