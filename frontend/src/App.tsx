import { useState, useRef, useEffect } from 'react'
import JSZip from 'jszip'
import './App.css'

interface GenerationSettings {
  minZoom: number
  maxZoom: number
  layerName: string
  format: 'pbf' | 'pmtiles'
}

function App() {
  const [file, setFile] = useState<File | null>(null)
  const [settings, setSettings] = useState<GenerationSettings>({
    minZoom: 0,
    maxZoom: 5,
    layerName: 'default',
    format: 'pbf',
  })
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const workerRef = useRef<Worker | null>(null)

  // Initialize WebWorker
  useEffect(() => {
    workerRef.current = new Worker(new URL('./worker.ts', import.meta.url), {
      type: 'module',
    })

    workerRef.current.onmessage = (event) => {
      const message = event.data

      if (message.type === 'progress') {
        setProgress(message.value)
      } else if (message.type === 'result-pbf') {
        handleTilesGenerated(message.tiles, message.tilejson)
      } else if (message.type === 'error') {
        setError(message.message)
        setIsProcessing(false)
      }
    }

    workerRef.current.onerror = (error) => {
      console.error('Worker error:', error)
      setError('An error occurred in Worker')
      setIsProcessing(false)
    }

    return () => {
      workerRef.current?.terminate()
    }
  }, [])

  // Handle tile generation completion
  const handleTilesGenerated = async (tiles: Array<{ path: string; bytes: Uint8Array }>, tilejson: string) => {
    try {
      console.log(`Generating ZIP with ${tiles.length} tiles...`)
      
      // Create ZIP file
      const zip = new JSZip()
      
      // Add metadata.json (tippecanoe format)
      zip.file('metadata.json', tilejson)
      
      // Add tiles
      for (const tile of tiles) {
        zip.file(tile.path, tile.bytes)
      }
      
      // Generate ZIP
      const blob = await zip.generateAsync({ type: 'blob' })
      
      // Download
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `tiles_${settings.layerName}_${settings.minZoom}-${settings.maxZoom}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      console.log('Download started!')
      setIsProcessing(false)
    } catch (err) {
      console.error('Error creating ZIP:', err)
      setError('Failed to create ZIP file')
      setIsProcessing(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setError(null)
    }
  }

  const handleGenerate = async () => {
    if (!file) {
      setError('Please select a GeoJSON file')
      return
    }

    if (!workerRef.current) {
      setError('Worker is not initialized')
      return
    }

    setIsProcessing(true)
    setProgress(0)
    setError(null)

    try {
      console.log('タイル生成開始:', {
        file: file.name,
        settings,
      })

      // Read file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer()

      // Send message to Worker
      workerRef.current.postMessage({
        type: 'generate',
        payload: {
          geojson: arrayBuffer,
          minZoom: settings.minZoom,
          maxZoom: settings.maxZoom,
          layerName: settings.layerName,
          format: settings.format,
        },
      })
    } catch (err) {
      console.error('Error reading file:', err)
      setError(err instanceof Error ? err.message : 'Failed to read file')
      setIsProcessing(false)
    }
  }

  return (
    <div className="container">
      <header>
        <h1>🗺️ Vector Tile Builder</h1>
        <p>Generate vector tiles in your browser</p>
      </header>

      <main>
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
              ✓ {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
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
                  setSettings({ ...settings, minZoom: parseInt(e.target.value) })
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
                  setSettings({ ...settings, maxZoom: parseInt(e.target.value) })
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
                  setSettings({ ...settings, format: e.target.value as 'pbf' | 'pmtiles' })
                }
                disabled={isProcessing}
              >
                <option value="pbf">.pbf (Directory structure)</option>
                <option value="pmtiles">.pmtiles (Single file) - Not implemented</option>
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
            {isProcessing ? 'Generating...' : 'Generate Tiles'}
          </button>

          {isProcessing && (
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
              <span className="progress-text">{progress}%</span>
            </div>
          )}

          {error && <div className="error-message">❌ {error}</div>}
        </section>

        <section className="info-section">
          <h2>📝 How to Use</h2>
          <ol>
            <li>Select a GeoJSON file (supports Point, LineString, Polygon)</li>
            <li>Configure zoom levels and layer name</li>
            <li>Click "Generate Tiles" button</li>
            <li>Download the generated tiles</li>
          </ol>
          
          <p className="note">
            ✅ Wasm integration complete! Generate vector tiles in your browser.
          </p>
        </section>
      </main>
    </div>
  )
}

export default App
