import { join } from "@std/path";

import { ISSUE_FORMAT_HEADER, getRepoMapping, REGEX_PATTERNS, getSections } from "../types/constants.ts";
import { IssueStateSchema, ProjectsCategorySchema, ProjectsPrioritySchema, ProjectsSectionSchema } from "../types/issue.ts";

import { readTextFileSafe, resolveProjectPath } from "./file-operations.ts";
import { loadProjectConfig, getProjectConfigValue } from "./project-config-loader.ts";

/**
 * バリデーション結果の型定義
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  summary: ValidationSummary;
}

export interface ValidationError {
  type: 'FORMAT_MISMATCH' | 'INVALID_VALUE' | 'MISSING_FIELD' | 'SYNTAX_ERROR';
  file: string;
  line: number;
  message: string;
  suggestion?: string;
}

export interface ValidationWarning {
  type: 'INCONSISTENT_STYLE' | 'PERFORMANCE_CONCERN';
  file: string;
  line?: number;
  message: string;
  suggestion?: string;
}

export interface ValidationSummary {
  totalFiles: number;
  validFiles: number;
  invalidFiles: number;
  totalIssues: number;
  formatMismatches: number;
  typeViolations: number;
}


/**
 * Issue管理ファイルのデータ整合性を検証
 */
export async function validateIssueDataIntegrity(): Promise<ValidationResult> {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    summary: {
      totalFiles: 0,
      validFiles: 0,
      invalidFiles: 0,
      totalIssues: 0,
      formatMismatches: 0,
      typeViolations: 0
    }
  };

  // プロジェクト設定を読み込み
  await loadProjectConfig();
  const repoMapping = await getRepoMapping();

  // 各リポジトリのIssueファイルを検証
  for (const [repoFullName, slug] of Object.entries(repoMapping)) {
    const issuesDir = getProjectConfigValue<string>('directories.issues', '_llm-memories/issues');
    const filePath = resolveProjectPath(join(issuesDir, `${slug}.md`));
    result.summary.totalFiles++;

    try {
      const fileResult = await validateIssueFile(filePath, repoFullName);
      
      // 結果をマージ
      result.errors.push(...fileResult.errors);
      result.warnings.push(...fileResult.warnings);
      result.summary.totalIssues += fileResult.summary.totalIssues;
      result.summary.formatMismatches += fileResult.summary.formatMismatches;
      result.summary.typeViolations += fileResult.summary.typeViolations;

      if (fileResult.isValid) {
        result.summary.validFiles++;
      } else {
        result.summary.invalidFiles++;
        result.isValid = false;
      }
    } catch (error) {
      result.errors.push({
        type: 'SYNTAX_ERROR',
        file: filePath,
        line: 0,
        message: `ファイル読み込みエラー: ${error.message}`,
        suggestion: 'ファイルが存在し、読み取り可能か確認してください'
      });
      result.summary.invalidFiles++;
      result.isValid = false;
    }
  }

  return result;
}

/**
 * 単一のIssueファイルを検証
 */
async function validateIssueFile(filePath: string, repoFullName: string): Promise<ValidationResult> {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    summary: {
      totalFiles: 1,
      validFiles: 0,
      invalidFiles: 0,
      totalIssues: 0,
      formatMismatches: 0,
      typeViolations: 0
    }
  };

  const content = await readTextFileSafe(filePath);
  if (!content) {
    result.errors.push({
      type: 'SYNTAX_ERROR',
      file: filePath,
      line: 0,
      message: 'ファイルが空またはアクセスできません'
    });
    result.isValid = false;
    return result;
  }

  const lines = content.split('\\n');
  let lineNumber = 0;
  let foundFormatHeader = false;
  let currentSection: 'HEADER' | 'DRAFT' | 'OPEN' | 'CLOSED' | null = 'HEADER';

  for (const line of lines) {
    lineNumber++;

    // フォーマットヘッダーの検証
    if (line.includes('形式:')) {
      foundFormatHeader = true;
      if (!line.includes(ISSUE_FORMAT_HEADER)) {
        result.errors.push({
          type: 'FORMAT_MISMATCH',
          file: filePath,
          line: lineNumber,
          message: `形式ヘッダーが最新仕様と一致しません: ${line.trim()}`,
          suggestion: `期待値: ${ISSUE_FORMAT_HEADER}`
        });
        result.summary.formatMismatches++;
        result.isValid = false;
      }
      continue;
    }

    // セクション判定
    if (line.includes('## DRAFT Issues')) {
      currentSection = 'DRAFT';
      continue;
    } else if (line.includes('## OPEN Issues')) {
      currentSection = 'OPEN';
      continue;
    } else if (line.includes('## CLOSED Issues')) {
      currentSection = 'CLOSED';
      continue;
    }

    // Issue行の検証
    if (line.startsWith('- #')) {
      result.summary.totalIssues++;
      const issueResult = validateIssueLine(line, lineNumber, currentSection, filePath);
      
      result.errors.push(...issueResult.errors);
      result.warnings.push(...issueResult.warnings);
      result.summary.typeViolations += issueResult.summary.typeViolations;

      if (!issueResult.isValid) {
        result.isValid = false;
      }
    }
  }

  // フォーマットヘッダーの存在チェック
  if (!foundFormatHeader) {
    result.errors.push({
      type: 'MISSING_FIELD',
      file: filePath,
      line: 0,
      message: '形式ヘッダーが見つかりません',
      suggestion: `ファイルに「${ISSUE_FORMAT_HEADER}」を追加してください`
    });
    result.isValid = false;
  }

  return result;
}

/**
 * Issue行の検証
 */
function validateIssueLine(
  line: string, 
  lineNumber: number, 
  section: string | null, 
  filePath: string
): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    summary: {
      totalFiles: 0,
      validFiles: 0,
      invalidFiles: 0,
      totalIssues: 1,
      formatMismatches: 0,
      typeViolations: 0
    }
  };

  // Issue形式の正規表現（7フィールド）
  const formatMatch = line.match(REGEX_PATTERNS.ISSUE_FORMAT);
  
  if (!formatMatch) {
    result.errors.push({
        type: 'FORMAT_MISMATCH',
        file: filePath,
        line: lineNumber,
        message: `Issue行のフォーマットが無効です: ${line.trim()}`,
        suggestion: '正しいフォーマット: - #番号 | タイトル | label | category | priority | section | 状態'
      });
      result.isValid = false;
      return result;
    }

  // フィールドの検証
  const [, number, title, label, category, priority, section_field, state] = formatMatch;

  // 状態の検証
  try {
    IssueStateSchema.parse(state);
  } catch {
    result.errors.push({
      type: 'INVALID_VALUE',
      file: filePath,
      line: lineNumber,
      message: `無効な状態値: ${state}`,
      suggestion: '有効な値: DRAFT, OPEN, CLOSED'
    });
    result.summary.typeViolations++;
    result.isValid = false;
  }

  // カテゴリーの検証（空でない場合）
  if (category && category.trim()) {
    try {
      ProjectsCategorySchema.parse(category.trim());
    } catch {
      result.errors.push({
        type: 'INVALID_VALUE',
        file: filePath,
        line: lineNumber,
        message: `無効なカテゴリー: ${category}`,
        suggestion: '有効な値: structure, frontend, backend, infrastructure'
      });
      result.summary.typeViolations++;
      result.isValid = false;
    }
  }

  // 優先度の検証（空でない場合）
  if (priority && priority.trim()) {
    try {
      ProjectsPrioritySchema.parse(priority.trim());
    } catch {
      result.errors.push({
        type: 'INVALID_VALUE',
        file: filePath,
        line: lineNumber,
        message: `無効な優先度: ${priority}`,
        suggestion: '有効な値: Critical, High, Medium, Low'
      });
      result.summary.typeViolations++;
      result.isValid = false;
    }
  }

  // セクションの検証（空でない場合）
  if (section_field && section_field.trim()) {
    try {
      ProjectsSectionSchema.parse(section_field.trim());
    } catch {
      result.errors.push({
        type: 'INVALID_VALUE',
        file: filePath,
        line: lineNumber,
        message: `無効なセクション: ${section_field}`,
        suggestion: `有効な値: ${(await getSections()).join(', ')}`
      });
      result.summary.typeViolations++;
      result.isValid = false;
    }
  }

  // タイトルの存在チェック
  if (!title || !title.trim()) {
    result.errors.push({
      type: 'MISSING_FIELD',
      file: filePath,
      line: lineNumber,
      message: 'タイトルが空です',
      suggestion: '意味のあるタイトルを設定してください'
    });
    result.isValid = false;
  }

  return result;
}

/**
 * バリデーション結果をコンソールに出力
 */
export function formatValidationReport(result: ValidationResult): string {
  const lines: string[] = [];
  
  lines.push('=== Issue データ整合性検証レポート ===');
  lines.push('');
  
  // サマリー
  lines.push('📊 検証サマリー:');
  lines.push(`  - 総ファイル数: ${result.summary.totalFiles}`);
  lines.push(`  - 有効ファイル数: ${result.summary.validFiles}`);
  lines.push(`  - 無効ファイル数: ${result.summary.invalidFiles}`);
  lines.push(`  - 総Issue数: ${result.summary.totalIssues}`);
  lines.push(`  - フォーマット不整合: ${result.summary.formatMismatches}`);
  lines.push(`  - 型違反: ${result.summary.typeViolations}`);
  lines.push('');

  // 全体ステータス
  if (result.isValid) {
    lines.push('✅ 全体ステータス: 合格');
  } else {
    lines.push('❌ 全体ステータス: 不合格');
  }
  lines.push('');

  // エラー詳細
  if (result.errors.length > 0) {
    lines.push('🔴 エラー詳細:');
    for (const error of result.errors) {
      lines.push(`  ${error.file}:${error.line} - ${error.type}: ${error.message}`);
      if (error.suggestion) {
        lines.push(`    💡 提案: ${error.suggestion}`);
      }
    }
    lines.push('');
  }

  // 警告詳細
  if (result.warnings.length > 0) {
    lines.push('⚠️ 警告詳細:');
    for (const warning of result.warnings) {
      const lineInfo = warning.line ? `:${warning.line}` : '';
      lines.push(`  ${warning.file}${lineInfo} - ${warning.type}: ${warning.message}`);
      if (warning.suggestion) {
        lines.push(`    💡 提案: ${warning.suggestion}`);
      }
    }
    lines.push('');
  }

  lines.push('=== レポート終了 ===');
  
  return lines.join('\n');
}