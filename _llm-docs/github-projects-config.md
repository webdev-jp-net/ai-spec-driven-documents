# GitHub Projects設定情報

## 概要
このドキュメントは、プロジェクト固有のGitHub Projects設定を管理します。
汎用的なルール・手順については `_llm-rules/github_projects_integration.md` を参照してください。

## 初期設定手順

### 1. GitHub Projectsの準備
既存のGitHub Projectsを使用するか、Web UIで新規作成してください。

**新規作成する場合:**
1. GitHub上で対象のOrganization/Userページへ移動
2. 「Projects」タブをクリック
3. 「New project」ボタンをクリック
4. プロジェクト名を入力して作成

**プロジェクト情報の取得:**
```bash
# 利用可能なプロジェクト一覧を確認
gh project list --owner [ORGANIZATION_OR_USERNAME]

# プロジェクトIDとURLを確認
# 例: https://github.com/orgs/your-org/projects/123 の場合、PROJECT_ID は 123
```

### 2. 必須フィールドの追加（Web UI）

GitHub ProjectsのWeb画面で以下のカスタムフィールドを追加してください：

**手順:**
1. 作成したProjectsページを開く
2. 右上の「⚙️ Settings」をクリック
3. 「Fields」セクションで「+ Add field」をクリック
4. 以下のフィールドを順次追加：

**Priority フィールド**
- Field name: `Priority`
- Field type: `Single select`
- Options: `Critical`, `High`, `Medium`, `Low`

**IssueType フィールド**
- Field name: `IssueType`
- Field type: `Single select`
- Options: `Feature`, `Bug`, `Documentation`, `Enhancement`

**Category フィールド**
- Field name: `Category`
- Field type: `Single select`
- Options: `structure`, `frontend`, `backend`, `infrastructure`

### 3. プロジェクト情報の確認

**プロジェクトIDの確認方法:**
- ProjectsページのURLを確認
- 例: `https://github.com/orgs/your-org/projects/123` の場合、PROJECT_ID は `123`

### 4. 設定ファイルの更新
確認したプロジェクト情報を、下記の「プロジェクト固有設定」セクションに記入してください。

## プロジェクト固有設定

### プロジェクト所有者タイプ
以下のいずれかを選択して記入：

**パターンA: Organization所有**
```json
{
  "owner_type": "org",
  "owner": "[ORGANIZATION_NAME]",
  "project_id": "[PROJECT_ID]",
  "project_name": "[PROJECT_NAME]"
}
```

**パターンB: User所有**
```json
{
  "owner_type": "user",
  "owner": "[USERNAME]",
  "project_id": "[PROJECT_ID]",
  "project_name": "[PROJECT_NAME]"
}
```

### MCPサーバー設定

#### 環境変数
```bash
export GITHUB_TOKEN="[YOUR_GITHUB_TOKEN]"
export GITHUB_ORG="[YOUR_ORGANIZATION_OR_USERNAME]"
export GITHUB_PROJECT_ID="[YOUR_PROJECT_ID]"
```

#### config-loader.ts 設定
```typescript
export const GITHUB_PROJECTS_CONFIG = {
  organization: "[YOUR_ORGANIZATION_OR_USERNAME]",
  project_id: "[YOUR_PROJECT_ID]", 
  project_url: "[YOUR_PROJECT_URL]",
  fields: {
    priority: "Priority",
    issue_type: "IssueType", 
    category: "Category"
  }
};
```

## 関連ドキュメント

- **汎用ルール**: [GitHub Projects連携ルール](../_llm-rules/github_projects_integration.md)
- **Issue形式**: [Issue形式仕様](../_llm-rules/issue/format.md) 
- **MCPサーバー**: [MCPサーバー技術仕様](./mcp/tech_structure.md)

---

**⚠️ 重要**: このドキュメントはプロジェクト固有の設定のみを管理します。汎用的なルール・手順は `_llm-rules/github_projects_integration.md` を参照してください。