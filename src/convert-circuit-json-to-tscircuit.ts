import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToTscircuit } from "circuit-json-to-tscircuit"
import type { KicadSymSchematicMetadata } from "./parse-kicad-sym-to-schematic-metadata"

interface ConvertOptions {
  componentName: string
  schematicMetadata?: KicadSymSchematicMetadata
}

const insertSchPortArrangement = (
  code: string,
  schematicMetadata: KicadSymSchematicMetadata,
) => {
  const arrangementDecl = `const schPortArrangement = ${JSON.stringify(
    schematicMetadata.schPortArrangement,
    null,
    "  ",
  )} as const\n`

  const codeWithArrangement = code.replace(
    /export const /,
    `${arrangementDecl}export const `,
  )

  if (codeWithArrangement.includes("schPortArrangement={schPortArrangement}")) {
    return codeWithArrangement
  }

  return codeWithArrangement.replace(
    /\n(\s*)\{\.\.\.props\}/,
    "\n$1schPortArrangement={schPortArrangement}\n$1{...props}",
  )
}

export const convertCircuitJsonToTscircuitWithSchematicMetadata = (
  circuitJson: AnyCircuitElement[],
  { componentName, schematicMetadata }: ConvertOptions,
) => {
  const code = convertCircuitJsonToTscircuit(circuitJson as any, {
    componentName,
    pinLabels: schematicMetadata?.pinLabels,
  })

  if (!schematicMetadata) return code

  return insertSchPortArrangement(code, schematicMetadata)
}
