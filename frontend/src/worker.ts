// WebWorker: Tile generation using Wasm
import init, { generate_pbf_tiles, type TileResult } from './wasm/vector_tile_core'

// Worker message type definitions
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

// Wasm initialization flag
let wasmInitialized = false

// Generate metadata.json in tippecanoe format
function generateTileJSON(metadata: any, minZoom: number, maxZoom: number, layerName: string): string {
  const { bounds, center } = metadata
  
  // Calculate center_zoom (middle zoom level)
  const centerZoom = Math.floor((minZoom + maxZoom) / 2)
  
  // metadata.json in tippecanoe format
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

// Initialize Wasm
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

// Tile generation process
async function generateTiles(message: GenerateMessage) {
  try {
    // Initialize Wasm
    await initializeWasm()
    
    const { geojson, minZoom, maxZoom, layerName } = message.payload
    
    // Progress notification
    postMessage({ type: 'progress', value: 10 } as ProgressMessage)
    
    console.log('[Worker] Starting tile generation...')
    console.log(`[Worker] Zoom range: ${minZoom}-${maxZoom}`)
    console.log(`[Worker] Layer name: ${layerName}`)
    console.log(`[Worker] GeoJSON size: ${geojson.byteLength} bytes`)
    
    // Convert GeoJSON to Uint8Array
    const geojsonBytes = new Uint8Array(geojson)
    
    // Progress notification
    postMessage({ type: 'progress', value: 30 } as ProgressMessage)
    
    // Generate tiles with Wasm
    const result: TileResult = generate_pbf_tiles(
      geojsonBytes,
      minZoom,
      maxZoom,
      layerName
    )
    
    console.log(`[Worker] Generated ${result.count()} tiles`)
    
    // Progress notification
    postMessage({ type: 'progress', value: 60 } as ProgressMessage)
    
    // Collect tile information
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
      
      // Progress notification (60% to 90%)
      const progress = 60 + Math.floor((i / result.count()) * 30)
      postMessage({ type: 'progress', value: progress } as ProgressMessage)
    }
    
    console.log(`[Worker] Collected ${tiles.length} tile files`)
    
    // Get metadata
    const metadata = result.get_metadata()
    console.log('[Worker] Metadata:', metadata)
    
    // Generate TileJSON
    const tilejson = generateTileJSON(metadata, minZoom, maxZoom, layerName)
    console.log('[Worker] Generated TileJSON')
    
    // Complete
    postMessage({ type: 'progress', value: 100 } as ProgressMessage)
    
    // Send result
    postMessage({
      type: 'result-pbf',
      tiles,
      tilejson,
    } as ResultMessage)
    
  } catch (error) {
    console.error('[Worker] Error during tile generation:', error)
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'An error occurred during tile generation'
    
    postMessage({
      type: 'error',
      message: errorMessage,
    } as ErrorMessage)
  }
}

// Worker message handler
self.onmessage = async (event: MessageEvent<GenerateMessage>) => {
  const message = event.data
  
  if (message.type === 'generate') {
    await generateTiles(message)
  } else {
    console.warn('[Worker] Unknown message type:', message)
  }
}

// Worker startup complete notification
console.log('[Worker] Tile generation worker ready')
