# セットアップ手順

## 📋 現在の状況

プロジェクトの基本構造とRustコアの実装が完了しました。

### ✅ 完了した項目

1. **プロジェクト構造の初期化**
   - Rustコア（core/）の完全な実装
   - Reactフロントエンド（frontend/）の雛形作成
   - テストデータの準備

2. **Rustコア実装（core/）**
   - GeoJSON解析モジュール
   - 座標投影モジュール（WGS84 → WebMercator）
   - タイル振り分けモジュール
   - MVTエンコーダー（Protocol Buffers）
   - WebAssembly API
   - CLIツール（テスト用）

3. **ドキュメント**
   - README.md
   - SETUP.md（このファイル）
   - .gitignore

## 🚀 次のステップ

### ステップ1: Rustのインストール

```bash
# rustupをインストール
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# パスを通す
source $HOME/.cargo/env

# インストール確認
rustc --version
cargo --version
```

### ステップ2: Rustプロジェクトのビルド

```bash
cd core

# 依存関係のダウンロードとビルド
cargo build

# リリースビルド（最適化あり）
cargo build --release

# テスト実行
cargo test
```

### ステップ3: CLIツールでタイル生成テスト

```bash
# core/ディレクトリで実行
cargo run --bin cli ../test_data/points.geojson ../test_output 0 5 cities

# 結果確認
ls -R ../test_output
# test_output/0/0/0.pbf などが生成されます
```

### ステップ4: Node.jsのインストール

```bash
# Homebrewを使用（macOS）
brew install node

# または公式サイトからダウンロード
# https://nodejs.org/

# インストール確認
node --version
npm --version
```

### ステップ5: フロントエンドの依存関係インストール

```bash
cd frontend

# 依存関係をインストール
npm install
```

### ステップ6: Wasm化（次のフェーズ）

```bash
# wasm-packのインストール
cargo install wasm-pack

# Wasmビルド
cd core
wasm-pack build --target web --out-dir ../frontend/src/wasm

# フロントエンド起動
cd ../frontend
npm run dev
```

## 📝 補足事項

### TypeScriptエラーについて

現在、VSCodeでTypeScriptのエラーが表示されていますが、これは`npm install`を実行していないためです。ステップ5を完了すれば解消されます。

### Rustのビルドエラーについて

Protocol Buffersのコンパイルに失敗する場合は、以下を確認してください：

```bash
# protocのインストール（macOS）
brew install protobuf

# インストール確認
protoc --version
```

### MapLibreプレビュー機能

現在のMVP版では、タイルのプレビュー機能は実装していません。生成された`.pbf`ファイルは、別途MapLibre GL JSで表示確認できます。

## 🔍 トラブルシューティング

### cargoコマンドが見つからない

```bash
# パスを通す
source $HOME/.cargo/env

# または.zshrcに追加
echo 'export PATH="$HOME/.cargo/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### ビルドが遅い

初回ビルドは依存関係のダウンロードとコンパイルのため時間がかかります（5-10分程度）。

### メモリ不足エラー

大きなGeoJSONファイル（50MB以上）を処理する場合は、メモリ最適化が必要になる可能性があります。まずは小さなファイルでテストしてください。

## 📞 サポート

問題が発生した場合は、以下を確認してください：

1. Rustのバージョン: `rustc --version` (1.70以上推奨)
2. Node.jsのバージョン: `node --version` (18以上推奨)
3. エラーメッセージの全文

## 次回の作業

1. ✅ CLIツールでのタイル生成確認
2. 🔄 Wasm化の実装
3. 🔄 WebWorkerとの統合
4. 🔄 React UIでのタイル生成
5. ⏳ GitHub Pagesデプロイ
