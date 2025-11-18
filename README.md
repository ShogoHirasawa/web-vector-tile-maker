# Vector Tile Builder

ブラウザ上でベクタータイル (.pbf / .pmtiles) を生成する Web アプリ

## 🎯 概要

完全クライアントサイドで動作するベクタータイル生成ツールです。
GeoJSON をアップロードし、ブラウザ内でタイルに変換してダウンロードできます。

## 🏗 技術スタック

- **Rust + WebAssembly**: タイル生成のコア処理
- **React + TypeScript + Vite**: フロントエンド UI
- **MapLibre GL JS**: マップ表示（プレビュー機能）

## 📦 プロジェクト構成

```
vector tile builder/
├─ core/                     # Rust（Wasmコア）
│   ├─ Cargo.toml
│   ├─ build.rs
│   ├─ proto/                # Protocol Buffer定義
│   └─ src/
│       ├─ lib.rs            # メインライブラリ
│       ├─ geojson_parser.rs # GeoJSON解析
│       ├─ projection.rs     # 座標投影
│       ├─ tiler.rs          # タイル振り分け
│       ├─ mvt_encoder.rs    # MVTエンコーダー
│       └─ bin/
│           └─ cli.rs        # CLIツール（テスト用）
├─ frontend/                 # Reactアプリ
│   ├─ package.json
│   ├─ vite.config.ts
│   └─ src/
│       ├─ main.tsx
│       ├─ App.tsx
│       └─ worker.ts         # WebWorker
├─ test_data/                # テスト用データ
│   └─ points.geojson
└─ docs/                     # GitHub Pages 公開ディレクトリ（ビルド後生成）
```

## 🚀 セットアップ

### 1. Rustのインストール

```bash
# rustupをインストール
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# パスを通す
source $HOME/.cargo/env

# WebAssemblyターゲットを追加
rustup target add wasm32-unknown-unknown

# wasm-bindgen-cliをインストール
cargo install wasm-bindgen-cli
```

### 2. Node.jsのインストール

Node.js 18以上が必要です。

```bash
# Homebrewを使用する場合（macOS）
brew install node

# または公式サイトからダウンロード
# https://nodejs.org/
```

## 🧪 フェーズ1: Rust CLIでのテスト

### ビルド

```bash
cd core
cargo build --release
```

### CLIツールの実行

```bash
# 使用方法
cargo run --bin cli <geojson_file> <output_dir> <min_zoom> <max_zoom> [layer_name]

# 例: test_data/points.geojson からズームレベル0-5のタイルを生成
cargo run --bin cli ../test_data/points.geojson ../test_output 0 5 cities

# 結果はtest_output/ディレクトリに保存されます
# test_output/0/0/0.pbf
# test_output/1/0/0.pbf
# ...
```

### テストの実行

```bash
cd core
cargo test
```

## 🌐 フェーズ2: Wasm化 + Webアプリ

### ローカル開発

```bash
# 1. Wasmビルド
cd core
wasm-pack build --target web --out-dir ../frontend/src/wasm

# 2. フロントエンド起動
cd ../frontend
npm install
npm run dev
```

ブラウザで http://localhost:5173 を開く

### プロダクションビルド

```bash
# Wasmビルド
cd core
wasm-pack build --target web --out-dir ../frontend/src/wasm

# フロントエンドビルド
cd ../frontend
npm run build

# 結果は frontend/dist/ に出力されます
```

### GitHub Pagesへのデプロイ

```bash
git add .
git commit -m "Update build"
git push origin main
```

GitHub Actionsが自動的にビルド＆デプロイを実行します。
デプロイ後、以下のURLでアクセスできます:
https://shogohirasawa.github.io/web-vector-tile-maker/

## 📝 サポートするGeoJSON形式

- **入力**: FeatureCollection
- **ジオメトリタイプ**: 
  - ✅ Point
  - ✅ LineString
  - ✅ Polygon
  - ⏳ MultiPoint / MultiLineString / MultiPolygon（将来対応予定）

## 🎛 出力形式

- **MVT (.pbf)**: ディレクトリ構造 `{z}/{x}/{y}.pbf`
- **PMTiles**: 単一ファイル（将来対応予定）

## 📊 対応ズームレベル

- ZL 0 〜 15

## 🔧 開発状況

### ✅ 完了

- [x] プロジェクト構造の初期化
- [x] Rustコアモジュールの実装
  - [x] GeoJSON解析
  - [x] 座標投影（WGS84 → WebMercator）
  - [x] タイル振り分け
  - [x] MVTエンコーダー
- [x] CLIツールの実装

### 🚧 作業中

- [ ] Wasm化
- [ ] React UIの実装
- [ ] WebWorker統合

### 📋 今後の予定

- [ ] LineString/Polygonのタイル境界クリッピング改善
- [ ] メモリ最適化
- [ ] PMTiles形式対応
- [ ] MapLibreプレビュー機能
- [ ] GitHub Pagesデプロイ

## 📄 ライセンス

MIT License

## 🤝 貢献

Issue や Pull Request を歓迎します！
