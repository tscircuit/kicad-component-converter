import type { KicadSymJson, Pin } from "./kicad-zod";

interface SchematicComponent {
  type: "schematic_component"
  rotation: number
  size: { width: number; height: number }
  center: { x: number; y: number }
  source_component_id: string
  schematic_component_id: string
  pin_spacing?: number
  pin_styles?: Record<
    string,
    {
      left_margin?: number
      right_margin?: number
      top_margin?: number
      bottom_margin?: number
    }
  >
  box_width?: number
  symbol_name?: string
  port_arrangement?:
    | {
        left_size: number
        right_size: number
        top_size?: number
        bottom_size?: number
      }
    | {
        left_side?: {
          pins: number[]
          direction?: "top-to-bottom" | "bottom-to-top"
        }
        right_side?: {
          pins: number[]
          direction?: "top-to-bottom" | "bottom-to-top"
        }
        top_side?: {
          pins: number[]
          direction?: "left-to-right" | "right-to-left"
        }
        bottom_side?: {
          pins: number[]
          direction?: "left-to-right" | "right-to-left"
        }
      }
  port_labels?: Record<string, string>
}

export const convertKicadSymToTscircuitSchematic = (
  kicadSymJson: KicadSymJson,
): Pick<SchematicComponent, "port_arrangement" | "port_labels"> => {
  const { pins } = kicadSymJson

  const port_labels: Record<string, string> = {}
  for (const pin of pins) {
    port_labels[pin.num] = pin.name
  }

  const left_pins: Pin[] = []
  const right_pins: Pin[] = []
  const top_pins: Pin[] = []
  const bottom_pins: Pin[] = []

  for (const pin of pins) {
    const angle = pin.at[2]
    if (angle === 0) {
      right_pins.push(pin)
    } else if (angle === 90) {
      top_pins.push(pin)
    } else if (angle === 180) {
      left_pins.push(pin)
    } else if (angle === 270) {
      bottom_pins.push(pin)
    }
  }

  // Sort pins by position
  left_pins.sort((a, b) => a.at[1] - b.at[1]) // sort by y
  right_pins.sort((a, b) => a.at[1] - b.at[1]) // sort by y
  top_pins.sort((a, b) => a.at[0] - b.at[0]) // sort by x
  bottom_pins.sort((a, b) => a.at[0] - b.at[0]) // sort by x

  const port_arrangement: SchematicComponent["port_arrangement"] = {}

  if (left_pins.length > 0) {
    port_arrangement.left_side = {
      pins: left_pins.map((p) => parseInt(p.num, 10)),
    }
  }
  if (right_pins.length > 0) {
    port_arrangement.right_side = {
      pins: right_pins.map((p) => parseInt(p.num, 10)),
    }
  }
  if (top_pins.length > 0) {
    port_arrangement.top_side = {
      pins: top_pins.map((p) => parseInt(p.num, 10)),
    }
  }
  if (bottom_pins.length > 0) {
    port_arrangement.bottom_side = {
      pins: bottom_pins.map((p) => parseInt(p.num, 10)),
    }
  }

  return {
    port_arrangement,
    port_labels,
  }
}
