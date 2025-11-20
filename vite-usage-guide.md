# Using vector-tile-core in a Vite Project

This guide explains how to use the `vector-tile-core` npm package in a downstream Vite project.

## Installation

```bash
npm install vector-tile-core
```

## Vite Configuration

### Option 1: No Configuration Required (Vite 5+)

**Good news!** With Vite 5+, you can use the package **without any configuration** in most cases. Just install and use:

```bash
npm install vector-tile-core
```

```typescript
import init, { generate_pbf_tiles } from 'vector-tile-core'
await init()
// Use it!
```

### Option 2: Recommended Configuration (Best Compatibility)

For the best compatibility across all Vite versions and to ensure it works in Web Workers, add the `vite-plugin-wasm` plugin:

```bash
npm install vector-tile-core vite-plugin-wasm
```

```typescript
import { defineConfig } from 'vite'
import wasm from 'vite-plugin-wasm'

export default defineConfig({
  plugins: [wasm()],
  worker: {
    format: 'es',
    plugins: () => [wasm()],
  },
  optimizeDeps: {
    exclude: ['vector-tile-core'],
  },
})
```

**When to use Option 2:**
- If you encounter WASM loading issues
- If you're using the package in Web Workers
- If you're using Vite 4 or earlier
- For maximum compatibility and reliability

## Basic Usage

### 1. Import and Initialize

```typescript
import init, { generate_pbf_tiles, type TileResult } from 'vector-tile-core'

// Initialize WASM (call once before using)
await init()
```

### 2. Generate Tiles from GeoJSON

The function expects GeoJSON as a `Uint8Array`. You can convert from various sources:

**From a File (ArrayBuffer):**
```typescript
// Read file as ArrayBuffer
const file = // ... File object
const arrayBuffer = await file.arrayBuffer()

// Convert ArrayBuffer to Uint8Array
const geojsonBytes = new Uint8Array(arrayBuffer)
```

**From a String:**
```typescript
const geojsonString = JSON.stringify({
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [0, 0]
      },
      properties: {}
    }
  ]
})

// Convert string to Uint8Array
const geojsonBytes = new TextEncoder().encode(geojsonString)
```

**Generate tiles:**
```typescript
const result: TileResult = generate_pbf_tiles(
  geojsonBytes,
  0,      // minZoom
  5,      // maxZoom
  'layer' // layerName
)

// Access results
console.log(`Generated ${result.count()} tiles`)

// Collect tiles
const tiles: Array<{ path: string; bytes: Uint8Array }> = []

for (let i = 0; i < result.count(); i++) {
  const path = result.get_path(i)  // e.g., "0/0/0.pbf"
  const data = result.get_data(i)   // Uint8Array of tile data
  
  if (path && data) {
    tiles.push({
      path,
      bytes: data,
    })
  }
}

// Get metadata
const metadata = result.get_metadata()
console.log(metadata)
// {
//   min_zoom: 0,
//   max_zoom: 5,
//   layer_name: "layer",
//   bounds: [number, number, number, number],  // [minLon, minLat, maxLon, maxLat]
//   center: [number, number]  // [lon, lat]
// }
```

## Complete Example

```typescript
import init, { generate_pbf_tiles, type TileResult } from 'vector-tile-core'

let wasmInitialized = false

async function initializeWasm() {
  if (wasmInitialized) return
  await init()
  wasmInitialized = true
}

async function generateVectorTiles(
  geojsonBytes: Uint8Array,
  minZoom: number,
  maxZoom: number,
  layerName: string
) {
  // Initialize WASM (only once)
  await initializeWasm()
  
  // Generate tiles
  const result: TileResult = generate_pbf_tiles(
    geojsonBytes,
    minZoom,
    maxZoom,
    layerName
  )
  
  // Collect tiles
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
  }
  
  // Get metadata
  const metadata = result.get_metadata()
  
  return { tiles, metadata }
}

// Usage with File
const fileInput = document.querySelector('input[type="file"]')
fileInput?.addEventListener('change', async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  
  // Read as ArrayBuffer
  const arrayBuffer = await file.arrayBuffer()
  const geojsonBytes = new Uint8Array(arrayBuffer)
  
  // Generate tiles
  const { tiles, metadata } = await generateVectorTiles(
    geojsonBytes,
    0,    // minZoom
    10,   // maxZoom
    'my-layer'
  )
  
  console.log(`Generated ${tiles.length} tiles`)
  console.log('Metadata:', metadata)
  // Use tiles...
})
```

## Using in Web Workers

Using a Web Worker is recommended for large datasets to avoid blocking the main thread:

**worker.ts:**
```typescript
import init, { generate_pbf_tiles, type TileResult } from 'vector-tile-core'

interface GenerateMessage {
  type: 'generate'
  payload: {
    geojson: ArrayBuffer
    minZoom: number
    maxZoom: number
    layerName: string
  }
}

let wasmInitialized = false

async function initializeWasm() {
  if (wasmInitialized) return
  await init()
  wasmInitialized = true
}

self.onmessage = async (event: MessageEvent<GenerateMessage>) => {
  const message = event.data
  
  if (message.type === 'generate') {
    try {
      // Initialize WASM
      await initializeWasm()
      
      const { geojson, minZoom, maxZoom, layerName } = message.payload
      
      // Convert ArrayBuffer to Uint8Array
      const geojsonBytes = new Uint8Array(geojson)
      
      // Generate tiles
      const result: TileResult = generate_pbf_tiles(
        geojsonBytes,
        minZoom,
        maxZoom,
        layerName
      )
      
      // Collect tiles
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
      }
      
      // Send results back
      self.postMessage({
        type: 'result',
        tiles,
        metadata: result.get_metadata(),
      })
    } catch (error) {
      self.postMessage({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }
}
```

**main.ts:**
```typescript
const worker = new Worker(new URL('./worker.ts', import.meta.url), {
  type: 'module'
})

// Read file as ArrayBuffer
const file = // ... File object
const arrayBuffer = await file.arrayBuffer()

// Send to worker
worker.postMessage({
  type: 'generate',
  payload: {
    geojson: arrayBuffer,
    minZoom: 0,
    maxZoom: 10,
    layerName: 'my-layer',
  },
})

worker.onmessage = (event) => {
  if (event.data.type === 'result') {
    const { tiles, metadata } = event.data
    // Use tiles...
  } else if (event.data.type === 'error') {
    console.error('Worker error:', event.data.message)
  }
}
```

## TypeScript Types

The package includes TypeScript definitions. The main types are:

```typescript
// TileResult interface (exported from package)
interface TileResult {
  count(): number
  get_path(index: number): string | null
  get_data(index: number): Uint8Array | null
  get_metadata(): {
    min_zoom: number
    max_zoom: number
    layer_name: string
    bounds: [number, number, number, number]  // [minLon, minLat, maxLon, maxLat]
    center: [number, number]  // [lon, lat]
  }
}

// Main function
function generate_pbf_tiles(
  geojsonBytes: Uint8Array,
  minZoom: number,
  maxZoom: number,
  layerName: string
): TileResult

// Import types
import type { TileResult } from 'vector-tile-core'
```

## Handling Large GeoJSON Files

The module requires the entire GeoJSON to be loaded into memory before processing. This is due to:
- GeoJSON structure (single JSON object with features array)
- Bounds calculation requiring all features
- Tile assignment algorithm needing complete dataset

**Best Practice**: Stream the file in JavaScript, then pass the complete buffer to WASM:

```typescript
// JavaScript efficiently streams from file
const arrayBuffer = await file.arrayBuffer()
const geojsonBytes = new Uint8Array(arrayBuffer)

// Pass complete buffer to WASM (requires full data anyway)
await init()
const result = generate_pbf_tiles(geojsonBytes, 0, 10, 'layer')
```

For very large files (>500MB), consider:
- Using Web Workers (see example above)
- Pre-filtering or splitting GeoJSON into regions
- Reducing zoom range or processing in batches

See `docs/internal/streaming-limitations.md` for detailed explanation and workarounds.

## Troubleshooting

### WASM not loading
- **First try**: The package should work with Vite 5+ without configuration
- **If issues persist**: Install and configure `vite-plugin-wasm` (see Option 2 above)
- Check that `optimizeDeps.exclude` includes `'vector-tile-core'` if using the plugin

### Worker issues
- Make sure `worker.plugins` includes `wasm()` plugin (if using Option 2)
- Use `type: 'module'` when creating workers
- If using Vite 5+ without config, try adding the plugin for worker support

### Build errors
- Ensure WASM files are not being processed by other plugins
- Check that the package is properly installed: `npm list vector-tile-core`
- Try adding `vite-plugin-wasm` if you're experiencing issues without it

### "Module not found" or import errors
- Make sure you're using Vite 5+ if trying to use without configuration
- For older Vite versions, use `vite-plugin-wasm` (Option 2)

