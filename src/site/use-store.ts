import type { AnyCircuitElement } from "circuit-json"
import { create } from "zustand"

interface StoreState {
  filesAdded: Partial<Record<"kicad_mod" | "kicad_sym", string>>

  circuitJson?: AnyCircuitElement[]
}

interface StoreActions {
  updateCircuitJson: (circuitJson: AnyCircuitElement[]) => void
  addFile: (fileName: string, content: string) => void
  removeFile: (fileName: string) => void
  clearFiles: () => void
}

export const useStore = create<StoreState & StoreActions>((set) => ({
  // Initial state
  filesAdded: {},
  circuitJson: undefined,

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
}))
