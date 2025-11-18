// CLI tool for testing vector tile generation
// Usage: cargo run --bin cli <geojson_file> <output_dir> <min_zoom> <max_zoom> [layer_name]

use std::env;
use std::fs;
use std::path::Path;
use vector_tile_core::generate_tiles;

fn main() {
    let args: Vec<String> = env::args().collect();
    
    if args.len() < 5 {
        eprintln!("使用方法: {} <geojson_file> <output_dir> <min_zoom> <max_zoom> [layer_name]", args[0]);
        eprintln!("例: {} data.geojson output 0 5 mylayer", args[0]);
        std::process::exit(1);
    }
    
    let geojson_path = &args[1];
    let output_dir = &args[2];
    let min_zoom: u8 = args[3].parse().expect("min_zoomは数値で指定してください");
    let max_zoom: u8 = args[4].parse().expect("max_zoomは数値で指定してください");
    let layer_name = if args.len() > 5 {
        &args[5]
    } else {
        "default"
    };
    
    println!("🚀 ベクタータイル生成開始");
    println!("  入力: {}", geojson_path);
    println!("  出力: {}", output_dir);
    println!("  ズーム: {} - {}", min_zoom, max_zoom);
    println!("  レイヤー: {}", layer_name);
    
    // GeoJSONファイルを読み込み
    let geojson_bytes = fs::read(geojson_path)
        .expect("GeoJSONファイルの読み込みに失敗しました");
    
    println!("\n📖 GeoJSON解析中...");
    
    // タイル生成
    match generate_tiles(&geojson_bytes, min_zoom, max_zoom, layer_name) {
        Ok(tiles) => {
            println!("✅ {}個のタイルを生成しました", tiles.len());
            
            // 出力ディレクトリを作成
            fs::create_dir_all(output_dir)
                .expect("出力ディレクトリの作成に失敗しました");
            
            // タイルを保存
            println!("\n💾 タイル保存中...");
            for tile in tiles {
                let tile_path = Path::new(output_dir).join(&tile.path);
                
                // ディレクトリを作成
                if let Some(parent) = tile_path.parent() {
                    fs::create_dir_all(parent).ok();
                }
                
                // タイルを書き込み
                fs::write(&tile_path, &tile.data)
                    .expect(&format!("タイルの保存に失敗: {}", tile.path));
                
                println!("  ✓ {}", tile.path);
            }
            
            println!("\n✨ 完了しました！");
        }
        Err(e) => {
            eprintln!("❌ エラー: {}", e);
            std::process::exit(1);
        }
    }
}
