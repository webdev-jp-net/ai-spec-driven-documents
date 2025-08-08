---
description: Issue候補生成・管理ルール
globs: **/*
alwaysApply: true
---

# Issue候補生成・管理ルール

## 🎯 基本原則

### DRAFTベースワークフロー
Issue候補管理は以下の段階的アプローチを採用する：

1. **DRAFT生成**: 
   - 要件定義から候補を抽出し、_llm-memories/issues/[repo].mdのDRAFTセクションに追加
   - **重要**: `generate_task`コマンドは明示的な実行時のみ動作
   - 自然言語での暗黙的な要求では自動実行されない
2. **手動レビュー**: ユーザーが不要なDRAFTを削除・編集
3. **重複チェック**: 既存Issue（OPEN/CLOSED）との類似度確認
4. **GitHub登録**: 承認されたDRAFTを実Issueとして作成
5. **同期完了**: 最新状態でファイル更新、DRAFTクリア

### ファイル構造の理解
```
_llm-memories/issues/[repo].md:
## DRAFT Issues        ← 候補段階
## OPEN Issues         ← GitHub同期済み
## CLOSED Issues       ← GitHub同期済み
```

---

## 📋 要件分析と候補抽出

### 要件定義の読み込み
- **対象ディレクトリ**: `_llm-docs/[section]/`
- **分析対象**: 詳細設計書、要件定義書、仕様書
- **重点ポイント**: 未実装機能、新規開発項目、改善要望

### Issue分解の基準

#### 適切な粒度
- **1Issue = 1-3日の作業量**: 大きすぎず小さすぎない単位
- **独立性**: 他のIssueに依存しない単体で完結する作業
- **テスト可能**: 完了条件が明確で検証可能
- **価値提供**: ユーザーまたはシステムに具体的な価値を提供

#### 分解パターン
```markdown
❌ 悪い例: "ユーザー管理機能の実装"
✅ 良い例: 
  - "ユーザー登録APIエンドポイントの作成"
  - "ユーザー登録フォームのUIコンポーネント実装"
  - "メール認証機能の追加"
  - "ユーザープロフィール編集機能"
```

### プロジェクト固有のIssue分類基準
プロジェクト固有のIssue分類基準（リポジトリ別、機能別、チーム別など）は、[プロジェクト要件定義](../../_llm-docs/requirements_definition.md) から辿れるIssue管理設定を参照してください。

---

## 🏷️ ラベル付与ルール

### 該当する場合

- `enhancement` - 既存機能改善
- `refactor` - リファクタリング
- `documents` - ドキュメント作成・更新
- `test` - テスト追加・修正
- `api` - API関連
- `database` - データベース
- `ui` - UI/UX

### GitHub Projects連携対応フォーマット

```
形式: #番号 | タイトル | label | category | priority | section | 状態
```

#### フィールド説明
- **label**: ラベル（enhancement, refactor, documents, test, api, database, ui）
- **category**: 技術領域（structure, frontend, backend, infrastructure）
- **priority**: 優先度（Critical, High, Medium, Low）
- **section**: プロジェクトで定義された分類（オプション）
- **状態**: Issue状態（DRAFT, OPEN, CLOSED）

#### 記載例
```markdown
- #- | ドキュメントの更新 | documents | structure | Medium | [section] | DRAFT
- #- | ユーザーリスト表示のテストコード追加 | test | frontend | Medium | [section] | DRAFT
- #- | APIレスポンス最適化 | refactor | backend | High | | DRAFT
```

#### 自動マッピング
- ラベルからProjects fieldsへの自動変換は`github-projects-config.md`に基づいて実行
- sync-with-github実行時に自動的にProjectsフィールドが設定される

---

## 🔍 重複チェック手順

### 自動チェック基準
- **完全一致**: 100% - 確実に重複
- **部分一致**: 80% - 高確率で重複
- **単語重複**: 60%以上 - 重複の可能性

### 手動確認が必要な場合
- 類似度60%以上の既存Issueが存在
- 同じ機能領域での複数Issue
- 関連する技術要素が重複

### 重複が検出された場合の対応
1. **既存Issueの確認**: 内容・ステータス・進捗を精査
2. **統合可能性の検討**: 既存Issueの拡張で対応可能か
3. **分割の検討**: 既存Issueを適切に分割すべきか
4. **DRAFT修正**: タイトル・スコープを調整して重複回避

---

## 🔄 同期ワークフローの実行

### 基本的な実行手順

#### 1. DRAFT生成
```bash
# MCPツール経由で生成（明示的なコマンド実行が必要）
mcp__ai-spec-driven-document__generate_task order="機能名を実装したい" target_repo="admin"
# 注意: 自然言語での暗黙的な要求では実行されません

# 手動追加の場合
node tools/issue-manager/generate-drafts.js --repo admin --title "機能名" --labels "type:feature, priority:high"
```

#### 2. 手動レビュー
- `_llm-memories/issues/[repo].md`を開く
- DRAFTセクションを確認
- 不要な項目を削除
- タイトル・ラベルを調整

#### 3. 同期実行
```bash
# MCPツール経由（推奨）
sync_with_github repo="admin"

# 直接実行も可能
node tools/issue-manager/sync-with-github.js --repo admin
```

### エラー対応

#### 重複チェックでブロック
- 類似度の高い既存Issueが表示される
- DRAFTの内容を調整して再実行
- または既存Issueの更新を検討

#### GitHub API エラー
- 認証情報の確認
- リポジトリアクセス権限の確認
- レート制限の確認

#### ファイル更新エラー
- ファイルの権限確認
- ディスク容量の確認
- ファイルロックの解除

---

## 🎮 運用ガイドライン

### タイミング

#### DRAFT生成のタイミング
- スプリント計画時
- 要件定義完了後
- 新機能の検討時
- バックログ整理時

#### 同期実行のタイミング
- Issue作成準備完了時
- スプリント開始前
- 緊急度の高いIssue追加時

### 推奨ツール
- **MCPツール**（推奨）: `generate_task`, `save_draft_issues`, `sync_with_github`
- **直接実行**: `tools/issue-manager/`配下のJavaScriptファイル

### 品質チェックポイント

#### DRAFT作成時
- [ ] タイトルが具体的で分かりやすい
- [ ] 適切な粒度に分解されている
- [ ] 必須ラベルが付与されている
- [ ] 正しいリポジトリに分類されている

#### 同期前
- [ ] 重複がないことを確認
- [ ] 優先度が適切に設定されている
- [ ] 実装可能な内容である
- [ ] 完了条件が明確である

### 継続的改善

#### 定期的な見直し
- DRAFT生成の精度向上
- ラベル体系の最適化
- 重複チェック基準の調整
- ワークフローの改善

#### メトリクス監視
- DRAFT → Issue 変換率
- 重複検出率
- Issue完了までの期間
- ラベル付与の一貫性

---

## ⚠️ 重要な制約事項

### 必須事項
- **GitHub CLI認証**: `gh auth status`で確認
- **リポジトリアクセス**: 対象リポジトリへの書き込み権限
- **ファイル整合性**: _llm-memories/issues/配下のファイル構造維持

### 禁止事項
- DRAFTセクションの手動削除（ツールを使用すること）
- 既存Issue番号の重複使用
- ラベル体系の勝手な変更
- リポジトリマッピングの無断変更

### 緊急時の対応
- ファイル破損時: `.backup`から復旧
- 重複Issue作成時: GitHub上で手動クローズ
- 同期エラー時: 手動でのファイル修正

---

**⚡ このルールは要件定義からIssue生成までの品質と効率性を保証するための重要なガイドラインです。**