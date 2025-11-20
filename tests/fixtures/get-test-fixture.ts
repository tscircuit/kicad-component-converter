import type { KicadFileName } from "./kicad-file-paths"
import { readFileSync } from "node:fs"
import { readdirSync } from "node:fs"
import { join } from "node:path"

const kicadDir = join(import.meta.dirname, "kicad-footprints")

const cache: any = {}

export const getTestFixture = () => {
  return {
    getAllKicadFiles() {
      if (cache.kicadFileList) return cache.kicadFileList as string[]

      // Each kicad file is nested, i.e. kicad-footprints/*.pretty/*.kicad_mod
      const files = readdirSync(kicadDir, { withFileTypes: true }).flatMap(
        (dirent) => {
          if (dirent.isDirectory() && dirent.name.endsWith(".pretty")) {
            const nestedDir = join(kicadDir, dirent.name)
            return readdirSync(nestedDir)
              .filter((file) => file.endsWith(".kicad_mod"))
              .map((file) => join(dirent.name, file))
          }
          return []
        },
      )
      cache.kicadFileList = files
      return files
    },

    getKicadFilePath(fname: KicadFileName) {
      const files = this.getAllKicadFiles()
      const filePath = files.find((file) => file.endsWith(fname))
      return join(kicadDir, filePath!)
    },

    getKicadFile(fname: KicadFileName) {
      return readFileSync(this.getKicadFilePath(fname), "utf-8")
    },
  }
}
