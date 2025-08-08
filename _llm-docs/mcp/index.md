# MCPツールクイックリファレンス

## 📋 概要

このドキュメントは、MCP（Model Context Protocol）サーバーが提供するツールの使い方をまとめたクイックリファレンスです。

### MCPサーバーの役割
- **Issue管理の自動化**: DRAFT → GitHub Issue → Projects連携
- **AI支援のタスク分解**: 自然言語の要件からIssue候補を生成
- **品質管理**: 重複チェック、用語統一、ドキュメント提案

### 主な利用シーン
- プロジェクトのルールや仕様を調べたい時
- 新機能の要件からタスクを分解したい時
- 過去の実装や対応履歴を確認したい時

## 🎯 よく使うMCPツール

日常的な開発作業で特に活用される主要ツール：

- `search_documents` - ドキュメント検索（ルール確認、仕様調査）
- `generate_task` - タスク分解とIssue候補生成
- `read_document` - ドキュメント読み取り（詳細確認）
- `manage_memory` - LLM学習記録ファイルの管理

### `search_documents` - ドキュメント検索
**用途**: プロジェクト内のドキュメントから必要な情報を素早く検索

```bash
# プロジェクトルールの確認
mcp__ai-spec-driven-document__search_documents \
  query="session_control"

# 特定ディレクトリでの検索
mcp__ai-spec-driven-document__search_documents \
  query="必須" \
  directories='["_llm-rules"]' \
  includeContext=true

# 正規表現での高度な検索
mcp__ai-spec-driven-document__search_documents \
  query="Issue.*(作成|管理)" \
  useRegex=true
```

**活用場面**:
- プロジェクトルールの確認
- 実装前の既存仕様調査
- 用語の正式名称確認
- 過去の学習記録検索

### `generate_task` - タスク分解とIssue候補生成
**用途**: 大きな要件を適切な粒度のタスクに分解し、Issue候補を生成

```bash
# 基本的な使い方
mcp__ai-spec-driven-document__generate_task \
  order="ユーザー認証機能を実装したい"

# 技術的コンテキスト付き
mcp__ai-spec-driven-document__generate_task \
  order="管理画面のダッシュボードを作成" \
  context="React 19.1.0, TypeScript 5.8, Chakra UI使用"

# DRAFTに自動保存
mcp__ai-spec-driven-document__generate_task \
  order="API性能改善" \
  save_to_draft=true
```

**重要**: このコマンドは明示的に指定した場合のみ実行されます。「Issueを作って」等の曖昧な表現では動作しません。

### `read_document` - ドキュメント読み取り
**用途**: 検索で見つかったドキュメントの内容を詳しく確認

```bash
# ファイル全体を読む
mcp__ai-spec-driven-document__read_document \
  path="_llm-docs/dictionary.md"

# 特定の範囲だけ読む
mcp__ai-spec-driven-document__read_document \
  path="_llm-rules/session_control.md" \
  startLine=69 \
  endLine=80
```

**活用場面**:
- 検索結果の詳細確認
- 大きなファイルの部分読み取り
- ルールや仕様の正確な把握

## 🔧 その他のツール

### `sync_with_github` - GitHubとの双方向同期
**用途**: DRAFTからGitHub Issueを作成し、同時にGitHubの最新状態（OPEN/CLOSED）をmdファイルに反映

```bash
# 標準的な同期（DRAFTがあれば作成、GitHub状態を取得してmdに反映）
mcp__ai-spec-driven-document__sync_with_github repo="[設定で定義されたリポジトリキー]"

# クローズされたIssueも含めて同期
mcp__ai-spec-driven-document__sync_with_github repo="[設定で定義されたリポジトリキー]" include_closed=true

# 同期後は学習記録の整理を推奨
mcp__ai-spec-driven-document__manage_memory action=sync
```

**動作内容**:
1. DRAFTセクションのIssueをGitHubに作成
2. GitHubのOPEN/CLOSEDのIssue情報を取得
3. `_llm-memories/issues.md`を最新状態に更新
4. DRAFTセクションをクリア


## 🔧 その他のツール詳細

### `check_terminology` - 用語統一チェック（内部ツール）
**用途**: プロジェクトの統一用語に準拠しているか確認（自動実行）

**注意**: このツールは内部ツールのため、直接呼び出しはできません。
他のツール（`sync_with_github`等）から自動的に実行されます。

**自動実行される機能**:
- Issue本文の用語統一チェック
- `.mcp.json`設定で指定された辞書ファイルをベースとした用語修正
- カテゴリ別用語分類とコンテキスト提案

### `save_draft_issues` - DRAFT保存（内部ツール）
**用途**: Issue候補を手動でDRAFTセクションに保存

**注意**: このツールは内部ツールのため、直接呼び出しはできません。
`generate_task`の`save_to_draft=true`オプションを使用してください。

**構造化形式での保存**:
- title, body, labels, category, priority, section, state等の必要フィールド
- labelとsectionはパススルー値（解析・変換なし）
- フィールド構成は[Issue形式仕様書](../../_llm-rules/issue/format.md)に準拠

### `manage_github_projects` - Projects管理
**用途**: GitHub ProjectsへのIssue追加、設定確認

```bash
# アクセス確認
mcp__ai-spec-driven-document__manage_github_projects action="check_access"

# Issue追加
mcp__ai-spec-driven-document__manage_github_projects \
  action="add_issue" \
  issue_url="https://github.com/[組織名]/[リポジトリ名]/issues/123" \
  repo="[設定で定義されたリポジトリキー]"
```

## 📋 実践的なワークフロー

### ドキュメント調査ワークフロー
プロジェクトのルールや仕様を調べる際の効率的な手順：

1. **キーワード検索で関連ファイルを特定**
   ```bash
   # 例：「session_control」に関する情報を探す
   mcp__ai-spec-driven-document__search_documents \
     query="session_control" \
     maxResults=5
   ```

2. **特定のルールカテゴリを絞り込み検索**
   ```bash
   # 例：_llm-rulesディレクトリ内で「必須」ルールを検索
   mcp__ai-spec-driven-document__search_documents \
     query="必須" \
     directories='["_llm-rules"]' \
     includeContext=true
   ```

3. **見つかったファイルの詳細を読む**
   ```bash
   # 例：特定箇所を詳しく確認
   mcp__ai-spec-driven-document__read_document \
     path="_llm-rules/session_control.md" \
     startLine=69 \
     endLine=80
   ```

**活用シーン**:
- 🔍 プロジェクトルールの確認
- 📖 既存仕様の調査
- 🏷️ 用語の正式名称確認
- 📝 過去のIssue対応履歴の確認

### Issue作成ワークフロー（3ステップ）
1. **タスクの提案**: `generate_task`で要件を分析（`save_to_draft=true`推奨）
   - **AI支援Issue生成**: 定型文テンプレートではなく、AIが収集情報を基に動的思考・生成
   - **動的ドキュメント探索**: エントリーポイントから関連ドキュメントを自動探索
   - **パススルー値処理**: labelとsectionは解析・変換せず、指定値をそのまま使用
2. **DRAFTレビュー**: `_llm-memories/issues/[リポジトリキー].md`で内容確認・必要に応じて編集
3. **GitHub同期**: `sync_with_github`で一括処理（デバッグや手動実行時）
   - Issue作成時に自動で実行される処理：
     - ✅ 重複チェック（既存Issueとの類似度確認）
     - ✅ 用語統一（設定で指定された辞書ファイルに基づく自動修正）
     - ✅ 関連ドキュメント提案（description内に自動追加）
     - ✅ GitHub Projects追加（設定ベースのマッピング）

## 🔨 個別ツールの詳細

### 品質管理ツール

### 学習記録管理
- **`manage_memory`**: LLM学習記録ファイルの確認
  ```bash
  # 現在の状態を確認
  mcp__ai-spec-driven-document__manage_memory action=check
  ```
- **`check_terminology`**: `sync_with_github`でIssue生成時に自動実行される（内部ツールのため直接呼び出し不可）

### ドキュメント操作ツール
- **`search_documents`**: プロジェクト内のドキュメントを横断検索（キーワード/正規表現対応）
- **`read_document`**: 特定のドキュメントを読み取り（全体/部分読み取り対応）

### 手動操作ツール
- **`save_draft_issues`**: Issue候補を手動で追加・修正したい場合
- **`manage_github_projects`**: Projects設定の確認や手動調整が必要な場合

## 🚀 実践的なTips

### 効果的な使い方
- **明確な要件**: `generate_task`は具体的な要件ほど精度が高い
- **コンテキスト活用**: 技術スタックや制約を`context`パラメーターで指定
- **DRAFT編集**: 生成されたDRAFTは積極的に編集（不要なものは削除）

### トラブルシューティング
- **重複警告**: 60%以上の類似度で警告（閾値は調整可能）
- **同期エラー**: GitHub CLIの認証状態を確認
- **Projects連携**: 初回は`check_access`で設定確認を推奨

## 📚 関連ドキュメント
- [MCP技術構造](./tech_structure.md) - 詳細な技術仕様
- [Issue管理設定](../issue-management-config.md) - Issue管理の詳細設定
- [GitHub Projects設定](../github-projects-config.md) - Projects連携設定