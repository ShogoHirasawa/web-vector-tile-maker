// CLI tool for testing vector tile generation
// Usage: cargo run --bin cli <geojson_file> <output_dir> <min_zoom> <max_zoom> [layer_name]

use std::env;
use std::fs;
use std::path::Path;
use vector_tile_core::generate_tiles;

fn main() {
    let args: Vec<String> = env::args().collect();
    
    if args.len() < 5 {
        eprintln!("Usage: {} <geojson_file> <output_dir> <min_zoom> <max_zoom> [layer_name]", args[0]);
        eprintln!("Example: {} data.geojson output 0 5 mylayer", args[0]);
        std::process::exit(1);
    }
    
    let geojson_path = &args[1];
    let output_dir = &args[2];
    let min_zoom: u8 = args[3].parse().expect("min_zoom must be a number");
    let max_zoom: u8 = args[4].parse().expect("max_zoom must be a number");
    let layer_name = if args.len() > 5 {
        &args[5]
    } else {
        "default"
    };
    
    println!("🚀 Starting vector tile generation");
    println!("  Input: {}", geojson_path);
    println!("  Output: {}", output_dir);
    println!("  Zoom: {} - {}", min_zoom, max_zoom);
    println!("  Layer: {}", layer_name);
    
    // Read GeoJSON file
    let geojson_bytes = fs::read(geojson_path)
        .expect("Failed to read GeoJSON file");
    
    println!("\n📖 Parsing GeoJSON...");
    
    // Generate tiles
    match generate_tiles(&geojson_bytes, min_zoom, max_zoom, layer_name) {
        Ok(tiles) => {
            println!("✅ Generated {} tiles", tiles.len());
            
            // Create output directory
            fs::create_dir_all(output_dir)
                .expect("Failed to create output directory");
            
            // Save tiles
            println!("\n💾 Saving tiles...");
            for tile in tiles {
                let tile_path = Path::new(output_dir).join(&tile.path);
                
                // Create directory
                if let Some(parent) = tile_path.parent() {
                    fs::create_dir_all(parent).ok();
                }
                
                // Write tile
                fs::write(&tile_path, &tile.data)
                    .expect(&format!("Failed to save tile: {}", tile.path));
                
                println!("  ✓ {}", tile.path);
            }
            
            println!("\n✨ Complete!");
        }
        Err(e) => {
            eprintln!("❌ Error: {}", e);
            std::process::exit(1);
        }
    }
}
