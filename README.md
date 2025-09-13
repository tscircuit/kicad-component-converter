# kicad-component-converter

This module converts kicad files into a [circuit json](https://github.com/tscircuit/circuit-json), an easy-to-use JSON format for electronics or [tscircuit code](https://github.com/tscircuit/tscircuit).

1. [Library Usage](#library-usage)
2. [CLI Usage](#cli-usage)

## Library Usage

```bash
npm add kicad-component-converter
```

```ts
import { parseKicadModToTscircuitSoup } from "kicad-component-converter"
import { readFileSync } from "node:fs"

const fileContent = readFileSync("SW_SP3T_PCM13.kicad_mod")
const circuitJson = await parseKicadModToTscircuitSoup(fileContent)
/*
 * {
 *   "type": "pcb_smtpad",
 *   "x": 0.345,
 *   ...
 */
```

You can also output "kicad json", an intermediary JSON format that more closely resembles the original kicad sexpr.

```ts
import { parseKicadModToKicadJson } from "kicad-mod-converter"

const kicadJson = parseKicadModToKicadJson(
  readFileSync("SW_SP3T_PCM13.kicad_mod")
)
/*
 * {
 *    footprint_name: "...",
 *    fp_lines: [
 *      { start: [0, 0], end: [20, 4], stroke: { width: 0.1 } }
 *    ...
 */
```

## CLI Usage

```bash
npm install -g kicad-mod-converter
```

```bash
# interactive usage
kicad-mod-converter
```

```bash
# Convert a directory ./my-footprints.pretty to a tscircuit project
kicad-mod-converter convert-kicad-directory --input-dir ./my-footprints.pretty --output-dir ./my-tscircuit-footprints
```

You can now go inside `./my-tscircuit-footprints` and run `npm i` and `npm run start` to
view all your footprints!

### Using the Converted Kicad Directory

> [!NOTE]
> You should publish the generated library to the tscircuit registry! Just run `tsci publish` inside the directory!
>
> You can then use `tsci add yourgithubusername/package-name`

```tsx
import { Battery_CR1225 } from "./my-tscircuit-footprints"

export default () => (
  <group>
    <component footprint={Battery_CR1225} />
  </group>
)
```

## Development

You should read about the [kicad sexpr syntax](https://dev-docs.kicad.org/en/file-formats/sexpr-intro/) to understand how to read the footprint files.

There are tests in this repo, take a look in the `tests` directory to see how they work.

> [!NOTE]
> You'll need to pull the kicad-footprints official repo before you can run the
> tests, you can do this by running `npm run test:pull-kicad-footprints`

### CLI Testing

You can test the cli by running `npm run cli`.

If you want to test conversion of a kicad directory, run `npm run cli:test-convert`
