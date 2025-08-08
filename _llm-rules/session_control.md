---
description: Session Control Rules
globs: **/*
alwaysApply: true
---

# Session Control Rules

## 🎉 Session Initialization Confirmed
root-rules.mdc から正常に移行されました。セッション制御を開始します。

## MANDATORY PROCESS
0. **CHECK** current branch: `git status && git branch --show-current`
   - developブランチの場合: github_integration.mdを先に読み込み、featureブランチ作成後に続行
1. **READ** this file completely (このファイルを完全に読み込む)
2. **LOAD CORE PRINCIPLES** - 基本原則を最初に確認
   - `_llm-rules/core_rules.md` - 不明点確認・承認取得の原則
   - `_llm-rules/implementation_principles.md` - 実装の基本原則
3. **CHECK** project specifications in `_llm-docs/requirements_definition.md` (プロジェクト仕様を確認)
   - 技術基盤が必要な場合: [プロジェクト要件定義](../_llm-docs/requirements_definition.md)を参照
   - MCPツール利用: 理解のみ（実行は明示的要求時のみ）
4. **ANALYZE** the user's request and task context (ユーザーのリクエストとタスクの文脈を分析)
5. **SELECT** appropriate specialized rule(s) (適切な専門ルールを選択)
6. **LOAD** selected specialized rule(s) (選択した専門ルールを読み込み)
7. **START** task execution following core_rules.md process (core_rules.mdのプロセスに従って実行開始)
8. **UPDATE_ACTION** - タスク完了後、必ず以下のファイルを更新 (詳細は下記参照)

---

## 🛠️ MCP Tool Execution Policy

**明示的実行の絶対原則**
- ✅ **許可される実行**: ユーザーが具体的なツール名を指定した場合のみ
- ❌ **禁止される自動実行**: 
  - 「Issueを作って」等の曖昧な表現での自動実行
  - 文脈からの推測による実行
  - 「タスクを分解して」等の間接的要求での実行
  - AIの判断による「親切な」自動実行

**特に`generate_task`コマンドについて**
- 必ず `generate_task` という具体的なコマンド名の指定が必要
- 自然言語での暗黙的な要求では実行しない
- ユーザーが明示的に実行を要求した場合のみ動作

### 🎯 Available MCP Tools（理解のみ - 実行は要求時のみ）
- **sync_with_github**: GitHub双方向同期（DRAFT→Issue作成、状態同期）
- **check_duplicates**: Issue重複チェック（類似度スコアリング）
- **check_terminology**: 用語統一確認（dictionary.mdベース）
- **generate_task**: タスク生成（明示的コマンド実行時のみ、自然言語→タスク分解→Issue候補）
- **save_draft_issues**: DRAFT Issue保存（7フィールド形式）
- **manage_github_projects**: GitHub Projects管理（Issue追加、設定確認）
- **suggest_documents**: 関連文書提案（コンテキストベース検索）

**⚡ DX Policy**: セッション開始は高速化、MCPツール実行は明示的要求時のみ

---

## 📝 UPDATE_ACTION - 必須学習記録プロセス

### 🔄 タスク完了後の必須アクション
作業完了後、必ず以下のファイルを**マークダウンテーブル形式**で更新すること：

#### 1. `_llm-memories/learned.md`
```markdown
| 日時 | タスク概要 | 使用ルール | 学習内容 | 今後の改善点 |
|------|------------|------------|----------|--------------|
| YYYY-MM-DD HH:MM | [タスクの簡潔な説明] | [使用したルール一覧] | [新たに学んだこと] | [次回に活かすポイント] |
```

#### - `_llm-memories/right-from-the-start.md`
```markdown
| 日時 | セッション開始時の判断 | 選択理由 | 結果評価 | 最初からやり直すなら |
|------|------------------------|----------|----------|----------------------|
| YYYY-MM-DD HH:MM | [初期のルール選択・アプローチ] | [なぜその判断をしたか] | [結果は適切だったか] | [最初からならどうするか] |
```

#### - `_llm-memories/prompts.md`
```markdown
| 日時 | ユーザープロンプト | AI解釈 | 実行結果 | プロンプト改善提案 |
|------|-------------------|--------|----------|-------------------|
| YYYY-MM-DD HH:MM | [ユーザーの元の指示] | [AIがどう理解したか] | [実際の成果物] | [より良い指示方法の提案] |
```

### 🎯 記録の重要性
- **learned.md**: 技術的な学習内容の蓄積
- **right-from-the-start.md**: セッション制御の改善
- **prompts.md**: ユーザーとの対話品質向上

### ⚠️ 必須要件
- 各ファイルが存在しない場合は新規作成
- 必ずマークダウンテーブル形式で記録
- 具体的で将来参照可能な内容で記録
- 主観的な感想ではなく、客観的な事実と分析を記録

---

## 🔍 タスク分析フレームワーク

### タスクタイプの特定
以下の質問に答えて、タスクの性質を特定してください：

**主要な技術スタック:**
- Frontend development (React, Vue, Svelte, etc.) - フロントエンド開発
- Backend development (API, Database, Server) - バックエンド開発
- Full-stack development - フルスタック開発
- Testing/QA - テスト・品質保証
- Documentation - ドキュメント作成
- Configuration/Setup - 設定・セットアップ

**主要なアクションタイプ:**
- New implementation - 新規実装
- Bug fix/debugging - バグ修正・デバッグ
- Refactoring/optimization - リファクタリング・最適化
- Integration work - 統合作業
- Code review/analysis - コードレビュー・分析
- Planning/architecture - 計画・アーキテクチャ

**GitHub Integration Required:**
- Yes: Repository operations, PR creation, issue management - リポジトリ操作、PR作成、issue管理
- No: Local development only - ローカル開発のみ

---

## 🎯 ルール選択ロジック

### フロントエンド開発
**conditions:**
- UI/UXコンポーネントの作成・修正
- フロントエンドフレームワークの使用 (React, Vue, etc.)
- スタイリング、レイアウト、デザイン作業
- フロントエンド状態管理

**読み込むルール:**
- `_llm-rules/core_rules.md`（必須・確認済み）
- `_llm-rules/implementation_principles.md`（必須・確認済み）


### バックエンド開発
**conditions:**
- API開発・修正
- データベーススキーマ・クエリ
- サーバー設定
- 認証・認可

**読み込むルール:**
- `_llm-rules/core_rules.md`（必須・確認済み）
- `_llm-rules/implementation_principles.md`（必須・確認済み）

### テスト作業
**conditions:**
- テスト作成・修正
- テスト戦略計画
- QAプロセス
- テスト自動化

**読み込むルール:**
- `_llm-rules/core_rules.md`（必須・確認済み）
- `_llm-rules/implementation_principles.md`（実装関連・確認済み）
- `_llm-rules/test_rule.md`（メイン）
- プロジェクト固有のテスト設定は[プロジェクト要件定義](../../_llm-docs/requirements_definition.md)から参照

### GitHub実行・運用作業
**conditions:**
- 日常的なIssue作成・管理・ラベル付与
- PR作成・レビュー・マージ
- GitHub CLI（`gh`コマンド）の使用
- コミット・PRとIssueの連携運用
- ブランチ命名とリポジトリ操作
- GitHub Actions/Workflows

**読み込むルール:**
- `_llm-rules/core_rules.md`（必須・確認済み）
- `_llm-rules/implementation_principles.md`（コード関連の場合・確認済み）
- `_llm-rules/github_integration.md`（メイン）

**PR作成時の推奨フロー:**
- ドキュメント反映の確認: 実装に伴う仕様書・設計書の更新確認
  - 未反映の場合: **PR作成前に必ずドキュメントを更新**
- 学習記録の整理: `mcp__ai-spec-driven-document__manage_memory action=sort`
- 学習内容の記録: `_llm-memories/*.md`への追記
- PR作成: `gh pr create`（ドキュメント更新と学習記録の完了を確認後）

### タスク戦略・分解作業
**conditions:**
- 要件からのタスク分解
- プロジェクト開始時のタスク抽出
- 新スプリント開始時のタスク計画
- 構成図ベースのタスク設計
- 3段階ワークフロー（設計→実装→検証）でのタスク分解
- アジャイル×ウォーターフォールハイブリッドアプローチでの計画策定

**読み込むルール:**
- `_llm-rules/core_rules.md`（必須・確認済み）
- `_llm-rules/github_integration.md`（GitHub連携前提）
- `_llm-rules/task/management.md`（メイン）

### フルスタック開発
**conditions:**
- フロントエンド・バックエンド両方の作業
- エンドツーエンド機能実装
- システム統合

**読み込むルール:**
- `_llm-rules/core_rules.md`（必須・確認済み）
- `_llm-rules/implementation_principles.md`（必須・確認済み）
- `_llm-rules/github_integration.md`（リポジトリ作業が含まれる場合）
- `_llm-rules/test_rule.md`（テストが含まれる場合）

### ドキュメント・計画作業
**conditions:**
- ドキュメント作成
- アーキテクチャ計画
- 要件分析
- プロジェクトセットアップ

**読み込むルール:**
- `_llm-rules/core_rules.md`（必須・確認済み）

### 要件定義書作成作業
**conditions:**
- 要件定義書の新規作成・更新・修正
- 各サイト別の要件定義書からの要件抽出
- `_llm-docs`配下のサイト別要件定義所から内容を抽出
- `docs/requirements_specification.md`へのプロジェクト全体の要件定義書mdファイル設置

**読み込むルール:**
- `_llm-rules/core_rules.md`（必須・確認済み）

**作業内容:**
- `_llm-docs`配下のサイト別要件定義書を分析
- プロジェクト全体の要件定義書として必要な内容を抽出
- `docs/requirements_specification.md`にプロジェクト全体の要件定義書用のmdファイルを作成・更新

**重要な制約事項:**
- サイト別要件定義書に明記されていない機能や要件は追加しない
- 憶測や推測による内容の補完は禁止
- 未記入のセクションは「※サイト別要件定義書に記載なし」と明記
- 具体的な数値や仕様はサイト別要件定義書に記載がある場合のみ記載
- 業界の一般的な要件であっても、サイト別要件定義書に記載がなければ記載しない

### generate_taskコマンド実行作業
**conditions:**
- ユーザーが明示的に`generate_task`コマンドを指定
- 自然言語の要件からタスク分解が必要
- Issue候補の自動生成を要求
- **重要**: 「Issueを作って」等の曖昧な表現では実行しない

**読み込むルール:**
- `_llm-rules/core_rules.md`（必須・確認済み）
- `_llm-rules/github_integration.md`（GitHub連携前提）
- `_llm-rules/task/generation.md`（メイン - generate_task専用）
- `_llm-rules/task/management.md`（補助 - タスク管理戦略）
- `_llm-rules/issue/master.md`（補助 - Issue管理）

**作業内容:**
- 明示的なコマンド実行の確認
- 自然言語要件の分析とタスク分解
- 適切な粒度でのIssue候補生成
- DRAFTセクションへの保存（オプション）

### Issue候補生成・管理作業
**conditions:**
- 要件定義からのIssue候補生成
- DRAFT Issues管理とレビュー
- 既存IssueとDRAFTの重複チェック
- DRAFTからGitHub Issueへの一括作成
- Issue管理ワークフローの実行
- リポジトリ横断でのIssue調整
- Issue形式の仕様確認・実装

**読み込むルール:**
- `_llm-rules/core_rules.md`（必須・確認済み）
- `_llm-rules/implementation_principles.md`（技術要件の場合・確認済み）
- `_llm-rules/github_integration.md`（GitHub連携前提）
- `_llm-rules/issue/master.md`（メイン - Issue管理統合）
- `_llm-rules/issue/format.md`（補助 - 自動参照）

**技術仕様参照:**
- `_llm-rules/issue/format.md`（Issue形式技術仕様）
- `_llm-rules/issue/projects_integration.md`（GitHub Projects連携ルール）
- Issue管理・GitHub Projects固有設定は[プロジェクト要件定義](../../_llm-docs/requirements_definition.md)を参照

**作業内容:**
- プロジェクトの要件定義・詳細設計を分析
- Issue候補をDRAFTとして各リポジトリに生成
- 手動レビュー後の重複チェック・品質確認
- `sync-with-github.js`による一括Issue作成
- `_llm-memories/issues/[repo].md`での状態管理

**重要な実行手順:**
- 要件分析とDRAFT生成
- DRAFTセクションの手動レビュー・調整
- 重複チェック実行
- 承認されたDRAFTのGitHub登録
- 最新状態での同期完了

---

## 🧠 Context Memory Management

### セッション情報の追跡
```markdown
## Current Session Context
- **Task Type**: [上記の分析から特定されたタスクタイプ]
- **Technology Stack**: [関連する主要技術]
- **Loaded Rules**: [参照したルールファイルのリスト]
- **Special Considerations**: [特別な要件や制約]
- **Dependencies**: [関連ファイル、外部サービスなど]
```

### 学習統合
- 類似タスクに効果的なルール組み合わせを記録
- 現在のルールカバレッジのギャップを記録
- 共通パターンとエッジケースを追跡
- 結果に基づいてルール選択ロジックを更新
- すでに登録済みの記録を参照し重複していない情報のみ厳選して追加

---

## ⚡ クイックリファレンスガイド

### よくあるタスクパターン
```markdown
- **プロジェクト開始時のタスク分解**
  → task/management.md + github_integration.md + core_rules.md

- **新スプリントのタスク計画**
  → task/management.md + issue/generation.md + github_integration.md + core_rules.md

- **要件からのタスク抽出**
  → task/management.md + issue/generation.md + github_integration.md + core_rules.md

- **Issue作成作業**
  → issue/generation.md + github_integration.md + core_rules.md

- **Issue着手前の必須確認**
  → github_integration.md + core_rules.md
  → 必須実行: `git status` + `git branch --show-current`
  → developブランチの場合: 新規ブランチ作成
  → 作業ブランチの場合: 継続使用を確認

- **PR作成作業**
  → github_integration.md + core_rules.md
  → 事前確認1: ドキュメント反映（仕様書・設計書の更新）
  → 事前確認2: `mcp__ai-spec-driven-document__manage_memory action=sort`（直接実行）
  → 注意: ドキュメント更新と学習記録の完了を確認後にPR作成

- **新しいReactコンポーネント実装**
  → implementation_principles.md + core_rules.md
  → 詳細: 一般的なReactコンポーネントの実装

- **ページコンポーネント生成（scaffdog使用）**
  → ページコンポーネント生成カテゴリのルールを適用
  → 詳細: `_llm-docs/operation/generate-component.md`参照

- **API開発**
  → implementation_principles.md + core_rules.md

- **テスト作成**
  → test_rule.md + core_rules.md

- **フル機能実装**
  → implementation_principles.md + test_rule.md + core_rules.md

- **要件定義書作成（詳細設計からの抽出）**
  → core_rules.md
  → 出力先: docs/requirements_specification.md

- **要件からのIssue候補生成**
  → issue/master.md + github_integration.md + core_rules.md
  → 出力先: _llm-memories/issues/[repo].md (DRAFT Issues)
  → 形式仕様: issue/format.md

- **DRAFT Issuesレビュー・登録**
  → issue/master.md + github_integration.md + core_rules.md
  → ツール: MCPサーバー (sync_with_github)

- **Issue管理ワークフロー実行**
  → issue/master.md + github_integration.md + core_rules.md
  → 工程: DRAFT生成→レビュー→重複チェック→GitHub登録
  → 詳細: issue/master.mdで全体像を確認

- **generate_taskコマンドの明示的実行**
  → task/generation.md + task/management.md + issue/master.md + core_rules.md
  → ツール: MCPサーバー (generate_task)
  → 重要: 明示的なコマンド指定が必須
```

---

## 🚀 Next Action

タスク分析とルール選択完了後:

**PROCEED TO**: `_llm-rules/core_rules.md`

**REMEMBER**:
- 選択した専門ルールを最初に読み込み
- 実行開始前にALWAYS core_rules.mdを読み込み
- 一貫した品質のためにcore_rules.mdのプロセスに従う

---

## 🔄 継続的改善

### セッションフィードバックループ
各セッション終了時に評価:
- 選択したルールは適切だったか？
- ルール間の競合は発生したか？
- ルールカバレッジにギャップはあったか？
- ルール選択をどう改善できるか？

### Update Protocol
- セッションメモリに学習内容を記録
- ルール選択ロジックの更新を提案
- 必要に応じて新しいルールカテゴリを提案
- ルール効果メトリクスを維持

---

## 💡 実践的なヒント

### セッション開始時の推奨ワークフロー
作業を開始する際、以下のコマンドで環境を最新化できます：

```bash
# 作業リポジトリでDRAFT→GitHub同期（例: adminリポジトリ）
mcp__ai-spec-driven-document__sync_with_github repo="admin"

# 必要に応じて学習記録の確認
mcp__ai-spec-driven-document__manage_memory action=check
```

これにより、DRAFTの同期忘れを防ぎ、最新状態から作業を開始できます。

### 効率的な実行について
MCPツールは直接実行が推奨されます（Taskツール経由より高速）。

---

**⚠️ IMPORTANT**: このファイルはセッションフローの制御のみ。実際のタスク実行はすべてcore_rules.mdのプロセスに従います。
