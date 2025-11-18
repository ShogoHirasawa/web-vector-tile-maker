// WebAssembly API
// ブラウザから呼び出されるWasm関数

use wasm_bindgen::prelude::*;
use crate::generate_tiles_with_metadata;

/// Wasmパニック時のフック設定
#[wasm_bindgen(start)]
pub fn init_panic_hook() {
    console_error_panic_hook::set_once();
}

/// タイル生成結果（メタデータ付き）
#[wasm_bindgen]
pub struct TileResult {
    tiles: Vec<TileData>,
    metadata: MetadataData,
}

#[wasm_bindgen]
impl TileResult {
    /// タイル数を取得
    pub fn count(&self) -> usize {
        self.tiles.len()
    }
    
    /// 指定されたインデックスのタイルパスを取得
    pub fn get_path(&self, index: usize) -> Option<String> {
        self.tiles.get(index).map(|t| t.path.clone())
    }
    
    /// 指定されたインデックスのタイルデータを取得
    pub fn get_data(&self, index: usize) -> Option<Vec<u8>> {
        self.tiles.get(index).map(|t| t.data.clone())
    }
    
    /// メタデータを取得
    pub fn get_metadata(&self) -> JsValue {
        serde_wasm_bindgen::to_value(&self.metadata).unwrap_or(JsValue::NULL)
    }
}

#[derive(Clone)]
struct TileData {
    path: String,
    data: Vec<u8>,
}

#[derive(Clone, serde::Serialize)]
struct MetadataData {
    min_zoom: u8,
    max_zoom: u8,
    layer_name: String,
    bounds: (f64, f64, f64, f64),
    center: (f64, f64),
}

/// GeoJSONからベクタータイルを生成（Wasm向け、メタデータ付き）
/// 
/// # Arguments
/// * `geojson_bytes` - GeoJSONのバイト配列
/// * `min_zoom` - 最小ズームレベル
/// * `max_zoom` - 最大ズームレベル
/// * `layer_name` - レイヤー名
/// 
/// # Returns
/// * `Result<TileResult, JsValue>` - 成功時はTileResult、失敗時はエラーメッセージ
#[wasm_bindgen]
pub fn generate_pbf_tiles(
    geojson_bytes: &[u8],
    min_zoom: u8,
    max_zoom: u8,
    layer_name: &str,
) -> Result<TileResult, JsValue> {
    // タイル生成（メタデータ付き）
    let (tiles, metadata) = generate_tiles_with_metadata(geojson_bytes, min_zoom, max_zoom, layer_name)
        .map_err(|e| JsValue::from_str(&e))?;
    
    // Wasm用のデータ構造に変換
    let tile_data: Vec<TileData> = tiles
        .into_iter()
        .map(|tile| TileData {
            path: tile.path,
            data: tile.data,
        })
        .collect();
    
    let metadata_data = MetadataData {
        min_zoom: metadata.min_zoom,
        max_zoom: metadata.max_zoom,
        layer_name: metadata.layer_name,
        bounds: metadata.bounds,
        center: metadata.center,
    };
    
    Ok(TileResult { 
        tiles: tile_data,
        metadata: metadata_data,
    })
}

/// ログ出力（デバッグ用）
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

/// デバッグログを出力
#[wasm_bindgen]
pub fn debug_log(message: &str) {
    log(message);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_wasm_api_structure() {
        // 基本的な構造テスト
        let tile_data = vec![
            TileData {
                path: "0/0/0.pbf".to_string(),
                data: vec![1, 2, 3],
            },
        ];
        
        let result = TileResult { tiles: tile_data };
        assert_eq!(result.count(), 1);
        assert_eq!(result.get_path(0), Some("0/0/0.pbf".to_string()));
    }
}
