// MapLibre プレビュー用のタイルストア管理

// TileStore型定義: z/x/y をキーとして Uint8Array を保持
export type TileStore = Map<string, Uint8Array>;

// グローバルなtileStore
let currentTileStore: TileStore | null = null;

/**
 * tileStoreをセット
 * @param store タイルストア
 */
export function setTileStore(store: TileStore): void {
  currentTileStore = store;
  console.log(`[TileStore] Set with ${store.size} tiles`);
}

/**
 * tileStoreから指定座標のタイルを取得
 * @param z ズームレベル
 * @param x X座標
 * @param y Y座標
 * @returns タイルデータ、存在しない場合はnull
 */
export function getTileFromStore(z: number, x: number, y: number): Uint8Array | null {
  if (!currentTileStore) {
    console.warn('[TileStore] Not initialized');
    return null;
  }
  
  const key = `${z}/${x}/${y}`;
  const tile = currentTileStore.get(key);
  
  if (!tile) {
    console.warn(`[TileStore] Tile not found: ${key}`);
    return null;
  }
  
  return tile;
}

/**
 * tileStoreをクリア
 */
export function clearTileStore(): void {
  currentTileStore = null;
  console.log('[TileStore] Cleared');
}
