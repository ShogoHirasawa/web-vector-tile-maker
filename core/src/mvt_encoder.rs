// MVT（Mapbox Vector Tile）エンコーダー
// Protocol Buffersを使用してタイルをバイナリ形式にエンコード

use crate::tiler::{TileFeature, TileGeometry};
use prost::Message;
use std::collections::HashMap;

// Protocol Bufferで生成されたコード
pub mod vector_tile {
    include!(concat!(env!("OUT_DIR"), "/vector_tile.rs"));
}

use vector_tile::tile::{GeomType, Layer, Feature, Value};

/// タイルをMVT形式にエンコード
pub fn encode_tile(features: &[TileFeature], layer_name: &str) -> Result<Vec<u8>, String> {
    if features.is_empty() {
        return Err("フィーチャが空です".to_string());
    }
    
    // キーと値のディクショナリを構築
    let mut keys: Vec<String> = Vec::new();
    let mut values: Vec<Value> = Vec::new();
    let mut key_index: HashMap<String, u32> = HashMap::new();
    let mut value_index: HashMap<ValueKey, u32> = HashMap::new();
    
    // フィーチャをエンコード
    let mut encoded_features = Vec::new();
    
    for (idx, tile_feature) in features.iter().enumerate() {
        let mut tags = Vec::new();
        
        // プロパティをタグに変換
        for (key, value) in &tile_feature.properties {
            // キーのインデックスを取得または追加
            let key_idx = if let Some(&idx) = key_index.get(key) {
                idx
            } else {
                let idx = keys.len() as u32;
                keys.push(key.clone());
                key_index.insert(key.clone(), idx);
                idx
            };
            
            // 値のインデックスを取得または追加
            let value_key = ValueKey::from_json(value);
            let value_idx = if let Some(&idx) = value_index.get(&value_key) {
                idx
            } else {
                let idx = values.len() as u32;
                values.push(json_to_mvt_value(value));
                value_index.insert(value_key, idx);
                idx
            };
            
            tags.push(key_idx);
            tags.push(value_idx);
        }
        
        // ジオメトリをエンコード
        let (geom_type, geometry) = encode_geometry(&tile_feature.geometry)?;
        
        encoded_features.push(Feature {
            id: Some(idx as u64),
            tags,
            r#type: Some(geom_type as i32),
            geometry,
        });
    }
    
    // レイヤーを構築
    let layer = Layer {
        version: 2,
        name: layer_name.to_string(),
        features: encoded_features,
        keys,
        values,
        extent: Some(4096),
    };
    
    // タイルを構築
    let tile = vector_tile::Tile {
        layers: vec![layer],
    };
    
    // バイナリにエンコード
    let mut buf = Vec::new();
    tile.encode(&mut buf)
        .map_err(|e| format!("エンコードエラー: {}", e))?;
    
    Ok(buf)
}

/// ジオメトリをMVT形式にエンコード
fn encode_geometry(geometry: &TileGeometry) -> Result<(GeomType, Vec<u32>), String> {
    match geometry {
        TileGeometry::Point(x, y) => {
            let mut commands = Vec::new();
            
            // MoveTo コマンド (command=1, count=1)
            commands.push(command_integer(1, 1));
            
            // 座標（zig-zag エンコーディング）
            commands.push(zigzag_encode(*x));
            commands.push(zigzag_encode(*y));
            
            Ok((GeomType::Point, commands))
        }
        TileGeometry::LineString(coords) => {
            if coords.is_empty() {
                return Err("LineStringが空です".to_string());
            }
            
            let mut commands = Vec::new();
            
            // MoveTo 最初の点 (command=1, count=1)
            commands.push(command_integer(1, 1));
            commands.push(zigzag_encode(coords[0].0));
            commands.push(zigzag_encode(coords[0].1));
            
            if coords.len() > 1 {
                // LineTo 残りの点 (command=2, count=n-1)
                commands.push(command_integer(2, (coords.len() - 1) as u32));
                
                for i in 1..coords.len() {
                    let dx = coords[i].0 - coords[i - 1].0;
                    let dy = coords[i].1 - coords[i - 1].1;
                    commands.push(zigzag_encode(dx));
                    commands.push(zigzag_encode(dy));
                }
            }
            
            Ok((GeomType::Linestring, commands))
        }
        TileGeometry::Polygon(rings) => {
            if rings.is_empty() {
                return Err("Polygonが空です".to_string());
            }
            
            let mut commands = Vec::new();
            
            for ring in rings {
                if ring.len() < 4 {
                    // Polygonは最低4点必要（最初と最後が同じ）
                    continue;
                }
                
                // GeoJSONでは最後の点=最初の点なので、最後の点を除外
                let point_count = ring.len() - 1;
                
                // MoveTo 最初の点
                commands.push(command_integer(1, 1));
                commands.push(zigzag_encode(ring[0].0));
                commands.push(zigzag_encode(ring[0].1));
                
                // LineTo 残りの点（最後の点は除く）
                if point_count > 1 {
                    commands.push(command_integer(2, (point_count - 1) as u32));
                    
                    for i in 1..point_count {
                        let dx = ring[i].0 - ring[i - 1].0;
                        let dy = ring[i].1 - ring[i - 1].1;
                        commands.push(zigzag_encode(dx));
                        commands.push(zigzag_encode(dy));
                    }
                }
                
                // ClosePath
                commands.push(command_integer(7, 1));
            }
            
            Ok((GeomType::Polygon, commands))
        }
    }
}

/// コマンドとカウントをエンコード
fn command_integer(id: u32, count: u32) -> u32 {
    (id & 0x7) | (count << 3)
}

/// Zig-Zagエンコーディング
fn zigzag_encode(n: i32) -> u32 {
    ((n << 1) ^ (n >> 31)) as u32
}

/// JSON値をMVT値に変換
fn json_to_mvt_value(value: &serde_json::Value) -> Value {
    match value {
        serde_json::Value::String(s) => Value {
            string_value: Some(s.clone()),
            ..Default::default()
        },
        serde_json::Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                Value {
                    int_value: Some(i),
                    ..Default::default()
                }
            } else if let Some(f) = n.as_f64() {
                Value {
                    double_value: Some(f),
                    ..Default::default()
                }
            } else {
                Value::default()
            }
        }
        serde_json::Value::Bool(b) => Value {
            bool_value: Some(*b),
            ..Default::default()
        },
        _ => Value::default(),
    }
}

/// 値のキー（ハッシュマップ用）
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
enum ValueKey {
    String(String),
    Int(i64),
    Double(String), // f64はHashできないので文字列化
    Bool(bool),
}

impl ValueKey {
    fn from_json(value: &serde_json::Value) -> Self {
        match value {
            serde_json::Value::String(s) => ValueKey::String(s.clone()),
            serde_json::Value::Number(n) => {
                if let Some(i) = n.as_i64() {
                    ValueKey::Int(i)
                } else if let Some(f) = n.as_f64() {
                    ValueKey::Double(f.to_string())
                } else {
                    ValueKey::String("0".to_string())
                }
            }
            serde_json::Value::Bool(b) => ValueKey::Bool(*b),
            _ => ValueKey::String(String::new()),
        }
    }
}
