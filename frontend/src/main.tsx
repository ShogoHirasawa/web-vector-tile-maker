import React from 'react'
import ReactDOM from 'react-dom/client'
import { addProtocol } from 'maplibre-gl'
import App from './App.tsx'
import './index.css'
import { getTileFromStore } from './tileStore.ts'

// MapLibreカスタムプロトコル登録（mem://）
// これにより、メモリ上のタイルをMapLibreに読み込ませることができる
addProtocol('mem', (params, abortController) => {
  // params.url の形式: "mem://tiles/{z}/{x}/{y}.pbf"
  const match = params.url.match(/mem:\/\/tiles\/(\d+)\/(\d+)\/(\d+)\.pbf/);
  
  return new Promise((resolve, reject) => {
    if (!match) {
      reject(new Error(`Invalid tile URL: ${params.url}`));
      return;
    }
    
    const [, z, x, y] = match;
    const tileData = getTileFromStore(Number(z), Number(x), Number(y));
    
    if (!tileData) {
      reject(new Error(`Tile not found: ${z}/${x}/${y}`));
      return;
    }
    
    // Uint8ArrayをArrayBufferに変換して返す
    resolve({ data: tileData.buffer });
  });
});

console.log('[Main] MapLibre custom protocol "mem://" registered');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
