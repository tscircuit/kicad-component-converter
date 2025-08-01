import { useCallback, useState, useRef } from "react";
import { useStore } from "./use-store";
import { Download, FileSearch } from "lucide-react";
import { parseKicadModToCircuitJson } from "src/parse-kicad-mod-to-circuit-json";
import { parseKicadFilesToCircuitJson } from "src/parse-kicad-files-to-circuit-json";
import { CircuitJsonPreview } from "@tscircuit/runframe";
import { convertCircuitJsonToTscircuit } from "circuit-json-to-tscircuit";
import { createSnippetUrl } from "@tscircuit/create-snippet-url";

export const App = () => {
  const [error, setError] = useState<string | null>(null);
  const filesAdded = useStore((s) => s.filesAdded);
  const addFile = useStore((s) => s.addFile);
  const reset = useStore((s) => s.reset);
  const updateCircuitJson = useStore((s) => s.updateCircuitJson);
  const circuitJson = useStore((s) => s.circuitJson);
  const updateTscircuitCode = useStore((s) => s.updateTscircuitCode);
  const tscircuitCode = useStore((s) => s.tscircuitCode);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  const handleProcessAndViewFiles = useCallback(async () => {
    if (!filesAdded.kicad_mod) {
      setError("No KiCad Mod file added");
      return;
    }
    setError(null);
    let circuitJson: any;
    try {
      // Use the new combined parser that handles both kicad_mod and kicad_sym
      circuitJson = await parseKicadFilesToCircuitJson({
        kicad_mod: filesAdded.kicad_mod,
        kicad_sym: filesAdded.kicad_sym,
      });
      updateCircuitJson(circuitJson as any);
    } catch (err: any) {
      setError(`Error parsing KiCad files: ${err.toString()}`);
      return;
    }

    try {
      // Now we convert the circuit json to tscircuit
      const tscircuit = convertCircuitJsonToTscircuit(circuitJson, {
        componentName: "MyComponent",
      });
      updateTscircuitCode(tscircuit);
    } catch (err: any) {
      setError(
        `Error converting circuit json to tscircuit: ${err.toString()}\n\n${err.stack}`
      );
    }
  }, [filesAdded]);

  const addDroppedFile = useCallback(
    (fileName: string, file: string) => {
      setError(null);
      if (
        fileName.endsWith(".kicad_mod") ||
        fileName.endsWith(".kicad_mod.txt") ||
        file.trim().startsWith("(footprint")
      ) {
        addFile("kicad_mod", file);
      } else if (fileName.endsWith(".kicad_sym")) {
        addFile("kicad_sym", file);
      } else {
        setError("Unsupported file type");
      }
    },
    [addFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      // biome-ignore lint/complexity/noForEach: <explanation>
      Array.from(e.dataTransfer.files).forEach((file) => {
        const reader = new FileReader();
        reader.onload = (e) =>
          addDroppedFile(file.name, e.target?.result as string);
        reader.readAsText(file);
      });
    },
    [addDroppedFile]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const content = e.clipboardData.getData("text");
      if (!content) return;
      if (content.trim().startsWith("(footprint")) {
        addDroppedFile("kicad_mod", content);
      } else if (content.trim().startsWith("(symbol")) {
        addDroppedFile("kicad_sym", content);
      } else {
        setError("Unsupported file type (file an issue if we're wrong)");
      }
    },
    [addDroppedFile]
  );

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-4"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      onPaste={handlePaste}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: we need this for drag and drop
      tabIndex={0}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".kicad_mod,.kicad_mod.txt,.kicad_sym,.txt"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (ev) => {
            addDroppedFile(file.name, ev.target?.result as string);
          };
          reader.readAsText(file);
          e.target.value = "";
        }}
      />
      <div className="flex flex-col text-center">
        <h1 className="text-3xl font-bold mb-8">
          KiCad Component Viewer & Converter
        </h1>
        <div className="space-y-4">
          <div className="mb-4">
            {error && (
              <div className="bg-red-500/20 border border-red-500 text-red-500 p-3 rounded-md whitespace-pre-wrap">
                {error}
              </div>
            )}
          </div>
          <p className="text-gray-400 mb-2">
            Drag and drop files or{" "}
            <button
              type="button"
              className="underline text-blue-400 hover:text-blue-300 focus:outline-none"
              onClick={() => fileInputRef.current?.click()}
            >
              select a file
            </button>{" "}
            to view or convert:
          </p>
          <div className="space-y-2">
            <div className="flex items-center gap-2 bg-gray-800/50 p-3 rounded-md">
              <span
                className={
                  filesAdded.kicad_mod ? "text-green-500" : "text-red-500"
                }
              >
                {filesAdded.kicad_mod ? "✅" : "❌"}
              </span>
              <span className="text-gray-300">KiCad Mod File</span>
            </div>
          </div>
          <div className="flex justify-center items-center gap-2">
            {Object.keys(filesAdded).length > 0 && (
              <button
                type="button"
                className="bg-gray-700 inline-flex items-center text-white p-2 rounded-md"
                onClick={() => {
                  setError(null);
                  reset();
                }}
              >
                <span>Restart</span>
              </button>
            )}
            {!circuitJson && (
              <button
                type="button"
                className="bg-blue-500 inline-flex items-center text-white p-2 rounded-md"
                onClick={handleProcessAndViewFiles}
              >
                <span>Process & View</span>
                <FileSearch className="w-4 h-4 ml-2" />
              </button>
            )}
            {circuitJson && (
              <button
                type="button"
                className="bg-green-500 inline-flex items-center text-white p-2 rounded-md"
                onClick={() => {
                  const blob = new Blob(
                    [JSON.stringify(circuitJson, null, 2)],
                    {
                      type: "application/json",
                    }
                  );
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "circuit.json";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                <span>Download Circuit JSON</span>
                <Download className="w-4 h-4 ml-2" />
              </button>
            )}
            {tscircuitCode && (
              <button
                type="button"
                className="bg-purple-500 inline-flex items-center text-white p-2 rounded-md"
                onClick={async () => {
                  const url = await createSnippetUrl(tscircuitCode, "package");
                  window.open(url, "_blank");
                }}
              >
                <span>Open on Snippets</span>
                <FileSearch className="w-4 h-4 ml-2" />
              </button>
            )}
          </div>
          {circuitJson && (
            <div className="w-full bg-gray-800/50 px-2 rounded-md">
              <CircuitJsonPreview
                circuitJson={circuitJson}
                showCodeTab
                codeTabContent={
                  <pre className="text-left overflow-x-auto w-full">
                    <code className="text-xs text-gray-300 whitespace-pre-wrap">
                      {tscircuitCode}
                    </code>
                  </pre>
                }
              />
            </div>
          )}
        </div>

        <div className="text-gray-400 text-sm mt-16">
          KiCad Component Viewer and Converter{" "}
          <a
            className="underline hover:text-blue-400"
            href="https://github.com/tscircuit/tscircuit"
          >
            by tscircuit
          </a>
          , get the{" "}
          <a
            className="underline"
            href="https://github.com/tscircuit/kicad-component-converter"
          >
            source code here
          </a>
          .
        </div>
        <div className="flex justify-center">
          <a
            className="mt-4"
            href="https://github.com/tscircuit/kicad-component-converter"
          >
            <img
              src="https://img.shields.io/github/stars/tscircuit/kicad-component-converter?style=social"
              alt="GitHub stars"
            />
          </a>
        </div>
      </div>
    </div>
  );
};
