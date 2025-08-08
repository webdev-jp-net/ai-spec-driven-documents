# ai-spec-driven-documents

AIエージェントとの協働開発のためのテンプレートリポジトリ。  
Everything as codeで仕様書駆動開発を支援するルール・ドキュメント構成を提供。

## 🎯 概要

このテンプレートは、LLMベースのAIエージェントと効率的に協働開発を行うための標準構成を提供します。

## 📁 ディレクトリ構成

```
├── _llm-rules/        # AI動作制御ルール
├── _llm-docs/         # プロジェクト仕様書
├── _llm-memories/     # 学習記録
├── tools/             # MCPサーバー（AIエージェント連携ツール）
└── README.md          # このファイル
```

各AIエージェント（Cursor、Windsurf、Claude Codeなど）用のエントリーポイントファイルが自動的に認識されます。

## 🚀 環境設定

### 前提条件
- Deno 1.40+
- Git
- GitHub CLI (オプション: Issue管理機能を使用する場合)

### インストール
このリポジトリの構成をベースに、開発データを追加してください。

1. リポジトリをテンプレートとして使用またはクローン
2. 依存関係のインストール
   ```bash
   # Deno環境のセットアップ（node_modulesが作成されます）
   deno install
   ```

## 📋 初期設定

### プロジェクト仕様書の作成
`_llm-docs/`ディレクトリにサンプルとして設置しているプロジェクト仕様を開発対象のプロジェクトに合わせて変更します：

- **`requirements_definition.md`** - プロジェクト概要と要件定義
- **`dictionary.md`** - 用語辞書（統一した用語管理）
- **`contents/`** - 各機能の詳細仕様書

### 開発ルールのカスタマイズ（オプション）
必要に応じて`_llm-rules/`内のルールを調整できます。デフォルトのルールで多くのケースに対応可能です。

### MCPサーバーの設定（オプション）
`tools/mcp-server/`にはModel Context Protocolサーバーが含まれており、以下の機能を提供します：
- GitHub Issue/PR管理の自動化
- プロジェクトドキュメントの動的探索
- 用語統一チェック

詳細は[MCPサーバー仕様書](_llm-docs/mcp/tech_structure.md)を参照してください。

## 🔧 開発の進め方

1. **AIエージェントでプロジェクトを開く**
   - Cursor、Windsurf、Claude Codeなどに対応
   - 各エージェント向けエントリーポイントには`_llm-rules/session_control.md`を最初に参照する指示
   - プロジェクト仕様に基づいた開発支援を自動開始

2. **仕様駆動での開発**
   - `_llm-docs`の仕様書を参照しながら実装
   - 用語辞書による一貫性のある開発

## 📝 カスタマイズ

- **プロジェクト仕様**: `_llm-docs/requirements_definition.md`を編集
- **用語統一**: `_llm-docs/dictionary.md`に用語を追加
- **開発ルール**: `_llm-rules/`内のファイルを調整

## 💐 謝辞

このテンプレートは以下のプロジェクトから多くを学ばせていただきました：

- [Next-Stage](https://next-stage-demo.vercel.app/) - `_llm-docs`と`_llm-rules`構成の基盤設計や、`core_rules.md`のコアルール