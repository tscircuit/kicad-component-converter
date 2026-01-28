import type { AnyCircuitElement } from "circuit-json"
import { create } from "zustand"
import type { ParsedKicadSymbol } from "../parse-kicad-sym-to-circuit-json"

interface StoreState {
  filesAdded: Partial<Record<"kicad_mod" | "kicad_sym", string>>
  circuitJson?: AnyCircuitElement[]
  tscircuitCode?: string
  parsedSymbols?: ParsedKicadSymbol[]
  selectedSymbolIndex: number
}

interface StoreActions {
  updateCircuitJson: (circuitJson: AnyCircuitElement[]) => void
  updateTscircuitCode: (code: string) => void
  addFile: (fileName: string, content: string) => void
  removeFile: (fileName: string) => void
  clearFiles: () => void
  reset: () => void
  setParsedSymbols: (symbols: ParsedKicadSymbol[]) => void
  setSelectedSymbolIndex: (index: number) => void
}

export const useStore = create<StoreState & StoreActions>((set) => ({
  // Initial state
  filesAdded: {},
  circuitJson: undefined,
  tscircuitCode: undefined,
  parsedSymbols: undefined,
  selectedSymbolIndex: 0,

  // Actions
  addFile: (fileName, content) =>
    set((state) => ({
      filesAdded: { ...state.filesAdded, [fileName]: content },
    })),

  removeFile: (fileName) =>
    set((state) => {
      const { [fileName]: _, ...rest } = state.filesAdded as Record<
        string,
        string
      >
      return { ...state, filesAdded: rest }
    }),

  clearFiles: () => set({ filesAdded: {} }),

  updateCircuitJson: (circuitJson) => set({ circuitJson }),

  updateTscircuitCode: (code) => set({ tscircuitCode: code }),

  setParsedSymbols: (symbols) => set({ parsedSymbols: symbols }),

  setSelectedSymbolIndex: (index) => set({ selectedSymbolIndex: index }),

  reset: () =>
    set({
      filesAdded: {},
      circuitJson: undefined,
      tscircuitCode: undefined,
      parsedSymbols: undefined,
      selectedSymbolIndex: 0,
    }),
}))
