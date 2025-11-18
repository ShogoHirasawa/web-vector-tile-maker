// タイル振り分けモジュール
// フィーチャを各タイルに振り分け、タイル内座標に変換

use crate::geojson_parser::{Feature, GeometryType};
use crate::projection::{lonlat_to_tile, lonlat_to_meters, meters_to_pixel_in_tile, tile_bounds};
use crate::TileCoord;
use std::collections::HashMap;
use geo_types::{Point, LineString, Polygon, Coord};

/// タイル内フィーチャ
#[derive(Debug, Clone)]
pub struct TileFeature {
    pub geometry: TileGeometry,
    pub properties: serde_json::Map<String, serde_json::Value>,
}

/// タイル内ジオメトリ（タイル座標系：0-4096）
#[derive(Debug, Clone)]
pub enum TileGeometry {
    Point(i32, i32),
    LineString(Vec<(i32, i32)>),
    Polygon(Vec<Vec<(i32, i32)>>), // 外側リング + 内側リング（穴）
}

/// MVT仕様のエクステント（タイル内座標の範囲）
const EXTENT: i32 = 4096;

/// フィーチャをタイルに振り分け
pub fn tile_features(
    features: &[Feature],
    zoom: u8,
) -> Result<HashMap<TileCoord, Vec<TileFeature>>, String> {
    let mut tiles: HashMap<TileCoord, Vec<TileFeature>> = HashMap::new();
    
    for feature in features {
        match &feature.geometry {
            GeometryType::Point(point) => {
                tile_point(point, &feature.properties, zoom, &mut tiles)?;
            }
            GeometryType::LineString(line) => {
                tile_linestring(line, &feature.properties, zoom, &mut tiles)?;
            }
            GeometryType::Polygon(polygon) => {
                tile_polygon(polygon, &feature.properties, zoom, &mut tiles)?;
            }
        }
    }
    
    Ok(tiles)
}

/// Pointをタイルに追加
fn tile_point(
    point: &Point<f64>,
    properties: &serde_json::Map<String, serde_json::Value>,
    zoom: u8,
    tiles: &mut HashMap<TileCoord, Vec<TileFeature>>,
) -> Result<(), String> {
    let lon = point.x();
    let lat = point.y();
    
    // タイル座標を取得
    let (tx, ty) = lonlat_to_tile(lon, lat, zoom);
    
    // WebMercatorメートル座標に変換
    let (mx, my) = lonlat_to_meters(lon, lat);
    
    // タイル内ピクセル座標に変換
    let (px, py) = meters_to_pixel_in_tile(mx, my, tx, ty, zoom);
    
    // MVTエクステント座標に変換（0-4096）
    let tile_x = ((px / 256.0) * EXTENT as f64) as i32;
    let tile_y = ((py / 256.0) * EXTENT as f64) as i32;
    
    // タイルに追加
    let coord = TileCoord::new(zoom, tx, ty);
    let tile_feature = TileFeature {
        geometry: TileGeometry::Point(tile_x, tile_y),
        properties: properties.clone(),
    };
    
    tiles.entry(coord).or_insert_with(Vec::new).push(tile_feature);
    
    Ok(())
}

/// LineStringをタイルに追加（複数タイル対応）
fn tile_linestring(
    line: &LineString<f64>,
    properties: &serde_json::Map<String, serde_json::Value>,
    zoom: u8,
    tiles: &mut HashMap<TileCoord, Vec<TileFeature>>,
) -> Result<(), String> {
    if line.0.is_empty() {
        return Ok(());
    }
    
    // LineStringのbounding boxを計算
    let (min_lon, min_lat, max_lon, max_lat) = linestring_bounds(line);
    
    // 交差するタイルの範囲を取得
    let (tx_min, ty_max) = lonlat_to_tile(min_lon, min_lat, zoom);
    let (tx_max, ty_min) = lonlat_to_tile(max_lon, max_lat, zoom);
    
    // 各タイルにLineStringを配置
    for tx in tx_min..=tx_max {
        for ty in ty_min..=ty_max {
            // 全座標をこのタイル内座標に変換
            let mut tile_coords = Vec::new();
            for coord in &line.0 {
                let (mx, my) = lonlat_to_meters(coord.x, coord.y);
                let (px, py) = meters_to_pixel_in_tile(mx, my, tx, ty, zoom);
                
                let tile_x = ((px / 256.0) * EXTENT as f64) as i32;
                let tile_y = ((py / 256.0) * EXTENT as f64) as i32;
                
                tile_coords.push((tile_x, tile_y));
            }
            
            // タイルに追加
            let coord = TileCoord::new(zoom, tx, ty);
            let tile_feature = TileFeature {
                geometry: TileGeometry::LineString(tile_coords),
                properties: properties.clone(),
            };
            
            tiles.entry(coord).or_insert_with(Vec::new).push(tile_feature);
        }
    }
    
    Ok(())
}

/// Polygonをタイルに追加（複数タイル対応）
fn tile_polygon(
    polygon: &Polygon<f64>,
    properties: &serde_json::Map<String, serde_json::Value>,
    zoom: u8,
    tiles: &mut HashMap<TileCoord, Vec<TileFeature>>,
) -> Result<(), String> {
    let exterior = polygon.exterior();
    if exterior.0.is_empty() {
        return Ok(());
    }
    
    // Polygonのbounding boxを計算
    let (min_lon, min_lat, max_lon, max_lat) = polygon_bounds(polygon);
    
    // 交差するタイルの範囲を取得
    let (tx_min, ty_max) = lonlat_to_tile(min_lon, min_lat, zoom);
    let (tx_max, ty_min) = lonlat_to_tile(max_lon, max_lat, zoom);
    
    // 各タイルにPolygonを配置
    for tx in tx_min..=tx_max {
        for ty in ty_min..=ty_max {
            // 外側リングを変換
            let mut tile_rings = Vec::new();
            let mut exterior_ring = Vec::new();
            
            for coord in &exterior.0 {
                let (mx, my) = lonlat_to_meters(coord.x, coord.y);
                let (px, py) = meters_to_pixel_in_tile(mx, my, tx, ty, zoom);
                
                let tile_x = ((px / 256.0) * EXTENT as f64) as i32;
                let tile_y = ((py / 256.0) * EXTENT as f64) as i32;
                
                exterior_ring.push((tile_x, tile_y));
            }
            tile_rings.push(exterior_ring);
            
            // 内側リング（穴）を変換
            for interior in polygon.interiors() {
                let mut interior_ring = Vec::new();
                for coord in &interior.0 {
                    let (mx, my) = lonlat_to_meters(coord.x, coord.y);
                    let (px, py) = meters_to_pixel_in_tile(mx, my, tx, ty, zoom);
                    
                    let tile_x = ((px / 256.0) * EXTENT as f64) as i32;
                    let tile_y = ((py / 256.0) * EXTENT as f64) as i32;
                    
                    interior_ring.push((tile_x, tile_y));
                }
                tile_rings.push(interior_ring);
            }
            
            // タイルに追加
            let coord = TileCoord::new(zoom, tx, ty);
            let tile_feature = TileFeature {
                geometry: TileGeometry::Polygon(tile_rings),
                properties: properties.clone(),
            };
            
            tiles.entry(coord).or_insert_with(Vec::new).push(tile_feature);
        }
    }
    
    Ok(())
}

/// LineStringのbounding boxを計算
fn linestring_bounds(line: &LineString<f64>) -> (f64, f64, f64, f64) {
    let mut min_lon = f64::INFINITY;
    let mut min_lat = f64::INFINITY;
    let mut max_lon = f64::NEG_INFINITY;
    let mut max_lat = f64::NEG_INFINITY;
    
    for coord in &line.0 {
        min_lon = min_lon.min(coord.x);
        min_lat = min_lat.min(coord.y);
        max_lon = max_lon.max(coord.x);
        max_lat = max_lat.max(coord.y);
    }
    
    (min_lon, min_lat, max_lon, max_lat)
}

/// Polygonのbounding boxを計算
fn polygon_bounds(polygon: &Polygon<f64>) -> (f64, f64, f64, f64) {
    let mut min_lon = f64::INFINITY;
    let mut min_lat = f64::INFINITY;
    let mut max_lon = f64::NEG_INFINITY;
    let mut max_lat = f64::NEG_INFINITY;
    
    // 外側リング
    for coord in &polygon.exterior().0 {
        min_lon = min_lon.min(coord.x);
        min_lat = min_lat.min(coord.y);
        max_lon = max_lon.max(coord.x);
        max_lat = max_lat.max(coord.y);
    }
    
    (min_lon, min_lat, max_lon, max_lat)
}

#[cfg(test)]
mod tests {
    use super::*;
    use geo_types::Point;

    #[test]
    fn test_tile_point() {
        let point = Point::new(139.7671, 35.6812);
        let properties = serde_json::Map::new();
        let mut tiles = HashMap::new();
        
        tile_point(&point, &properties, 5, &mut tiles).unwrap();
        
        assert_eq!(tiles.len(), 1);
    }
}
