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

  // WebWorker初期化
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
      setError('Workerでエラーが発生しました')
      setIsProcessing(false)
    }

    return () => {
      workerRef.current?.terminate()
    }
  }, [])

  // タイル生成完了時の処理
  const handleTilesGenerated = async (tiles: Array<{ path: string; bytes: Uint8Array }>, tilejson: string) => {
    try {
      console.log(`Generating ZIP with ${tiles.length} tiles...`)
      
      // ZIPファイルを作成
      const zip = new JSZip()
      
      // metadata.json を追加（tippecanoe形式）
      zip.file('metadata.json', tilejson)
      
      // タイルを追加
      for (const tile of tiles) {
        zip.file(tile.path, tile.bytes)
      }
      
      // ZIPを生成
      const blob = await zip.generateAsync({ type: 'blob' })
      
      // ダウンロード
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
      setError('ZIPファイルの作成に失敗しました')
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
      setError('GeoJSONファイルを選択してください')
      return
    }

    if (!workerRef.current) {
      setError('Workerが初期化されていません')
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

      // ファイルをArrayBufferとして読み込み
      const arrayBuffer = await file.arrayBuffer()

      // Workerにメッセージを送信
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
      setError(err instanceof Error ? err.message : 'ファイルの読み込みに失敗しました')
      setIsProcessing(false)
    }
  }

  return (
    <div className="container">
      <header>
        <h1>🗺️ Vector Tile Builder</h1>
        <p>ブラウザ上でベクタータイルを生成</p>
      </header>

      <main>
        <section className="upload-section">
          <h2>1. GeoJSONファイルを選択</h2>
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
          <h2>2. 設定</h2>
          
          <div className="form-group">
            <label>
              最小ズームレベル:
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
              最大ズームレベル:
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
              レイヤー名:
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
              出力形式:
              <select
                value={settings.format}
                onChange={(e) =>
                  setSettings({ ...settings, format: e.target.value as 'pbf' | 'pmtiles' })
                }
                disabled={isProcessing}
              >
                <option value="pbf">.pbf (ディレクトリ構造)</option>
                <option value="pmtiles">.pmtiles (単一ファイル) - 未実装</option>
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
            {isProcessing ? '生成中...' : 'タイルを生成'}
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
          <h2>📝 使い方</h2>
          <ol>
            <li>GeoJSONファイルを選択（Point, LineString, Polygon対応）</li>
            <li>ズームレベルとレイヤー名を設定</li>
            <li>「タイルを生成」ボタンをクリック</li>
            <li>生成されたタイルがダウンロードされます</li>
          </ol>
          
          <p className="note">
            ✅ Wasm統合完了！ブラウザ上でベクタータイルを生成できます。
          </p>
        </section>
      </main>
    </div>
  )
}

export default App
