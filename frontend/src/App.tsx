import { useState, useRef, useEffect } from "react";
import JSZip from "jszip";
import "./App.css";

interface GenerationSettings {
  minZoom: number;
  maxZoom: number;
  layerName: string;
  format: "pbf" | "pmtiles";
}

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [settings, setSettings] = useState<GenerationSettings>({
    minZoom: 0,
    maxZoom: 5,
    layerName: "default",
    format: "pbf",
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);

  // Initialize WebWorker
  useEffect(() => {
    workerRef.current = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    });

    workerRef.current.onmessage = (event) => {
      const message = event.data;

      if (message.type === "progress") {
        setProgress(message.value);
      } else if (message.type === "result-pbf") {
        handleTilesGenerated(message.tiles, message.tilejson);
      } else if (message.type === "error") {
        setError(message.message);
        setIsProcessing(false);
      }
    };

    workerRef.current.onerror = (error) => {
      console.error("Worker error:", error);
      setError("An error occurred in Worker");
      setIsProcessing(false);
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  // Handle tile generation completion
  const handleTilesGenerated = async (
    tiles: Array<{ path: string; bytes: Uint8Array }>,
    tilejson: string
  ) => {
    try {
      console.log(`Generating ZIP with ${tiles.length} tiles...`);

      // Create ZIP file
      const zip = new JSZip();

      // Create folder name based on layer name and zoom levels
      const folderName = `tiles_${settings.layerName}_${settings.minZoom}-${settings.maxZoom}`;

      // Add metadata.json (tippecanoe format) inside the folder
      zip.file(`${folderName}/metadata.json`, tilejson);

      // Add tiles inside the folder
      for (const tile of tiles) {
        zip.file(`${folderName}/${tile.path}`, tile.bytes);
      }

      // Generate ZIP
      const blob = await zip.generateAsync({ type: "blob" });

      // Download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tiles_${settings.layerName}_${settings.minZoom}-${settings.maxZoom}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      console.log("Download started!");
      setIsProcessing(false);
    } catch (err) {
      console.error("Error creating ZIP:", err);
      setError("Failed to create ZIP file");
      setIsProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleGenerate = async () => {
    if (!file) {
      setError("Please select a GeoJSON file");
      return;
    }

    if (!workerRef.current) {
      setError("Worker is not initialized");
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setError(null);

    try {
      console.log("タイル生成開始:", {
        file: file.name,
        settings,
      });

      // Read file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();

      // Send message to Worker
      workerRef.current.postMessage({
        type: "generate",
        payload: {
          geojson: arrayBuffer,
          minZoom: settings.minZoom,
          maxZoom: settings.maxZoom,
          layerName: settings.layerName,
          format: settings.format,
        },
      });
    } catch (err) {
      console.error("Error reading file:", err);
      setError(err instanceof Error ? err.message : "Failed to read file");
      setIsProcessing(false);
    }
  };

  return (
    <div className="container">
      <header>
        <h1>🗺️ Vector Tile Maker</h1>
        <p>Generate vector tiles in your browser</p>
      </header>

      <main>
        <section className="info-section">
          <h2>📝 How to Use</h2>
          <ol>
            <li>Select a GeoJSON file (supports Point, LineString, Polygon)</li>
            <li>Configure zoom levels (0-15) and layer name</li>
            <li>Click "Generate Tiles" button</li>
            <li>Download the generated tiles</li>
          </ol>
        </section>

        <section className="upload-section">
          <h2>1. Select GeoJSON File</h2>
          <input
            type="file"
            accept=".geojson,.json"
            onChange={handleFileChange}
            disabled={isProcessing}
          />
          {file && (
            <div className="file-info">
              ✓ {file.name} (
              {file.size >= 1024 * 1024
                ? `${(file.size / 1024 / 1024).toFixed(2)} MB`
                : `${(file.size / 1024).toFixed(2)} KB`}
              )
            </div>
          )}
        </section>

        <section className="settings-section">
          <h2>2. Settings</h2>

          <div className="form-group">
            <label>
              Minimum Zoom Level:
              <input
                type="number"
                min="0"
                max="15"
                value={settings.minZoom}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    minZoom: parseInt(e.target.value),
                  })
                }
                disabled={isProcessing}
              />
            </label>
          </div>

          <div className="form-group">
            <label>
              Maximum Zoom Level:
              <input
                type="number"
                min="0"
                max="15"
                value={settings.maxZoom}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    maxZoom: parseInt(e.target.value),
                  })
                }
                disabled={isProcessing}
              />
            </label>
          </div>

          <div className="form-group">
            <label>
              Layer Name:
              <input
                type="text"
                value={settings.layerName}
                onChange={(e) =>
                  setSettings({ ...settings, layerName: e.target.value })
                }
                disabled={isProcessing}
              />
            </label>
          </div>

          <div className="form-group">
            <label>
              Output Format:
              <select
                value={settings.format}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    format: e.target.value as "pbf" | "pmtiles",
                  })
                }
                disabled={isProcessing}
              >
                <option value="pbf">.pbf (Directory structure)</option>
                <option value="pmtiles">
                  .pmtiles (Single file) - Not implemented
                </option>
              </select>
            </label>
          </div>
        </section>

        <section className="action-section">
          <button
            onClick={handleGenerate}
            disabled={!file || isProcessing}
            className="generate-button"
          >
            {isProcessing ? "Generating..." : "Generate Tiles"}
          </button>

          {isProcessing && (
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${progress}%` }}
              />
              <span className="progress-text">{progress}%</span>
            </div>
          )}

          {error && <div className="error-message">❌ {error}</div>}
        </section>
      </main>

      <footer>
        <a 
          href="https://github.com/ShogoHirasawa/web-vector-tile-maker" 
          target="_blank" 
          rel="noopener noreferrer"
          className="github-link"
        >
          <svg height="20" viewBox="0 0 16 16" width="20" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
          </svg>
          <span>github.com/ShogoHirasawa/web-vector-tile-maker</span>
        </a>
      </footer>
    </div>
  );
}

export default App;
