// Vector Tile Core Library
// Rust implementation for generating vector tiles (.pbf) in the browser

pub mod geojson_parser;
pub mod projection;
pub mod tiler;
pub mod mvt_encoder;

#[cfg(target_arch = "wasm32")]
pub mod wasm_api;

use std::collections::HashMap;

/// Tile coordinate structure
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct TileCoord {
    pub z: u8,
    pub x: u32,
    pub y: u32,
}

impl TileCoord {
    pub fn new(z: u8, x: u32, y: u32) -> Self {
        Self { z, x, y }
    }
    
    pub fn to_path(&self) -> String {
        format!("{}/{}/{}.pbf", self.z, self.x, self.y)
    }
}

/// Tile file structure
#[derive(Debug, Clone)]
pub struct TileFile {
    pub path: String,
    pub data: Vec<u8>,
}

/// Tile metadata (for TileJSON generation)
#[derive(Debug, Clone)]
pub struct TileMetadata {
    pub min_zoom: u8,
    pub max_zoom: u8,
    pub layer_name: String,
    pub bounds: (f64, f64, f64, f64), // (min_lon, min_lat, max_lon, max_lat)
    pub center: (f64, f64),            // (center_lon, center_lat)
}

/// Main tile generation function (with metadata)
pub fn generate_tiles_with_metadata(
    geojson_bytes: &[u8],
    min_zoom: u8,
    max_zoom: u8,
    layer_name: &str,
) -> Result<(Vec<TileFile>, TileMetadata), String> {
    // 1. Parse GeoJSON
    let features = geojson_parser::parse_geojson(geojson_bytes)?;
    
    // 2. Calculate metadata
    let bounds = geojson_parser::calculate_bounds(&features)?;
    let center = geojson_parser::calculate_center(bounds);
    
    let metadata = TileMetadata {
        min_zoom,
        max_zoom,
        layer_name: layer_name.to_string(),
        bounds,
        center,
    };
    
    // 3. Generate tiles for each zoom level
    let mut tile_files = Vec::new();
    
    for zoom in min_zoom..=max_zoom {
        // 4. Assign features to tiles
        let tiles = tiler::tile_features(&features, zoom)?;
        
        // 5. Encode each tile in MVT format
        for (coord, features) in tiles {
            let mvt_data = mvt_encoder::encode_tile(&features, layer_name)?;
            tile_files.push(TileFile {
                path: coord.to_path(),
                data: mvt_data,
            });
        }
    }
    
    Ok((tile_files, metadata))
}

/// Main tile generation function (for backward compatibility)
pub fn generate_tiles(
    geojson_bytes: &[u8],
    min_zoom: u8,
    max_zoom: u8,
    layer_name: &str,
) -> Result<Vec<TileFile>, String> {
    let (tiles, _metadata) = generate_tiles_with_metadata(geojson_bytes, min_zoom, max_zoom, layer_name)?;
    Ok(tiles)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tile_coord() {
        let coord = TileCoord::new(5, 10, 12);
        assert_eq!(coord.to_path(), "5/10/12.pbf");
    }
}
