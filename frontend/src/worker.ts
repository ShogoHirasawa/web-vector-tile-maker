// WebWorker: Wasmを使ったタイル生成処理
import init, { generate_pbf_tiles, type TileResult } from './wasm/vector_tile_core'

// Workerメッセージの型定義
interface GenerateMessage {
  type: 'generate'
  payload: {
    geojson: ArrayBuffer
    minZoom: number
    maxZoom: number
    layerName: string
    format: 'pbf' | 'pmtiles'
  }
}

interface ProgressMessage {
  type: 'progress'
  value: number
}

interface ResultMessage {
  type: 'result-pbf'
  tiles: Array<{ path: string; bytes: Uint8Array }>
  tilejson: string
}

interface ErrorMessage {
  type: 'error'
  message: string
}

type WorkerMessage = ProgressMessage | ResultMessage | ErrorMessage

// Wasm初期化フラグ
let wasmInitialized = false

// tippecanoe形式のmetadata.jsonを生成
function generateTileJSON(metadata: any, minZoom: number, maxZoom: number, layerName: string): string {
  const { bounds, center } = metadata
  
  // center_zoomを計算（中間ズームレベル）
  const centerZoom = Math.floor((minZoom + maxZoom) / 2)
  
  // tippecanoe形式のmetadata.json
  const metadataJson = {
    name: layerName,
    description: `${layerName}`,
    version: '1',
    minzoom: minZoom.toString(),
    maxzoom: maxZoom.toString(),
    center: `${center[0]},${center[1]},${centerZoom}`,
    bounds: `${bounds[0]},${bounds[1]},${bounds[2]},${bounds[3]}`,
    type: 'overlay',
    format: 'pbf',
    generator: 'vector-tile-builder v0.1.0',
    generator_options: `Browser-based tile generation from GeoJSON`,
    json: JSON.stringify({
      vector_layers: [
        {
          id: layerName,
          description: '',
          minzoom: minZoom,
          maxzoom: maxZoom,
          fields: {},
        },
      ],
      tilestats: {
        layerCount: 1,
        layers: [
          {
            layer: layerName,
            count: 0,
            geometry: 'Unknown',
            attributeCount: 0,
            attributes: [],
          },
        ],
      },
    }),
  }
  
  return JSON.stringify(metadataJson, null, 2)
}

// Wasmを初期化
async function initializeWasm() {
  if (wasmInitialized) return
  
  try {
    console.log('[Worker] Initializing WebAssembly...')
    await init()
    wasmInitialized = true
    console.log('[Worker] WebAssembly initialized successfully')
  } catch (error) {
    console.error('[Worker] Failed to initialize WebAssembly:', error)
    throw error
  }
}

// タイル生成処理
async function generateTiles(message: GenerateMessage) {
  try {
    // Wasm初期化
    await initializeWasm()
    
    const { geojson, minZoom, maxZoom, layerName } = message.payload
    
    // 進捗通知
    postMessage({ type: 'progress', value: 10 } as ProgressMessage)
    
    console.log('[Worker] Starting tile generation...')
    console.log(`[Worker] Zoom range: ${minZoom}-${maxZoom}`)
    console.log(`[Worker] Layer name: ${layerName}`)
    console.log(`[Worker] GeoJSON size: ${geojson.byteLength} bytes`)
    
    // GeoJSONをUint8Arrayに変換
    const geojsonBytes = new Uint8Array(geojson)
    
    // 進捗通知
    postMessage({ type: 'progress', value: 30 } as ProgressMessage)
    
    // Wasmでタイル生成
    const result: TileResult = generate_pbf_tiles(
      geojsonBytes,
      minZoom,
      maxZoom,
      layerName
    )
    
    console.log(`[Worker] Generated ${result.count()} tiles`)
    
    // 進捗通知
    postMessage({ type: 'progress', value: 60 } as ProgressMessage)
    
    // タイル情報を収集
    const tiles: Array<{ path: string; bytes: Uint8Array }> = []
    
    for (let i = 0; i < result.count(); i++) {
      const path = result.get_path(i)
      const data = result.get_data(i)
      
      if (path && data) {
        tiles.push({
          path,
          bytes: data,
        })
      }
      
      // 進捗通知（60%から90%まで）
      const progress = 60 + Math.floor((i / result.count()) * 30)
      postMessage({ type: 'progress', value: progress } as ProgressMessage)
    }
    
    console.log(`[Worker] Collected ${tiles.length} tile files`)
    
    // メタデータを取得
    const metadata = result.get_metadata()
    console.log('[Worker] Metadata:', metadata)
    
    // TileJSONを生成
    const tilejson = generateTileJSON(metadata, minZoom, maxZoom, layerName)
    console.log('[Worker] Generated TileJSON')
    
    // 完了
    postMessage({ type: 'progress', value: 100 } as ProgressMessage)
    
    // 結果を送信
    postMessage({
      type: 'result-pbf',
      tiles,
      tilejson,
    } as ResultMessage)
    
  } catch (error) {
    console.error('[Worker] Error during tile generation:', error)
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'タイル生成中にエラーが発生しました'
    
    postMessage({
      type: 'error',
      message: errorMessage,
    } as ErrorMessage)
  }
}

// Workerメッセージハンドラ
self.onmessage = async (event: MessageEvent<GenerateMessage>) => {
  const message = event.data
  
  if (message.type === 'generate') {
    await generateTiles(message)
  } else {
    console.warn('[Worker] Unknown message type:', message)
  }
}

// Worker起動完了通知
console.log('[Worker] Tile generation worker ready')
