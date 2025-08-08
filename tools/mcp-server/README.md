# Project MCP Server

DenoベースのModel Context Protocol (MCP) サーバーで、プロジェクトドキュメントリポジトリ内でのAIエージェント（Cursor、Windsurf、Claude Code等）利用時にプロジェクトルールやドキュメント、Issue管理機能を提供します。

## プロジェクト設定

MCPサーバーはプロジェクト固有の設定を `.mcp.json` ファイルの `config` セクションから読み込みます。これにより、MCPツールは完全にプロジェクトから独立し、任意のプロジェクトで再利用可能になります。

## 📋 機能概要

**詳細仕様**: [MCPサーバー技術仕様書](../../_llm-docs/operation/mcp/tech_structure.md)

### ツール (Tools)
- **sync_with_github**: GitHubとの完全同期実行（NOT_PLANNED除外、GitHub Projects連携）
- **generate_task**: タスク生成（明示的コマンド実行時のみ動作。自然言語から適切粒度のタスク分解とIssue候補生成）
- **manage_github_projects**: GitHub Projects管理（アクセス確認、Issue追加、設定表示）
- **manage_memory**: 学習記録ファイル管理（時系列ソート、状態確認）

#### 内部ツール（直接呼び出し不可）
- **check_terminology**: 用語統一チェック・修正提案（内部使用のみ）
- **save_draft_issues**: Issue候補をDRAFTセクションに保存（内部使用のみ）

> **📖 詳細仕様**: Issue形式の技術仕様については [Issue形式仕様書](../../_llm-rules/issue/format.md) を参照してください。

### リソース (Resources)
- **_llm-docs/**: プロジェクトドキュメント
- **_llm-rules/**: AIルールとガイドライン
- **_llm-memories/issues/**: Issue管理ファイル
- **terminology://**: 用語辞書リソース（dictionary.mdベース）

## 🚀 セットアップ

### 前提条件
- Deno 1.40+ (推奨)
- GitHub CLI (`gh`) インストール済み
- GitHub認証済み (`gh auth login`)

### AIエージェント設定

プロジェクトルートの `.mcp.json` ファイルに以下を設定:

```json
{
  "mcpServers": {
    "ai-spec-driven-document": {
      "command": "deno",
      "args": [
        "run",
        "--allow-env",
        "--allow-read=.,_llm-docs,_llm-rules,_llm-memories",
        "--allow-write=_llm-memories",
        "--allow-net=api.github.com",
        "--allow-run=gh",
        "--allow-sys=homedir",
        "tools/mcp-server/server.ts"
      ],
      "config": {
        "github": {
          "ownerType": "organization",
          "ownerName": "your-org-name",
          "projectNumber": 1  // オプション: 未設定時はGitHub Projects連携なし
        },
        "repositories": {
          "main": "your-org-main-project",
          "docs": "your-org-documentation",
          "web": "your-org-website",
          "mobile": "your-org-mobile-app"
        },
        "documents": {
          "entryPoint": "_llm-docs/requirements_definition.md",
          "dictionary": "_llm-docs/dictionary.md",
          "implementationPrinciples": "_llm-rules/implementation_principles.md",
          "coreRules": "_llm-rules/core_rules.md",
          "githubProjectsConfig": "_llm-docs/github-projects-config.md",
          "taskManagementRule": "_llm-rules/task_management_rule.md",
          "issueGenerationRule": "_llm-rules/issue_generation_rule.md"
        },
        "directories": {
          "docs": "_llm-docs",
          "rules": "_llm-rules",
          "memories": "_llm-memories",
          "issues": "_llm-memories/issues"
        }
      }
    }
  }
}
```

**注意**: `config` セクションをプロジェクトに合わせて変更することで、任意のプロジェクトで利用可能です。

**動作確認**:
```bash
# MCPサーバーテスト
deno task mcp:start

# JSON-RPC初期化テスト
echo '{"jsonrpc":"2.0","method":"initialize","id":1,"params":{"protocolVersion":"2024-11-05","capabilities":{}}}' | deno task mcp:start
```

## 🛠️ 使用方法

1. **リポジトリルートに配置**: プロジェクトのルートに `.mcp.json` ファイルを配置し、`config` セクションをプロジェクトに合わせて設定
2. **AIエージェント起動**: リポジトリ内で AIエージェントを起動すると MCP サーバーが自動接続
3. **機能利用**: プロジェクトルールやドキュメントが利用可能に

**重要**: 
- 設定変更後はAIエージェントを再起動してください
- このMCPサーバーは `.mcp.json` の設定により任意のプロジェクトで動作します

### 主な利用シナリオ

#### Issue管理ワークフロー
```bash
# GitHubから最新Issue取得（NOT_PLANNED除外、GitHub Projects連携）
# repo引数にはrepositories設定で定義したキーを指定
# repositories設定が1つだけの場合は省略可能
sync_with_github repo="main"

# 智能Issue生成（候補表示のみ）
# target_repo引数にはrepositories設定で定義したキーを指定
# repositories設定が1つだけの場合は省略可能
generate_task order="ユーザー認証機能を実装したい" target_repo="main"

# 注意: save_draft_issuesは内部ツールのため、直接呼び出しはできません
# generate_taskのsave_to_draft=trueオプションを使用してください

# DRAFT確認後、GitHub同期（自動でGitHub Projectsに追加）
sync_with_github repo="main"

# 同期後、学習記録ファイルを整理（推奨）
manage_memory action="sync"
```

#### 用語統一システム（内部機能）
```bash
# 注意: check_terminologyは内部ツールのため、直接呼び出しはできません
# 他のツールから自動的に利用されます
```

#### 智能Issue生成システム
```bash
# 自然言語オーダーからIssue生成
# repositories設定: main="your-main-repo"の場合
generate_task order="ユーザー認証機能を実装したい" target_repo="main"

# コンテキスト付きで生成
generate_task order="一括編集機能を追加" target_repo="main" context="セキュリティ重視"

# 強制再生成（キャッシュを無視）
# repositories設定: api="your-api-repo"の場合
generate_task order="API性能を改善したい" target_repo="api" force_regenerate=true
```

#### GitHub Projects管理
```bash
# プロジェクトアクセス確認
manage_github_projects action="check_access"

# Issueをプロジェクトに追加
# repositories設定でmain="your-main-repo"の場合
manage_github_projects action="add_issue" issue_url="https://github.com/owner/repo/issues/1" repo="main" labels="type:feature"

# 設定表示
manage_github_projects action="list_config"
```

## 📁 ディレクトリ構造

```
tools/mcp-server/
├── server.ts              # メインサーバー（stdio版）
├── dev/                    # 開発・テスト用ファイル
│   ├── test_*.ts          # 機能テスト
│   ├── debug_*.ts         # デバッグツール
│   └── README.md          # 開発ツール説明
├── types/                  # TypeScript型定義
│   ├── issue.ts
│   ├── rule.ts  
│   └── mcp.ts
├── handlers/               # ツールハンドラー
│   ├── github-sync.ts
│   ├── terminology-checker.ts
│   ├── intelligent-issue-analyzer.ts
│   ├── intelligent-issue-generator.ts
│   └── memory-manager.ts
├── resources/              # リソースプロバイダー
│   ├── docs-provider.ts
│   ├── rules-provider.ts
│   ├── issues-provider.ts
│   └── terminology-provider.ts
└── utils/                  # ユーティリティ
    ├── file-operations.ts
    ├── github-client.ts
    ├── duplicate-checker.ts
    ├── issue-file-manager.ts
    ├── debug-logger.ts       # デバッグ出力制御
    └── idempotency-manager.ts
```

## ⚙️ 設定

### 権限設定
MCPサーバーは以下の権限で動作します:
- `--allow-read`: ドキュメント・ルール・Issue読み取り
- `--allow-write`: Issue管理ファイル更新
- `--allow-net`: GitHub API通信
- `--allow-run`: GitHub CLI実行
- `--allow-env`: 環境変数アクセス

### GitHub設定
```bash
# GitHub CLI認証（初回のみ）
gh auth login

# 認証状態確認
gh auth status
```

## 🔧 開発・デバッグ

### TypeScript チェック
```bash
deno task check
```

### フォーマット・Lint
```bash  
deno task format
deno task lint
```

### 環境変数とデバッグ制御
```bash
# デバッグモードを有効化
export MCP_DEBUG=true

# 詳細ログを有効化  
export MCP_VERBOSE=true

# 本番環境（デバッグ出力なし）
unset MCP_DEBUG MCP_VERBOSE
```

### ログ確認
```bash
# MCP通信ログ（AIエージェント）
# AIエージェント使用時のログは標準エラー出力に表示されます
deno task mcp:start  # 手動実行でログを確認

# デバッグ付きで実行
MCP_DEBUG=true MCP_VERBOSE=true deno task mcp:start
```

### 開発・テストツール
```bash
# 機能テスト実行
deno run --allow-all dev/test_direct.ts
deno run --allow-all dev/test_sync.ts

# デバッグツール実行  
deno run --allow-all dev/debug_labels.ts
```

## 🚨 トラブルシューティング

### よくある問題

1. **MCP Server Status: failed**
   ```bash
   # .mcp.jsonの設定を確認
   # deno task mcp:start で手動テストを実行
   # AIエージェントを完全に再起動
   ```

2. **GitHub認証エラー**
   ```bash
   gh auth login --web
   gh auth status  # 認証状態確認
   ```

3. **権限エラー**
   - deno.jsonの権限設定を確認
   - ファイルパスの読み取り権限を確認

4. **Connection closed エラー**
   - Denoのインストール状況を確認
   - 環境変数の設定を確認
   - AIエージェントを完全再起動

### 手動テスト実行

```bash
# MCPサーバーの直接テスト
deno task mcp:start

# JSON-RPCテスト例
echo '{"jsonrpc": "2.0", "method": "initialize", "id": 1, "params": {"protocolVersion": "2024-11-05", "capabilities": {}}}' | deno task mcp:start
```

## 設定ガイド

### プロジェクト設定のカスタマイズ

MCPサーバーは `.mcp.json` ファイルの `config` セクションからプロジェクト固有の設定を読み込みます。これにより、ツールは完全にプロジェクトから独立し、任意のプロジェクトで再利用可能です。

### 設定項目の説明

- **github**: GitHub関連の設定
  - `ownerType`: `"organization"`（組織）または `"user"`（個人アカウント）
  - `ownerName`: GitHub組織名またはユーザー名
  - `projectNumber`（オプション）: GitHub ProjectsのProject番号（未設定時はProjects連携をスキップ）

- **repositories**: リポジトリのマッピング
  - キー: リポジトリの識別子（main, docs, web等）
  - 値: 実際のGitHubリポジトリ名
  - 注意: リポジトリが1つだけの場合、repo引数を省略するとデフォルトで使用されます

- **documents**（オプション）: 各種ドキュメントファイルパスのカスタマイズ
  - `entryPoint`: エントリーポイントドキュメント（デフォルト: `_llm-docs/requirements_definition.md`）
  - `dictionary`: 用語辞書ファイル（デフォルト: `_llm-docs/dictionary.md`）
  - `implementationPrinciples`: 実装原則ドキュメント（デフォルト: `_llm-rules/implementation_principles.md`）
  - `coreRules`: コアルールドキュメント（デフォルト: `_llm-rules/core_rules.md`）
  - `githubProjectsConfig`: GitHub Projects設定ファイル（デフォルト: `_llm-docs/github-projects-config.md`）
  - `taskManagementRule`: タスク管理ルールファイル（デフォルト: `_llm-rules/task_management_rule.md`）
  - `issueGenerationRule`: Issue生成ルールファイル（デフォルト: `_llm-rules/issue_generation_rule.md`）

- **directories**（オプション）: 各種ディレクトリパスのカスタマイズ
  - `docs`: ドキュメントディレクトリ（デフォルト: `_llm-docs`）
  - `rules`: ルールディレクトリ（デフォルト: `_llm-rules`）
  - `memories`: 学習記録ディレクトリ（デフォルト: `_llm-memories`）
  - `issues`: Issueファイルディレクトリ（デフォルト: `_llm-memories/issues`）

### 他のプロジェクトでの利用方法

1. プロジェクトルートに `.mcp.json` を作成
2. `config` セクションをプロジェクトに合わせて設定
3. MCPサーバーのパスを調整（必要に応じて）
4. AIエージェントを起動して利用開始

### カスタムプロジェクト構造の例

プロジェクトが異なるディレクトリ構造を使用している場合の設定例：

```json
{
  "mcpServers": {
    "ai-spec-driven-document": {
      "command": "deno",
      "args": [
        "run",
        "--allow-env",
        "--allow-read=.,docs,rules,memory",
        "--allow-write=memory",
        "--allow-net=api.github.com",
        "--allow-run=gh",
        "--allow-sys=homedir",
        "tools/mcp-server/server.ts"
      ],
      "config": {
        "github": {
          "ownerType": "user",
          "ownerName": "my-username"
          // projectNumber未設定のため、GitHub Projects連携は無効
        },
        "repositories": {
          "main": "my-project"
        },
        "documents": {
          "entryPoint": "docs/requirements.md",
          "dictionary": "docs/dictionary.md",
          "implementationPrinciples": "rules/principles.md",
          "coreRules": "rules/core.md",
          "githubProjectsConfig": "docs/github-projects.md",
          "taskManagementRule": "rules/task-management.md",
          "issueGenerationRule": "rules/issue-generation.md"
        },
        "directories": {
          "docs": "docs",
          "rules": "rules",
          "memories": "memory",
          "issues": "memory/issues"
        }
      }
    }
  }
}

## 📚 参考情報

- [Model Context Protocol 仕様](https://modelcontextprotocol.io/docs)
- [Claude Desktop MCP設定](https://docs.anthropic.com/claude/docs/mcp)
- [Deno ランタイム](https://docs.deno.com/)
- [GitHub CLI](https://cli.github.com/manual/)

---

---

## 📦 バージョン情報

**v1.0.0** - 初回リリース (2025-07-10)

### ✨ 主要機能
- Issue重複チェック
- DRAFT Issue管理 (7フィールド対応)
- GitHub同期 + Projects連携
- AI支援Issue生成
- 用語統一チェック
- 関連ドキュメント提案

### 🛠️ 技術スタック
- TypeScript + Deno
- Zod スキーマバリデーション
- Model Context Protocol (MCP)
- GitHub CLI + API

🤖 **Generated with AI Agent** - Local MCP Server for Project Documentation