import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToTscircuit } from "circuit-json-to-tscircuit"

type SchematicPortArrangement = NonNullable<
  Extract<
    AnyCircuitElement,
    { type: "schematic_component" }
  >["port_arrangement"]
>

const circuitSideToTscircuitSide = {
  left_side: "leftSide",
  right_side: "rightSide",
  top_side: "topSide",
  bottom_side: "bottomSide",
} as const

const getSchematicComponent = (circuitJson: AnyCircuitElement[]) =>
  circuitJson.find((element) => element.type === "schematic_component") as
    | Extract<AnyCircuitElement, { type: "schematic_component" }>
    | undefined

const convertPortArrangementToChipProps = (
  portArrangement?: SchematicPortArrangement,
) => {
  if (!portArrangement) return undefined

  const schPortArrangement: Record<string, any> = {}
  for (const [circuitSide, tscircuitSide] of Object.entries(
    circuitSideToTscircuitSide,
  )) {
    const sideArrangement =
      portArrangement[circuitSide as keyof SchematicPortArrangement]
    if (!sideArrangement) continue
    schPortArrangement[tscircuitSide] = sideArrangement
  }

  return Object.keys(schPortArrangement).length > 0
    ? schPortArrangement
    : undefined
}

const addSchPortArrangementProp = (
  tscircuitCode: string,
  schPortArrangement?: Record<string, any>,
) => {
  if (!schPortArrangement) return tscircuitCode

  return tscircuitCode.replace(
    /<chip\n/,
    `<chip\n    schPortArrangement={${JSON.stringify(schPortArrangement, null, "  ").replace(/\n/g, "\n    ")}}\n`,
  )
}

export const convertKicadCircuitJsonToTscircuit = (
  circuitJson: AnyCircuitElement[],
  opts: { componentName: string },
) => {
  const schematicComponent = getSchematicComponent(circuitJson)
  const pinLabels = schematicComponent?.port_labels
  const schPortArrangement = convertPortArrangementToChipProps(
    schematicComponent?.port_arrangement,
  )

  const tscircuitCode = convertCircuitJsonToTscircuit(circuitJson, {
    ...opts,
    pinLabels,
  })

  return addSchPortArrangementProp(tscircuitCode, schPortArrangement)
}
