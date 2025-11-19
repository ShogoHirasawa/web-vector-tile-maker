// Coordinate projection module
// WGS84 (lon/lat) → WebMercator (x/y) conversion

use std::f64::consts::PI;

/// WebMercator projection constants
const EARTH_RADIUS: f64 = 6378137.0; // Earth radius in meters
const ORIGIN_SHIFT: f64 = 2.0 * PI * EARTH_RADIUS / 2.0;

/// Convert lon/lat (WGS84) to WebMercator meters
pub fn lonlat_to_meters(lon: f64, lat: f64) -> (f64, f64) {
    let mx = lon * ORIGIN_SHIFT / 180.0;
    let my = ((90.0 + lat) * PI / 360.0).tan().ln() / (PI / 180.0);
    let my = my * ORIGIN_SHIFT / 180.0;
    (mx, my)
}

/// Convert WebMercator meters to tile coordinates
pub fn meters_to_tile(mx: f64, my: f64, zoom: u8) -> (u32, u32) {
    let resolution = get_resolution(zoom);
    let px = (mx + ORIGIN_SHIFT) / resolution;
    let py = (ORIGIN_SHIFT - my) / resolution;
    
    let tile_size = 256.0;
    let tx = (px / tile_size).floor() as u32;
    let ty = (py / tile_size).floor() as u32;
    
    (tx, ty)
}

/// Direct conversion from lon/lat to tile coordinates (standard method)
pub fn lonlat_to_tile(lon: f64, lat: f64, zoom: u8) -> (u32, u32) {
    let n = 2_f64.powi(zoom as i32);
    
    // X coordinate: normalize longitude
    let tx = ((lon + 180.0) / 360.0 * n).floor() as u32;
    
    // Y coordinate: WebMercator projection
    let lat_rad = lat * PI / 180.0;
    let ty = ((1.0 - (lat_rad.tan() + (1.0 / lat_rad.cos())).ln() / PI) / 2.0 * n).floor() as u32;
    
    // Clamp to tile count range
    let max_tile = n as u32 - 1;
    let tx = tx.min(max_tile);
    let ty = ty.min(max_tile);
    
    (tx, ty)
}

/// Get WebMercator meter bounds from tile coordinates
pub fn tile_bounds(tx: u32, ty: u32, zoom: u8) -> (f64, f64, f64, f64) {
    let resolution = get_resolution(zoom);
    let tile_size = 256.0;
    
    let min_x = tx as f64 * tile_size * resolution - ORIGIN_SHIFT;
    let max_y = ORIGIN_SHIFT - ty as f64 * tile_size * resolution;
    let max_x = (tx + 1) as f64 * tile_size * resolution - ORIGIN_SHIFT;
    let min_y = ORIGIN_SHIFT - (ty + 1) as f64 * tile_size * resolution;
    
    (min_x, min_y, max_x, max_y)
}

/// Convert WebMercator meters to pixel coordinates within tile
pub fn meters_to_pixel_in_tile(mx: f64, my: f64, tx: u32, ty: u32, zoom: u8) -> (f64, f64) {
    let (tile_min_x, tile_min_y, _, tile_max_y) = tile_bounds(tx, ty, zoom);
    let resolution = get_resolution(zoom);
    
    let px = (mx - tile_min_x) / resolution;
    let py = (tile_max_y - my) / resolution;  // Subtract from max (Y-axis is positive upward)
    
    (px, py)
}

/// Get resolution (meters/pixel) at specified zoom level
fn get_resolution(zoom: u8) -> f64 {
    let initial_resolution = 2.0 * PI * EARTH_RADIUS / 256.0;
    initial_resolution / 2_f64.powi(zoom as i32)
}

/// Get tile count for given zoom level
pub fn get_tile_count(zoom: u8) -> u32 {
    2_u32.pow(zoom as u32)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_lonlat_to_meters() {
        // Tokyo (139.7671, 35.6812)
        let (mx, my) = lonlat_to_meters(139.7671, 35.6812);
        assert!(mx > 15_500_000.0 && mx < 15_600_000.0);
        assert!(my > 4_200_000.0 && my < 4_300_000.0);
    }

    #[test]
    fn test_lonlat_to_tile() {
        // At zoom level 0, entire world is 1 tile
        let (tx, ty) = lonlat_to_tile(0.0, 0.0, 0);
        assert_eq!(tx, 0);
        assert_eq!(ty, 0);
        
        // Eastern hemisphere at zoom level 1
        let (tx, ty) = lonlat_to_tile(90.0, 0.0, 1);
        assert_eq!(tx, 1);
    }

    #[test]
    fn test_tile_count() {
        assert_eq!(get_tile_count(0), 1);
        assert_eq!(get_tile_count(1), 2);
        assert_eq!(get_tile_count(2), 4);
        assert_eq!(get_tile_count(5), 32);
    }
}
