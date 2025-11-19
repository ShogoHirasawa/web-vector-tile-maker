// Tile store management for MapLibre preview

// TileStore type: stores Uint8Array tiles with "z/x/y" keys
export type TileStore = Map<string, Uint8Array>;

// Global tile store
let currentTileStore: TileStore | null = null;

/**
 * Set the tile store
 * @param store Tile store to set
 */
export function setTileStore(store: TileStore): void {
  currentTileStore = store;
}

/**
 * Get a tile from the store by coordinates
 * @param z Zoom level
 * @param x Tile X coordinate
 * @param y Tile Y coordinate
 * @returns Tile data, or null if not found
 */
export function getTileFromStore(z: number, x: number, y: number): Uint8Array | null {
  if (!currentTileStore) {
    return null;
  }
  
  const key = `${z}/${x}/${y}`;
  const tile = currentTileStore.get(key);
  
  if (!tile) {
    return null;
  }
  
  return tile;
}

/**
 * Clear the tile store
 */
export function clearTileStore(): void {
  currentTileStore = null;
}
