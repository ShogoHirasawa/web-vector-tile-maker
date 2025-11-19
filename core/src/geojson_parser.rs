// GeoJSON parsing module
use geojson::{GeoJson, FeatureCollection, Geometry, Value};
use geo_types::{Point, LineString, Polygon, Coord};

/// Parsed feature structure
#[derive(Debug, Clone)]
pub struct Feature {
    pub geometry: GeometryType,
    pub properties: serde_json::Map<String, serde_json::Value>,
}

/// Supported geometry types
#[derive(Debug, Clone)]
pub enum GeometryType {
    Point(Point<f64>),
    LineString(LineString<f64>),
    Polygon(Polygon<f64>),
}

/// Parse features from GeoJSON bytes
pub fn parse_geojson(bytes: &[u8]) -> Result<Vec<Feature>, String> {
    let geojson_str = std::str::from_utf8(bytes)
        .map_err(|e| format!("UTF-8 conversion error: {}", e))?;
    
    let geojson = geojson_str.parse::<GeoJson>()
        .map_err(|e| format!("GeoJSON parse error: {}", e))?;
    
    match geojson {
        GeoJson::FeatureCollection(fc) => parse_feature_collection(fc),
        GeoJson::Feature(f) => {
            let features = vec![parse_feature(f)?];
            Ok(features)
        }
        _ => Err("Unsupported GeoJSON format".to_string()),
    }
}

fn parse_feature_collection(fc: FeatureCollection) -> Result<Vec<Feature>, String> {
    let mut features = Vec::new();
    
    for feature in fc.features {
        match parse_feature(feature) {
            Ok(f) => features.push(f),
            Err(e) => eprintln!("Feature parse warning: {}", e),
        }
    }
    
    if features.is_empty() {
        return Err("No valid features found".to_string());
    }
    
    Ok(features)
}

fn parse_feature(feature: geojson::Feature) -> Result<Feature, String> {
    let geometry = feature.geometry
        .ok_or("No geometry")?;
    
    let geometry_type = parse_geometry(geometry)?;
    
    let properties = feature.properties
        .unwrap_or_else(|| serde_json::Map::new());
    
    Ok(Feature {
        geometry: geometry_type,
        properties,
    })
}

fn parse_geometry(geometry: Geometry) -> Result<GeometryType, String> {
    match geometry.value {
        Value::Point(coords) => {
            let point = Point::new(coords[0], coords[1]);
            Ok(GeometryType::Point(point))
        }
        Value::LineString(coords) => {
            let line: Vec<Coord<f64>> = coords
                .iter()
                .map(|c| Coord { x: c[0], y: c[1] })
                .collect();
            Ok(GeometryType::LineString(LineString::from(line)))
        }
        Value::Polygon(rings) => {
            if rings.is_empty() {
                return Err("Empty polygon".to_string());
            }
            
            // Exterior ring
            let exterior: Vec<Coord<f64>> = rings[0]
                .iter()
                .map(|c| Coord { x: c[0], y: c[1] })
                .collect();
            
            // Interior rings (holes)
            let interiors: Vec<LineString<f64>> = rings[1..]
                .iter()
                .map(|ring| {
                    let coords: Vec<Coord<f64>> = ring
                        .iter()
                        .map(|c| Coord { x: c[0], y: c[1] })
                        .collect();
                    LineString::from(coords)
                })
                .collect();
            
            Ok(GeometryType::Polygon(Polygon::new(
                LineString::from(exterior),
                interiors,
            )))
        }
        _ => Err(format!("Unsupported geometry type: {:?}", geometry.value)),
    }
}

/// Calculate bounds (bounding box) from GeoJSON features
pub fn calculate_bounds(features: &[Feature]) -> Result<(f64, f64, f64, f64), String> {
    if features.is_empty() {
        return Err("Features are empty".to_string());
    }
    
    let mut min_lon = f64::INFINITY;
    let mut min_lat = f64::INFINITY;
    let mut max_lon = f64::NEG_INFINITY;
    let mut max_lat = f64::NEG_INFINITY;
    
    for feature in features {
        match &feature.geometry {
            GeometryType::Point(point) => {
                let lon = point.x();
                let lat = point.y();
                min_lon = min_lon.min(lon);
                min_lat = min_lat.min(lat);
                max_lon = max_lon.max(lon);
                max_lat = max_lat.max(lat);
            }
            GeometryType::LineString(line) => {
                for coord in &line.0 {
                    min_lon = min_lon.min(coord.x);
                    min_lat = min_lat.min(coord.y);
                    max_lon = max_lon.max(coord.x);
                    max_lat = max_lat.max(coord.y);
                }
            }
            GeometryType::Polygon(polygon) => {
                for coord in polygon.exterior().0.iter() {
                    min_lon = min_lon.min(coord.x);
                    min_lat = min_lat.min(coord.y);
                    max_lon = max_lon.max(coord.x);
                    max_lat = max_lat.max(coord.y);
                }
            }
        }
    }
    
    Ok((min_lon, min_lat, max_lon, max_lat))
}

/// Calculate center coordinates from bounds
pub fn calculate_center(bounds: (f64, f64, f64, f64)) -> (f64, f64) {
    let (min_lon, min_lat, max_lon, max_lat) = bounds;
    let center_lon = (min_lon + max_lon) / 2.0;
    let center_lat = (min_lat + max_lat) / 2.0;
    (center_lon, center_lat)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_point_geojson() {
        let geojson = r#"{
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [139.7671, 35.6812]
                    },
                    "properties": {
                        "name": "Tokyo"
                    }
                }
            ]
        }"#;
        
        let features = parse_geojson(geojson.as_bytes()).unwrap();
        assert_eq!(features.len(), 1);
        
        match &features[0].geometry {
            GeometryType::Point(p) => {
                assert_eq!(p.x(), 139.7671);
                assert_eq!(p.y(), 35.6812);
            }
            _ => panic!("Expected Point geometry"),
        }
    }
}
