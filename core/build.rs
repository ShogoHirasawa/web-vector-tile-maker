// Build script for Protocol Buffer compilation

fn main() {
    prost_build::compile_protos(&["proto/vector_tile.proto"], &["proto/"])
        .expect("Failed to compile Protocol Buffer definitions");
}
