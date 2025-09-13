import { readdirSync, writeFileSync } from "node:fs"
import { join, extname, basename } from "node:path"

const KICAD_DIR = "kicad-footprints"
const OUTPUT_FILE = "tests/fixtures/kicad-file-paths.ts"

function getAllKicadModBaseNames(): string[] {
  // Each kicad file is nested, i.e. kicad-footprints/*.pretty/*.kicad_mod
  let dirents: any[]
  try {
    dirents = readdirSync(KICAD_DIR, { withFileTypes: true })
  } catch (err) {
    throw new Error(
      `Could not read ${KICAD_DIR}. Did you run \"npm run test:pull-kicad-footprints\"?`,
    )
  }

  const files = dirents.flatMap((dirent) => {
    if (dirent.isDirectory() && dirent.name.endsWith(".pretty")) {
      const nestedDir = join(KICAD_DIR, dirent.name)
      try {
        return readdirSync(nestedDir)
          .filter((file) => extname(file) === ".kicad_mod")
          .map((file) => basename(file))
      } catch (e) {
        return []
      }
    }
    return []
  })

  // Deduplicate and sort for stable output
  return Array.from(new Set(files)).sort((a, b) => a.localeCompare(b))
}

function generateFileContents(fileNames: string[]): string {
  const header = "export const kicadFilePaths = [\n"
  const body = fileNames.map((f) => `  \"${f}\",`).join("\n")
  const footer =
    "] as const\n\nexport type KicadFileName = (typeof kicadFilePaths)[number]\n"
  return `${header}\n${body}\n${footer}`
}

const names = getAllKicadModBaseNames()
const contents = generateFileContents(names)
writeFileSync(OUTPUT_FILE, contents)
console.log(
  `Wrote ${names.length} entries to ${OUTPUT_FILE} (type KicadFileName updated).`,
)
