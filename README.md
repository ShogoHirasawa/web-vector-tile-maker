# Vector Tile Builder

A web application for generating vector tiles (.pbf / .pmtiles(In Progress)) in the browser

## 🎯 Overview

A completely client-side vector tile generation tool.
Upload GeoJSON and convert it to tiles directly in your browser for download.

## 🏗 Technology Stack

- **Rust + WebAssembly**: Core tile generation processing
- **React + TypeScript + Vite**: Frontend UI

## 📦 Project Structure

```
web-vector-tile-maker/
├─ core/                     # Rust (Wasm core)
│   ├─ Cargo.toml
│   ├─ build.rs
│   ├─ proto/                # Protocol Buffer definitions
│   └─ src/
│       ├─ lib.rs            # Main library
│       ├─ geojson_parser.rs # GeoJSON parsing
│       ├─ projection.rs     # Coordinate projection
│       ├─ tiler.rs          # Tile assignment
│       ├─ mvt_encoder.rs    # MVT encoder
│       └─ bin/
│           └─ cli.rs        # CLI tool (for testing)
├─ frontend/                 # React app
│   ├─ package.json
│   ├─ vite.config.ts
│   └─ src/
│       ├─ main.tsx
│       ├─ App.tsx
│       └─ worker.ts         # WebWorker
├─ test_data/                # Test data
│   └─ points.geojson
└─ .github/
    └─ workflows/
        └─ deploy.yml        # GitHub Actions CI/CD
```

## 🚀 Setup

### 1. Install Rust

```bash
# Install rustup
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Add to PATH
source $HOME/.cargo/env

# Add WebAssembly target
rustup target add wasm32-unknown-unknown

# Install wasm-bindgen-cli
cargo install wasm-bindgen-cli
```

### 2. Install Node.js

Node.js 18 or higher is required.

```bash
# Using Homebrew (macOS)
brew install node

# Or download from official website
# https://nodejs.org/
```

## 🧪 Phase 1: Testing with Rust CLI

### Build

```bash
cd core
cargo build --release
```

### Run CLI Tool

```bash
# Usage
cargo run --bin cli <geojson_file> <output_dir> <min_zoom> <max_zoom> [layer_name]

# Example: Generate zoom level 0-5 tiles from test_data/points.geojson
cargo run --bin cli ../test_data/points.geojson ../test_output 0 5 cities

# Results are saved in test_output/ directory
# test_output/0/0/0.pbf
# test_output/1/0/0.pbf
# ...
```

### Run Tests

```bash
cd core
cargo test
```

## 🌐 Phase 2: Wasm + Web App

### Local Development

```bash
# 1. Build Wasm
cd core
wasm-pack build --target web --out-dir ../frontend/src/wasm

# 2. Start frontend
cd ../frontend
npm install
npm run dev
```

Open http://localhost:5173 in your browser

### Production Build

```bash
# Build Wasm
cd core
wasm-pack build --target web --out-dir ../frontend/src/wasm

# Build frontend
cd ../frontend
npm run build

# Output is in frontend/dist/
```

## 📝 Supported GeoJSON Format

- **Input**: FeatureCollection
- **Geometry Types**:
  - ✅ Point
  - ✅ LineString
  - ✅ Polygon
  - ⏳ MultiPoint / MultiLineString / MultiPolygon (In Progress)

## 🎛 Output Formats

- **MVT (.pbf)**: Directory structure `{z}/{x}/{y}.pbf`
- **PMTiles**: Single file (In Progress)

## 📊 Supported Zoom Levels

- ZL 0 ~ 15

## 🔧 Development Status

### 📋 Future Plans

- [ ] PMTiles format support
- [ ] Data preview feature
- [ ] Drag & drop file upload

## 📄 License

MIT License

## 🤝 Contributing

Issues and Pull Requests are welcome!
