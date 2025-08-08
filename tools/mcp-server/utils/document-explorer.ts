import { readTextFileSafe } from "./file-operations.ts";
import { resolveProjectPathAsync } from "./file-operations.ts";
import { getProjectConfigValue } from "./project-config-loader.ts";

export interface DocumentMetadata {
  description?: string;
  globs?: string | string[];
  alwaysApply?: boolean;
  [key: string]: any;
}

export interface DocumentInfo {
  path: string;
  title: string;
  metadata: DocumentMetadata;
  content: string;
  links: string[];
}

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

export interface ProjectContext {
  entryPoint: DocumentInfo;
  techSpecs: DocumentInfo[];
  implementationPrinciples: DocumentInfo | null;
  coreRules: DocumentInfo | null;
  terminology: DocumentInfo | null;
  relatedDocs: DocumentInfo[];
  techStack: TechStackInfo;
}

/**
 * YAMLフロントマターを解析
 */
function parseYamlFrontMatter(content: string): { metadata: DocumentMetadata; body: string } {
  const lines = content.split('\n');
  
  if (lines[0]?.trim() === '---') {
    const endIndex = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
    
    if (endIndex !== -1) {
      const metadataLines = lines.slice(1, endIndex);
      const body = lines.slice(endIndex + 1).join('\n');
      
      const metadata: DocumentMetadata = {};
      for (const line of metadataLines) {
        const colonIndex = line.indexOf(':');
        if (colonIndex !== -1) {
          const key = line.slice(0, colonIndex).trim();
          const value = line.slice(colonIndex + 1).trim();
          
          if (value.startsWith('[') && value.endsWith(']')) {
            metadata[key] = value.slice(1, -1).split(',').map(v => v.trim());
          } else if (value === 'true') {
            metadata[key] = true;
          } else if (value === 'false') {
            metadata[key] = false;
          } else {
            metadata[key] = value;
          }
        }
      }
      
      return { metadata, body };
    }
  }
  
  return { metadata: {}, body: content };
}

/**
 * Markdownリンクを抽出
 */
function extractMarkdownLinks(content: string): string[] {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const links: string[] = [];
  let match;
  
  while ((match = linkRegex.exec(content)) !== null) {
    const link = match[2];
    // 相対パスのみを対象とする（httpやhttpsで始まるものは除外）
    if (!link.startsWith('http://') && !link.startsWith('https://')) {
      links.push(link);
    }
  }
  
  return links;
}

/**
 * ドキュメントを読み込み、DocumentInfo形式で返す
 */
async function loadDocument(relativePath: string): Promise<DocumentInfo | null> {
  try {
    const fullPath = await resolveProjectPathAsync(relativePath);
    const content = await readTextFileSafe(fullPath);
    
    if (!content) {
      return null;
    }
    
    const { metadata, body } = parseYamlFrontMatter(content);
    const links = extractMarkdownLinks(body);
    
    // タイトルを抽出（最初のh1見出し、またはファイル名から）
    const titleMatch = body.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1] : relativePath.split('/').pop()?.replace(/\.md$/, '') || 'Unknown';
    
    return {
      path: relativePath,
      title,
      metadata,
      content: body,
      links
    };
  } catch (error) {
    console.error(`Failed to load document: ${relativePath}`, error);
    return null;
  }
}

/**
 * 相対パスを解決
 */
function resolveRelativePath(basePath: string, relativePath: string): string {
  // basePathのディレクトリ部分を取得
  const baseDir = basePath.includes('/') ? basePath.substring(0, basePath.lastIndexOf('/')) : '';
  
  // relativePathが./から始まる場合は除去
  const cleanRelativePath = relativePath.startsWith('./') ? relativePath.slice(2) : relativePath;
  
  // パスを結合
  return baseDir ? `${baseDir}/${cleanRelativePath}` : cleanRelativePath;
}

/**
 * ドキュメントから技術スタック情報を抽出
 */
function extractTechStackFromDocument(content: string): TechStackInfo {
  const techStack: TechStackInfo = {};
  
  // フレームワーク検出（汎用的なパターンマッチング）
  const frameworkPatterns = [
    { pattern: /React\s+(\d+\.\d+\.\d+)/i, name: 'React' },
    { pattern: /Vue(?:\.js)?\s+(\d+\.\d+\.\d+)/i, name: 'Vue.js' },
    { pattern: /Angular\s+(\d+\.\d+\.\d+)/i, name: 'Angular' },
    { pattern: /react/i, name: 'React' },
    { pattern: /vue/i, name: 'Vue.js' },
    { pattern: /angular/i, name: 'Angular' },
    { pattern: /next\.js/i, name: 'Next.js' },
    { pattern: /nuxt/i, name: 'Nuxt.js' },
    { pattern: /svelte/i, name: 'Svelte' }
  ];
  
  for (const { pattern, name } of frameworkPatterns) {
    const match = content.match(pattern);
    if (match) {
      techStack.framework = match[1] ? `${name} ${match[1]}` : name;
      break;
    }
  }
  
  // 言語検出（汎用的なパターンマッチング）
  const languagePatterns = [
    { pattern: /TypeScript\s+(\d+\.\d+(?:\.\d+)?(?:\.x)?)/i, name: 'TypeScript' },
    { pattern: /JavaScript\s+(ES\d+|ES20\d+)/i, name: 'JavaScript' },
    { pattern: /typescript/i, name: 'TypeScript' },
    { pattern: /javascript/i, name: 'JavaScript' },
    { pattern: /python/i, name: 'Python' },
    { pattern: /java/i, name: 'Java' },
    { pattern: /c\#|csharp/i, name: 'C#' },
    { pattern: /go(?:\s+\d+\.\d+)?/i, name: 'Go' }
  ];
  
  for (const { pattern, name } of languagePatterns) {
    const match = content.match(pattern);
    if (match) {
      techStack.language = match[1] ? `${name} ${match[1]}` : name;
      break;
    }
  }
  
  // 汎用的な技術検出システム
  const techCategories = [
    {
      category: 'buildTool',
      patterns: [
        { pattern: /vite/i, name: 'Vite' },
        { pattern: /webpack/i, name: 'Webpack' },
        { pattern: /rollup/i, name: 'Rollup' },
        { pattern: /parcel/i, name: 'Parcel' },
        { pattern: /esbuild/i, name: 'esbuild' },
        { pattern: /turbopack/i, name: 'Turbopack' }
      ]
    },
    {
      category: 'uiLibrary',
      patterns: [
        { pattern: /chakra ui|chakraui/i, name: 'Chakra UI' },
        { pattern: /material-ui|mui/i, name: 'Material-UI' },
        { pattern: /ant design/i, name: 'Ant Design' },
        { pattern: /bootstrap/i, name: 'Bootstrap' },
        { pattern: /semantic ui/i, name: 'Semantic UI' },
        { pattern: /bulma/i, name: 'Bulma' }
      ]
    },
    {
      category: 'stateManagement',
      patterns: [
        { pattern: /rtk query/i, name: 'RTK Query' },
        { pattern: /redux toolkit|rtk/i, name: 'Redux Toolkit' },
        { pattern: /zustand/i, name: 'Zustand' },
        { pattern: /recoil/i, name: 'Recoil' },
        { pattern: /mobx/i, name: 'MobX' },
        { pattern: /context api/i, name: 'Context API' }
      ]
    },
    {
      category: 'testing',
      patterns: [
        { pattern: /vitest/i, name: 'Vitest' },
        { pattern: /jest/i, name: 'Jest' },
        { pattern: /cypress/i, name: 'Cypress' },
        { pattern: /playwright/i, name: 'Playwright' },
        { pattern: /testing library/i, name: 'Testing Library' }
      ]
    },
    {
      category: 'styling',
      patterns: [
        { pattern: /css modules/i, name: 'CSS Modules' },
        { pattern: /styled-components/i, name: 'Styled Components' },
        { pattern: /tailwind/i, name: 'Tailwind CSS' },
        { pattern: /emotion/i, name: 'Emotion' },
        { pattern: /sass|scss/i, name: 'Sass' },
        { pattern: /less/i, name: 'Less' }
      ]
    }
  ];
  
  // 各カテゴリの技術を検出
  for (const { category, patterns } of techCategories) {
    for (const { pattern, name } of patterns) {
      if (pattern.test(content)) {
        (techStack as any)[category] = name;
        break;
      }
    }
  }
  
  return techStack;
}

/**
 * エントリーポイントから関連ドキュメントを探索
 */
export async function exploreProjectDocuments(_repoFullName?: string): Promise<ProjectContext> {
  // 設定からエントリーポイントを取得、デフォルト値で後方互換性確保
  let ENTRY_POINT: string;
  try {
    ENTRY_POINT = getProjectConfigValue<string>('documents.entryPoint', '_llm-docs/requirements_definition.md');
  } catch (error) {
    console.warn('設定読み込みエラー、デフォルトのエントリーポイントを使用:', error);
    ENTRY_POINT = '_llm-docs/requirements_definition.md';
  }
  
  // エントリーポイントを読み込み
  const entryPoint = await loadDocument(ENTRY_POINT);
  if (!entryPoint) {
    throw new Error(`Entry point not found: ${ENTRY_POINT}`);
  }
  
  // 基本的なルールファイルを設定から読み込み
  let implementationPrinciples = null;
  let coreRules = null;
  let terminology = null;
  
  try {
    const implPrinciplesPath = getProjectConfigValue<string>('documents.implementationPrinciples', '_llm-rules/implementation_principles.md');
    const coreRulesPath = getProjectConfigValue<string>('documents.coreRules', '_llm-rules/core_rules.md');
    const terminologyPath = getProjectConfigValue<string>('documents.dictionary', '_llm-docs/operation/dictionary.md');
    
    implementationPrinciples = await loadDocument(implPrinciplesPath);
    coreRules = await loadDocument(coreRulesPath);
    terminology = await loadDocument(terminologyPath);
  } catch (error) {
    console.warn('設定読み込みエラー、デフォルトパスを使用:', error);
    implementationPrinciples = await loadDocument('_llm-rules/implementation_principles.md');
    coreRules = await loadDocument('_llm-rules/core_rules.md');
    terminology = await loadDocument('_llm-docs/operation/dictionary.md');
  }
  
  // エントリーポイントからリンクを探索
  const relatedDocs: DocumentInfo[] = [];
  const techSpecs: DocumentInfo[] = [];
  
  for (const link of entryPoint.links) {
    const resolvedPath = resolveRelativePath(ENTRY_POINT, link);
    const doc = await loadDocument(resolvedPath);
    
    if (doc) {
      relatedDocs.push(doc);
      
      // 技術仕様を特定（メタデータとタイトルで判定）
      if (doc.metadata.description?.toLowerCase().includes('technical') ||
          doc.metadata.description?.toLowerCase().includes('tech') ||
          doc.title.toLowerCase().includes('技術')) {
        techSpecs.push(doc);
      }
      
      // さらにリンクを辿って関連ドキュメントを収集
      for (const subLink of doc.links) {
        const subResolvedPath = resolveRelativePath(resolvedPath, subLink);
        const subDoc = await loadDocument(subResolvedPath);
        
        if (subDoc && !relatedDocs.some(d => d.path === subDoc.path)) {
          relatedDocs.push(subDoc);
          
          // 技術仕様の判定
          if (subDoc.metadata.description?.toLowerCase().includes('technical') ||
              subDoc.metadata.description?.toLowerCase().includes('tech') ||
              subDoc.title.toLowerCase().includes('技術')) {
            techSpecs.push(subDoc);
          }
        }
      }
    }
  }
  
  // 技術スタック情報を収集
  const techStack: TechStackInfo = {};
  
  // エントリーポイントから技術スタック情報を抽出
  const entryTechStack = extractTechStackFromDocument(entryPoint.content);
  Object.assign(techStack, entryTechStack);
  
  // 技術仕様書から技術スタック情報を抽出
  for (const techSpec of techSpecs) {
    const specTechStack = extractTechStackFromDocument(techSpec.content);
    // より具体的な情報で上書き（バージョン情報がある場合など）
    Object.assign(techStack, specTechStack);
  }
  
  // 関連ドキュメントからも技術スタック情報を抽出
  for (const doc of relatedDocs) {
    const docTechStack = extractTechStackFromDocument(doc.content);
    // 既存の情報がない場合のみ追加
    for (const [key, value] of Object.entries(docTechStack)) {
      if (value && !techStack[key]) {
        techStack[key] = value;
      }
    }
  }
  
  return {
    entryPoint,
    techSpecs,
    implementationPrinciples,
    coreRules,
    terminology,
    relatedDocs,
    techStack
  };
}

/**
 * リポジトリタイプに対応する技術仕様を取得
 */
export function findRepoTechSpec(projectContext: ProjectContext, repoFullName: string): DocumentInfo | null {
  const repoName = repoFullName.split('/').pop() || '';
  
  try {
    // プロジェクト設定からリポジトリマッピングを取得
    const repositories = getProjectConfigValue('repositories', {});
    
    // 現在のリポジトリに対応するタイプを特定
    let currentRepoType: string | null = null;
    for (const [repoType, configRepoName] of Object.entries(repositories)) {
      if (typeof configRepoName === 'string' && repoName.includes(configRepoName.split('-').pop() || '')) {
        currentRepoType = repoType;
        break;
      }
    }
    
    // 対応する技術仕様を探索
    if (currentRepoType) {
      for (const techSpec of projectContext.techSpecs) {
        // パスに現在のリポジトリタイプが含まれているかチェック
        if (techSpec.path.includes(`/${currentRepoType}/`) || 
            techSpec.path.includes(`\\${currentRepoType}\\`) ||
            techSpec.path.endsWith(`/${currentRepoType}`) ||
            techSpec.path.endsWith(`\\${currentRepoType}`)) {
          return techSpec;
        }
      }
    }
    
    // 共通仕様または全体適用の仕様を探す
    return projectContext.techSpecs.find(spec => 
      spec.metadata.alwaysApply === true ||
      spec.title.toLowerCase().includes('共通')
    ) || null;
    
  } catch (error) {
    console.warn('設定読み込みエラー、フォールバックロジックを使用:', error);
    
    // フォールバック: メタデータベースの判定
    return projectContext.techSpecs.find(spec => 
      spec.metadata.alwaysApply === true ||
      spec.title.toLowerCase().includes('共通')
    ) || projectContext.techSpecs[0] || null;
  }
}