# Issue Management Master Rules

## 概要
このドキュメントは、プロジェクトにおけるIssue管理の統合ルールです。
Issue関連のすべてのルールとプロセスへの入口となります。

> **📖 詳細仕様**: Issue形式の技術仕様については [Issue形式仕様](./format.md)、GitHub Projectsの汎用ルールについては [GitHub Projects連携ルール](./projects_integration.md)、プロジェクト固有設定については [Issue管理設定](../../_llm-docs/operation/issue-management-config.md) を参照してください。

## 🎯 Issue管理の全体像

### Issue管理フロー
```mermaid
graph LR
    A[要件分析] --> B[DRAFT生成]
    B --> C[レビュー・調整]
    C --> D[重複チェック]
    D --> E[GitHub登録]
    E --> F[Project管理]
    F --> G[状態同期]
```

## 📚 関連ルールファイル

### 1. Issue形式仕様
**ファイル**: `_llm-rules/issue_format_spec.md`
- Issue形式の統一仕様定義
- フィールド詳細と実装例
- すべてのツールが参照する基準

### 2. Issue生成・管理ルール
**ファイル**: `_llm-rules/issue_generation_rule.md`
- 要件からのIssue候補抽出
- DRAFT管理ワークフロー
- 重複チェックプロセス
- GitHub登録手順

### 3. GitHub統合ルール
**ファイル**: `_llm-rules/github_integration.md`
- GitHub CLI操作
- Issue作成・更新
- PR連携
- Projects管理

### 4. タスク管理ルール
**ファイル**: `_llm-rules/task/management.md`
- タスク分解の指針
- 3段階ワークフロー
- Issue間の依存関係管理

## 🔧 ツールとユーティリティ

### MCPサーバー
**ディレクトリ**: `tools/mcp-server/`
- `handlers/github-sync.ts`: GitHub同期処理
- `utils/issue-file-manager.ts`: ファイル管理
- `utils/duplicate-checker.ts`: 重複チェック
- `utils/github-projects.ts`: Projects連携

### レガシーツール（廃止予定）
**ディレクトリ**: `tools/issue-manager/`
- 段階的に廃止予定
- MCPサーバーへの移行を推進

## 📁 データ保存場所

### Issue管理ファイル
Issue管理ファイルは `_llm-memories/issues/` 配下に配置されます。
具体的なファイル構成はプロジェクト要件定義を参照してください。

### ファイル構造
```markdown
# [repo] Issue List

最終更新: YYYY-MM-DD

```
形式: #番号 | タイトル | label | category | priority | section | 状態
```

## DRAFT Issues
（GitHub未登録の候補）

## OPEN Issues
（GitHub同期済み、作業中）

## CLOSED Issues
（GitHub同期済み、完了）
```

## 🚀 実行手順

### 1. Issue候補生成（自然言語から）
```bash
# MCPツール使用
mcp__ai-spec-driven-document__generate_task
```

### 2. DRAFT管理
```bash
# DRAFT保存
mcp__ai-spec-driven-document__save_draft_issues

# 重複チェック
mcp__ai-spec-driven-document__check_duplicates
```

### 3. GitHub同期
```bash
# DRAFT → GitHub登録
mcp__ai-spec-driven-document__sync_with_github
```

### 4. Projects管理
```bash
# Issue追加
mcp__ai-spec-driven-document__manage_github_projects
```

## ⚠️ 注意事項

### 形式の統一
- 必ず `issue_format_spec.md` の形式に従う
- ツール間で一貫性を保つ

### 重複管理
- DRAFT作成前に既存Issueを確認
- 類似度60%以上は要確認
- タイトルの工夫で重複回避

### 権限管理
- GitHub CLI認証が必須
- Projects操作にはwrite権限必要
- 組織レベルの設定確認

## 🔄 移行計画

### Phase 1: 仕様統一（現在）
- [x] Issue形式仕様の策定
- [x] MCPサーバーへの実装
- [ ] 既存ツールの仕様参照対応

### Phase 2: ツール統合
- [ ] レガシーツールの機能移行
- [ ] MCPサーバーへの一本化
- [ ] 古いスクリプトの廃止

### Phase 3: 自動化強化
- [ ] AI支援の候補生成改善
- [ ] 自動重複検出の精度向上
- [ ] ワークフロー自動化

## 📖 参照順序

1. **このファイル**（全体像の把握）
2. `issue_format_spec.md`（形式の理解）
3. `issue_generation_rule.md`（生成プロセス）
4. `github_integration.md`（GitHub連携）
5. 必要に応じて個別ツールのドキュメント

---

**最終更新**: 2025-01-10
**バージョン**: 1.0.0