# Issue管理設定

## 概要
プロジェクト固有のIssue管理設定を定義します。
汎用的な技術仕様については `_llm-rules/issue/format.md` を参照してください。

**Single Source of Truth**: このドキュメントがプロジェクト固有のIssue管理設定の基準となります。

## Issue形式定義

### 基本フィールド
実装では以下の6フィールド形式を使用：

```
形式: #番号 | タイトル | label | category | priority | 状態
```

### TypeScript型定義

```typescript
export interface IssueFormat {
  number: number | null;
  title: string;
  label: string;
  category: 'structure' | 'frontend' | 'backend' | 'infrastructure';
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  state: 'DRAFT' | 'OPEN' | 'CLOSED';
}
```

### 有効な値

#### Category（カテゴリー）
```json
["structure", "frontend", "backend", "infrastructure"]
```

#### Priority（優先度）
```json
["Critical", "High", "Medium", "Low"]
```

#### State（状態）
```json
["DRAFT", "OPEN", "CLOSED"]
```

## 関連ドキュメント

- **汎用技術仕様**: [Issue形式仕様](../_llm-rules/issue/format.md)
- **GitHub Projects設定**: [GitHub Projects設定](./github-projects-config.md) 
- **MCPサーバー**: [MCPサーバー技術仕様](./mcp/tech_structure.md)

## MCPサーバー設定

### 定数定義
```typescript
// カテゴリー定義
export const CATEGORIES = ['structure', 'frontend', 'backend', 'infrastructure'] as const;
export type Category = typeof CATEGORIES[number];

// 優先度定義
export const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'] as const;
export type Priority = typeof PRIORITIES[number];

// 状態定義
export const STATES = ['DRAFT', 'OPEN', 'CLOSED'] as const;
export type State = typeof STATES[number];
```

### バリデーション関数
```typescript
export function isValidCategory(category: string): category is Category {
  return CATEGORIES.includes(category as Category);
}

export function isValidPriority(priority: string): priority is Priority {
  return PRIORITIES.includes(priority as Priority);
}

export function isValidState(state: string): state is State {
  return STATES.includes(state as State);
}
```

---

**⚠️ 重要**: このドキュメントはプロジェクト固有の設定のみを管理します。汎用的な技術仕様は `_llm-rules/issue/format.md` を参照してください。