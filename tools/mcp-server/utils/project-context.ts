import { exploreProjectDocuments, findRepoTechSpec, type ProjectContext, type DocumentInfo } from "./document-explorer.ts";
import type { DraftIssue } from "../types/issue.ts";

export interface TechStackInfo {
  framework?: string;
  language?: string;
  buildTool?: string;
  uiLibrary?: string;
  stateManagement?: string;
  testing?: string;
  styling?: string;
  [key: string]: string | undefined;
}

export interface ImplementationGuidelines {
  principles: string[];
  qualityRequirements: string[];
  securityRequirements: string[];
  codeConventions: string[];
}

export interface TaskContext {
  projectContext: ProjectContext;
  repoTechSpec: DocumentInfo | null;
  techStack: TechStackInfo;
  guidelines: ImplementationGuidelines;
  relatedDocuments: DocumentInfo[];
  terminologyCorrections: Array<{ original: string; suggested: string; category: string }>;
}

/**
 * 技術スタック情報を抽出
 */
function extractTechStack(techSpecDoc: DocumentInfo | null): TechStackInfo {
  if (!techSpecDoc) {
    return {};
  }
  
  const content = techSpecDoc.content.toLowerCase();
  const techStack: TechStackInfo = {};
  
  // 汎用的な技術検出（文字列パターンから動的抽出）
  const techKeywords = {
    framework: ['framework', 'フレームワーク', 'library', 'ライブラリ'],
    language: ['language', '言語', 'programming'],
    buildTool: ['build', 'ビルド', 'bundler', 'バンドラー'],
    uiLibrary: ['ui', 'ユーザーインターフェース', 'コンポーネント'],
    stateManagement: ['state', '状態管理', 'store'],
    testing: ['test', 'テスト', 'testing'],
    styling: ['style', 'スタイル', 'css']
  };
  
  // セクション別に技術情報を抽出
  const lines = content.split('\n');
  let currentCategory = '';
  
  for (const line of lines) {
    const lineLower = line.toLowerCase().trim();
    
    // セクション見出しから技術カテゴリを判定
    if (line.startsWith('#') || line.startsWith('*')) {
      for (const [category, keywords] of Object.entries(techKeywords)) {
        if (keywords.some(keyword => lineLower.includes(keyword))) {
          currentCategory = category;
          break;
        }
      }
    }
    
    // 技術名のパターン（バージョン番号付き）を検出
    const techWithVersionMatch = line.match(/[-*]\s*\*?\*?([A-Za-z0-9.\s]+)\*?\*?[:：]\s*([^-\n]+)/);
    const techMatch = line.match(/[-*]\s*\*?\*?([A-Za-z0-9.\s]+)\*?\*?/);
    
    if (techWithVersionMatch && currentCategory) {
      const techName = techWithVersionMatch[2].trim();
      if (techName && !techStack[currentCategory]) {
        techStack[currentCategory] = techName;
      }
    } else if (techMatch && currentCategory) {
      const techName = techMatch[1].trim();
      if (techName && !techStack[currentCategory]) {
        techStack[currentCategory] = techName;
      }
    }
  }
  
  return techStack;
}

/**
 * 実装ガイドラインを抽出
 */
function extractImplementationGuidelines(
  implementationPrinciples: DocumentInfo | null, 
  coreRules: DocumentInfo | null
): ImplementationGuidelines {
  const guidelines: ImplementationGuidelines = {
    principles: [],
    qualityRequirements: [],
    securityRequirements: [],
    codeConventions: []
  };
  
  if (implementationPrinciples) {
    const content = implementationPrinciples.content;
    
    // 実装原則を抽出
    const principleMatches = content.match(/^-\s+(.+)$/gm);
    if (principleMatches) {
      guidelines.principles = principleMatches.map(m => m.replace(/^-\s+/, ''));
    }
    
    // セキュリティ要件を抽出
    const securitySection = content.match(/## セキュリティ実装([\s\S]*?)(?=##|$)/);
    if (securitySection) {
      const securityItems = securitySection[1].match(/^-\s+(.+)$/gm);
      if (securityItems) {
        guidelines.securityRequirements = securityItems.map(m => m.replace(/^-\s+/, ''));
      }
    }
    
    // 品質要件を抽出
    const qualitySection = content.match(/## 品質管理([\s\S]*?)(?=##|$)/);
    if (qualitySection) {
      const qualityItems = qualitySection[1].match(/^-\s+(.+)$/gm);
      if (qualityItems) {
        guidelines.qualityRequirements = qualityItems.map(m => m.replace(/^-\s+/, ''));
      }
    }
  }
  
  if (coreRules) {
    const content = coreRules.content;
    
    // コーディング規約を抽出
    const codingSection = content.match(/## 実装時の命名規則と構造([\s\S]*?)(?=##|$)/);
    if (codingSection) {
      const codingItems = codingSection[1].match(/^-\s+(.+)$/gm);
      if (codingItems) {
        guidelines.codeConventions = codingItems.map(m => m.replace(/^-\s+/, ''));
      }
    }
  }
  
  return guidelines;
}

/**
 * タスクに関連するドキュメントを特定
 */
function findRelatedDocuments(draft: DraftIssue, projectContext: ProjectContext): DocumentInfo[] {
  const keywords = [
    ...draft.title.toLowerCase().split(/\s+/),
    ...(draft.body?.toLowerCase().split(/\s+/) || [])
  ].filter(word => word.length > 2);
  
  const relatedDocs: DocumentInfo[] = [];
  
  for (const doc of projectContext.relatedDocs) {
    const docContent = doc.content.toLowerCase();
    const docTitle = doc.title.toLowerCase();
    
    // キーワードマッチング
    const matchCount = keywords.reduce((count, keyword) => {
      if (docContent.includes(keyword) || docTitle.includes(keyword)) {
        return count + 1;
      }
      return count;
    }, 0);
    
    // 関連度が高い場合に追加
    if (matchCount > 0) {
      relatedDocs.push(doc);
    }
  }
  
  // 関連度でソート
  return relatedDocs.sort((a, b) => {
    const aMatches = keywords.reduce((count, keyword) => {
      return count + (a.content.toLowerCase().includes(keyword) ? 1 : 0);
    }, 0);
    const bMatches = keywords.reduce((count, keyword) => {
      return count + (b.content.toLowerCase().includes(keyword) ? 1 : 0);
    }, 0);
    return bMatches - aMatches;
  }).slice(0, 5); // 上位5件まで
}

/**
 * タスクコンテキストを収集
 */
export async function collectTaskContext(draft: DraftIssue, repoFullName: string): Promise<TaskContext> {
  // プロジェクトドキュメントを探索
  const projectContext = await exploreProjectDocuments(repoFullName);
  
  // リポジトリに対応する技術仕様を特定
  const repoTechSpec = findRepoTechSpec(projectContext, repoFullName);
  
  // 技術スタック情報を抽出
  const techStack = extractTechStack(repoTechSpec);
  
  // 実装ガイドラインを抽出
  const guidelines = extractImplementationGuidelines(
    projectContext.implementationPrinciples, 
    projectContext.coreRules
  );
  
  // 関連ドキュメントを特定
  const relatedDocuments = findRelatedDocuments(draft, projectContext);
  
  return {
    projectContext,
    repoTechSpec,
    techStack,
    guidelines,
    relatedDocuments,
    terminologyCorrections: [] // 後で用語チェック結果を設定
  };
}

/**
 * 技術スタック情報を文字列として整形
 */
export function formatTechStack(techStack: TechStackInfo): string {
  const items = Object.entries(techStack)
    .filter(([_, value]) => value)
    .map(([key, value]) => {
      const label = {
        framework: 'フレームワーク',
        language: '言語',
        buildTool: 'ビルドツール',
        uiLibrary: 'UIライブラリ',
        stateManagement: '状態管理',
        testing: 'テスト',
        styling: 'スタイリング'
      }[key] || key;
      return `${label}: ${value}`;
    });
  
  return items.length > 0 ? items.join(', ') : '技術仕様なし';
}

/**
 * 実装ガイドラインを文字列として整形
 */
export function formatGuidelines(guidelines: ImplementationGuidelines): string[] {
  const sections: string[] = [];
  
  if (guidelines.principles.length > 0) {
    sections.push(`**実装原則**:\n${guidelines.principles.map(p => `- ${p}`).join('\n')}`);
  }
  
  if (guidelines.qualityRequirements.length > 0) {
    sections.push(`**品質要件**:\n${guidelines.qualityRequirements.map(q => `- ${q}`).join('\n')}`);
  }
  
  if (guidelines.securityRequirements.length > 0) {
    sections.push(`**セキュリティ要件**:\n${guidelines.securityRequirements.map(s => `- ${s}`).join('\n')}`);
  }
  
  if (guidelines.codeConventions.length > 0) {
    sections.push(`**コーディング規約**:\n${guidelines.codeConventions.map(c => `- ${c}`).join('\n')}`);
  }
  
  return sections;
}