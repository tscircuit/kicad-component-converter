import { parseKicadModToCircuitJson } from "../../parse-kicad-mod-to-circuit-json"
import {
  readFileSync,
  readdirSync,
  writeFileSync,
  mkdirSync,
  existsSync,
} from "node:fs"
import path, { join, relative, dirname } from "node:path"
import { format } from "prettier"
import prompts from "prompts"

function normalizeFileNameToVarName(str: string) {
  return str
    .replace(/[^a-zA-Z0-9]/g, "_")
    .replace(/-([a-z])/g, (g: any) => g[1].toUpperCase())
}

async function getTsFileContentFromKicadModFile(kicadModFilePath: string) {
  const kicadModFileContent = readFileSync(kicadModFilePath, "utf-8")
  const fileNameWoExt = kicadModFilePath.split("/").pop()?.split(".")[0]

  const tsCircuitSoup = await parseKicadModToCircuitJson(kicadModFileContent)

  const varName = normalizeFileNameToVarName(fileNameWoExt!)

  const tsContent = format(
    `
export const ${varName} = ${JSON.stringify(tsCircuitSoup, null, "  ")};

export default ${varName};
  `.trim(),
    {
      parser: "typescript",
      semi: false,
    },
  )

  return tsContent
}

export const convertKicadDirectoryToTs = async (args: {
  inputDir: string
  outputDir: string
}) => {
  const { inputDir, outputDir } = args

  // Ensure output directory exists
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true })
  }

  // 0.1 If there's no package.json, we should offer to initialize and offer
  //    some options for the name of the package
  if (!existsSync(join(outputDir, "package.json"))) {
    const { packageName } = await prompts({
      name: "packageName",
      type: "text",
      message: "Enter the name of the package (e.g. mygithubname/my-package)",
    })

    // Get latest version of tscircuit
    const tscircuitPackageInfo: any = await fetch(
      "https://registry.npmjs.org/tscircuit",
    ).then((r) => r.json())
    // Get latest typescript version
    const typescriptPackageInfo: any = await fetch(
      "https://registry.npmjs.org/typescript",
    ).then((r) => r.json())

    if (!packageName.includes("/")) {
      throw new Error(
        "Package name must be in the format of 'mygithubname/my-package'",
      )
    }

    // TODO this is basically doing a simplified version of "tsci init", we
    // should just do "tsci init" in the future
    writeFileSync(
      join(outputDir, "package.json"),
      JSON.stringify(
        {
          name: `@tsci/${packageName.replace("@", "")}`,
          version: "0.0.1",
          description: "",
          main: "dist/index.cjs",
          scripts: {
            start: "npm run dev",
            dev: "tsci dev",
            build: "tsup ./index.tsx --sourcemap --dts",
            ship: "tsci publish --increment",
          },
          files: ["dist"],
          devDependencies: {
            typescript: `^${typescriptPackageInfo["dist-tags"].latest}`,
            tscircuit: `^${tscircuitPackageInfo["dist-tags"].latest}`,
          },
        },
        null,
        2,
      ),
    )

    if (!existsSync(join(outputDir, ".gitignore"))) {
      writeFileSync(
        join(outputDir, ".gitignore"),
        ["node_modules", "dist"].join("\n"),
      )
    }

    if (!existsSync(join(outputDir, ".github/workflows/tsci-publish.yml"))) {
      const { shouldCreateGithubWorkflow } = await prompts({
        name: "shouldCreateGithubWorkflow",
        type: "confirm",
        message:
          "BETA FEATURE: Create a GitHub workflow for CI/CD to autopublish to the tscircuit registry?",
      })

      mkdirSync(join(outputDir, ".github/workflows"), { recursive: true })

      if (shouldCreateGithubWorkflow) {
        writeFileSync(
          join(outputDir, ".github/workflows/tsci-publish.yml"),
          `
name: Publish to tscircuit registry
on:
  push:
    branches:
      - main
jobs:
  publish:
    runs-on: ubuntu-latest
    working-directory: ${outputDir}
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 20
          registry-url: https://registry.npmjs.org/
      - run: npm install
      - run: npm run build
      - run: npm run ship
        env:
          NODE_AUTH_TOKEN: \${{ secrets.TSCI_TOKEN }}
`.trim(),
        )
        console.log(
          "NOTE: You need to add a TSCI_TOKEN secret to your org or repo. You can generate a token from https://registry.tscircuit.com/profile",
        )
      }

      if (!existsSync(join(outputDir, "tsconfig.json"))) {
        writeFileSync(
          join(outputDir, "tsconfig.json"),
          JSON.stringify(
            {
              compilerOptions: {
                lib: ["ESNext"],
                target: "ESNext",
                module: "ESNext",
                moduleDetection: "force",
                jsx: "react-jsx",
                allowJs: true,
                types: ["@tscircuit/react-fiber"],
                baseUrl: ".",
                moduleResolution: "bundler",
                allowImportingTsExtensions: true,
                verbatimModuleSyntax: true,
                noEmit: true,
                strict: true,
                skipLibCheck: true,
                noFallthroughCasesInSwitch: true,
                noUnusedLocals: false,
                noUnusedParameters: false,
                noPropertyAccessFromIndexSignature: false,
              },
            },
            null,
            "  ",
          ),
        )
      }
    }
  }

  // 1. Deep scan directory for .kicad_mod files (usually inputDir is a .pretty dir)
  const scanDirectory = (dir: string): string[] => {
    let files: string[] = []
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        files = files.concat(scanDirectory(fullPath))
      } else if (entry.isFile() && entry.name.endsWith(".kicad_mod")) {
        files.push(fullPath)
      }
    }
    return files
  }

  const kicadModFiles = scanDirectory(inputDir).map((fpath) =>
    relative(inputDir, fpath),
  )
  console.log(`Converting ${kicadModFiles.length} kicad_mod files...`)

  // 2. Convert each kicad_mod file to ts and write to output directory with same path
  const exports = await Promise.all(
    kicadModFiles.map(async (file) => {
      const inputFilePath = join(inputDir, file)
      const outputFilePath = join(
        outputDir,
        "lib",
        `${normalizeFileNameToVarName(file).replace("_kicad_mod", ".tsx")}`,
      )
      const exampleFilePath = join(
        outputDir,
        "examples",
        `${normalizeFileNameToVarName(file).replace("_kicad_mod", ".tsx")}`,
      )

      const tsContent = await getTsFileContentFromKicadModFile(inputFilePath)

      // Ensure the directory for the output file exists
      const outputFileDir = dirname(outputFilePath)
      if (!existsSync(outputFileDir)) {
        mkdirSync(outputFileDir, { recursive: true })
      }
      const exampleFileDir = dirname(exampleFilePath)
      if (!existsSync(exampleFileDir)) {
        mkdirSync(exampleFileDir, { recursive: true })
      }

      writeFileSync(outputFilePath, tsContent)

      const varName = normalizeFileNameToVarName(file).replace("_kicad_mod", "")

      const exampleContent = `
import { ${varName} } from "../lib/${varName}"

export const ${varName}Example = () => {
  return (
    <group>
      <component footprint={${varName}} />
    </group>
  )
}
`

      writeFileSync(exampleFilePath, exampleContent)

      return {
        varName,
        relativePath: `./${relative(outputDir, outputFilePath)
          .replace(/\\/g, "/")
          .replace(/\.tsx$/, "")}`,
      }
    }),
  )

  // 3. Write an "index.tsx" file in the output directory that exports all the files
  const indexContent = exports
    .map(
      (exp) =>
        `export { default as ${exp.varName} } from '${exp.relativePath}';`,
    )
    .join("\n")

  writeFileSync(join(outputDir, "index.tsx"), indexContent)

  console.log(
    `\n"${outputDir}" is now a tscircuit project that can be published or imported.

Run "npm install" to install dependencies then...
1. Run "npm run start" inside of it to inspect all the footprints
2. Run "npm run ship" to publish it to the tscircuit registry`,
  )
}
