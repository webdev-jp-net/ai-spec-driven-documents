/**
 * Issue管理システム共通定数
 * _llm-rules/issue_format_spec.md の仕様に準拠
 * 
 * このファイルはプロジェクト全体のIssue関連定数の唯一の情報源です。
 * 全てのツールはこのファイルを参照してください。
 */

import { loadProjectConfig, generateRepoMapping } from "../utils/project-config-loader.ts";

// Issue形式仕様（_llm-rules/issue_format_spec.md参照）
export const ISSUE_FORMAT_HEADER = '形式: #番号 | タイトル | label | category | priority | section | 状態';

// リポジトリマッピング（動的生成）
let _repoMapping: Record<string, string> | null = null;
export async function getRepoMapping(): Promise<Record<string, string>> {
  if (!_repoMapping) {
    await loadProjectConfig();
    _repoMapping = generateRepoMapping();
  }
  return _repoMapping;
}


// カテゴリー定義
export const CATEGORIES = ['structure', 'frontend', 'backend', 'infrastructure'] as const;
export type Category = typeof CATEGORIES[number];

// 優先度定義
export const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'] as const;
export type Priority = typeof PRIORITIES[number];

// 状態定義
export const STATES = ['DRAFT', 'OPEN', 'CLOSED'] as const;
export type State = typeof STATES[number];

// セクション型（動的）
export type Section = string;

// Issue形式のバージョン情報
export const ISSUE_FORMAT_VERSION = '1.0.0';
export const LAST_UPDATED = '2025-01-10';

// デフォルト値
export const DEFAULT_VALUES = {
  DUPLICATE_THRESHOLD: 60,
  SYNC_LIMIT: 100,
  INCLUDE_CLOSED: true,
} as const;

// ファイルパス定数
export const PATHS = {
  ISSUE_MEMORIES_DIR: '_llm-memories/issues',
  RULES_DIR: '_llm-rules',
  DOCS_DIR: '_llm-docs',
  TOOLS_DIR: 'tools',
} as const;

// 正規表現パターン
export const REGEX_PATTERNS = {
  // 新フォーマット（7フィールド）
  ISSUE_FORMAT: /^- #(\d+|-) \| ([^|]+) \| ([^|]*) \| ([^|]*) \| ([^|]*) \| ([^|]*) \| (DRAFT|OPEN|CLOSED)/,
  // フォーマットヘッダー
  FORMAT_HEADER: /形式:\s*#番号\s*\|\s*タイトル/,
} as const;

// エラーメッセージ
export const ERROR_MESSAGES = {
  INVALID_REPO: 'サポートされていないリポジトリです',
  INVALID_FORMAT: 'Issue形式が無効です',
  INVALID_CATEGORY: `無効なカテゴリーです。有効な値: ${CATEGORIES.join(', ')}`,
  INVALID_PRIORITY: `無効な優先度です。有効な値: ${PRIORITIES.join(', ')}`,
  INVALID_SECTION: '無効なセクションです',
  INVALID_STATE: `無効な状態です。有効な値: ${STATES.join(', ')}`,
  MISSING_TITLE: 'タイトルが必須です',
  FILE_NOT_FOUND: 'ファイルが見つかりません',
  DUPLICATE_DETECTED: '重複の可能性があるIssueが検出されました',
} as const;

// 成功メッセージ
export const SUCCESS_MESSAGES = {
  SYNC_COMPLETED: '同期が完了しました',
  VALIDATION_PASSED: 'バリデーションに合格しました',
  DRAFT_SAVED: 'DRAFTが保存されました',
  ISSUE_CREATED: 'Issueが作成されました',
} as const;

/**
 * リポジトリ名からスラグを取得
 */
export async function getRepoSlug(repoFullName: string): Promise<string> {
  const repoMapping = await getRepoMapping();
  
  // repoFullNameが既にスラグの場合はそのまま返す
  if (Object.values(repoMapping).includes(repoFullName)) {
    return repoFullName;
  }
  
  // フルリポジトリ名からスラグを取得
  const repoName = repoFullName.split('/')[1];
  if (repoName && repoMapping[repoName]) {
    return repoMapping[repoName];
  }
  
  // 直接マッピングを確認
  return repoMapping[repoFullName] || repoFullName;
}

/**
 * カテゴリーの妥当性チェック
 */
export function isValidCategory(category: string): category is Category {
  return CATEGORIES.includes(category as Category);
}

/**
 * 優先度の妥当性チェック
 */
export function isValidPriority(priority: string): priority is Priority {
  return PRIORITIES.includes(priority as Priority);
}

/**
 * セクションの妥当性チェック
 * セクションは任意の文字列を受け入れる
 */
export async function isValidSection(section: string): Promise<boolean> {
  // 空文字列でなければ有効とする
  return section.length > 0;
}

/**
 * 状態の妥当性チェック
 */
export function isValidState(state: string): state is State {
  return STATES.includes(state as State);
}

/**
 * Issue行が新フォーマットかチェック
 */
export function isValidIssueFormat(line: string): boolean {
  return REGEX_PATTERNS.ISSUE_FORMAT.test(line);
}


/**
 * Issue行をパースして構造化データに変換
 */
export interface ParsedIssue {
  number: number | null;
  title: string;
  label: string;
  category: string;
  priority: string;
  section: string;
  state: string;
}

export function parseIssueLine(line: string): ParsedIssue | null {
  const match = line.match(REGEX_PATTERNS.ISSUE_FORMAT);
  if (!match) return null;

  const [, numberStr, title, label, category, priority, section, state] = match;
  
  return {
    number: numberStr === '-' ? null : parseInt(numberStr),
    title: title.trim(),
    label: label.trim(),
    category: category.trim(),
    priority: priority.trim(),
    section: section.trim(),
    state: state.trim()
  };
}

/**
 * 構造化データからIssue行を生成
 */
export function formatIssueLine(issue: ParsedIssue): string {
  const number = issue.number === null ? '-' : issue.number.toString();
  return `- #${number} | ${issue.title} | ${issue.label} | ${issue.category} | ${issue.priority} | ${issue.section} | ${issue.state}`;
}