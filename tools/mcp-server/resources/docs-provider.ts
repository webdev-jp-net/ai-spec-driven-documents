import { join } from "@std/path";
import { readTextFileSafe, getFilesRecursively, resolveProjectPath } from "../utils/file-operations.ts";
import { McpResource } from "../types/mcp.ts";
import { terminologyProvider } from "./terminology-provider.ts";
import { getProjectConfigValue } from "../utils/project-config-loader.ts";

/**
 * ドキュメント（_llm-docs）リソースプロバイダー
 */
export class DocsProvider {
  private docsDir: string;

  constructor() {
    const docsPath = getProjectConfigValue<string>('directories.docs', '_llm-docs');
    this.docsDir = resolveProjectPath(docsPath);
  }

  /**
   * 利用可能なドキュメントリソースをリストアップ
   */
  async listResources(): Promise<McpResource[]> {
    const resources: McpResource[] = [];

    try {
      const markdownFiles = await getFilesRecursively(this.docsDir, '.md');

      for (const filePath of markdownFiles) {
        const relativePath = filePath.replace(this.docsDir + '/', '');
        const uri = `file://_llm-docs/${relativePath}`;
        
        // ファイル名から説明を生成
        const fileName = relativePath.split('/').pop() || '';
        const description = this.generateDescription(relativePath, fileName);

        resources.push({
          uri,
          name: fileName,
          description,
          mimeType: "text/markdown"
        });
      }

      // 特別なリソース：プロジェクト概要
      resources.push({
        uri: "file://_llm-docs/requirements_definition.md",
        name: "プロジェクト概要",
        description: "プロジェクト全体の要件定義と概要",
        mimeType: "text/markdown"
      });

    } catch (error) {
      console.error('Error listing docs resources:', error);
    }

    return resources;
  }

  /**
   * 指定されたリソースを読み込む
   */
  async readResource(uri: string): Promise<{ contents: Array<{ type: string; text: string }> }> {
    try {
      // URIからファイルパスを抽出
      const filePath = uri.replace('file://_llm-docs/', '');
      const fullPath = join(this.docsDir, filePath);

      const content = await readTextFileSafe(fullPath);
      
      if (!content) {
        throw new Error(`Document not found: ${filePath}`);
      }

      // メタデータを追加
      const fileInfo = await this.getFileInfo(fullPath);
      const header = `# ${filePath}\n\n` +
                    `**最終更新**: ${fileInfo.lastModified}\n` +
                    `**サイズ**: ${fileInfo.size}\n\n` +
                    `---\n\n`;

      return {
        contents: [
          {
            type: "text",
            text: header + content
          }
        ]
      };

    } catch (error) {
      throw new Error(`Failed to read document resource: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * ファイルパスに基づいて説明を生成
   */
  private generateDescription(relativePath: string, fileName: string): string {
    const pathSegments = relativePath.split('/');
    
    if (pathSegments.length > 1) {
      const category = pathSegments[0];
      
      // カテゴリをそのまま使用
      return `${category}/${fileName}`;
    }

    // ファイル名から推測
    if (fileName.includes('requirements')) {
      return '要件定義書';
    } else if (fileName.includes('specification')) {
      return '仕様書';
    } else if (fileName.includes('dictionary')) {
      return 'ネーミング辞書';
    } else if (fileName.includes('naming')) {
      return 'ネーミング規約';
    } else if (fileName.includes('index')) {
      return 'インデックス・概要';
    }

    return `プロジェクト文書: ${fileName}`;
  }

  /**
   * ファイル情報を取得
   */
  private async getFileInfo(filePath: string): Promise<{ lastModified: string; size: string }> {
    try {
      const stat = await Deno.stat(filePath);
      return {
        lastModified: stat.mtime?.toISOString().split('T')[0] || 'Unknown',
        size: `${Math.round(stat.size / 1024 * 10) / 10}KB`
      };
    } catch (error) {
      return {
        lastModified: 'Unknown',
        size: 'Unknown'
      };
    }
  }

  /**
   * 智能推測：質問内容から関連ドキュメントを自動推測
   */
  async suggestRelevantDocuments(query: string): Promise<McpResource[]> {
    const suggestions: McpResource[] = [];
    
    // 用語辞書から関連用語を検索
    const partialMatches = await terminologyProvider.searchPartial(query);
    
    for (const match of partialMatches) {
      // リポジトリがある場合は対応するドキュメントを提案
      if (match.repository) {
        const repoPath = `${match.repository}/index.md`;
        const uri = `file://_llm-docs/${repoPath}`;
        
        suggestions.push({
          uri,
          name: `${match.japanese}関連ドキュメント`,
          description: `${match.description} - ${match.category}`,
          mimeType: "text/markdown"
        });
      }
    }

    // 設定ベースのキーワードマッピング
    const keywordMapping: Array<{ keywords: string[]; path: string }> = [];
    
    try {
      // terminology-providerから用語情報を取得してキーワードマッピングを動的生成
      // 既存の用語辞書システムを活用し、重複を排除
      
      // 設定からリポジトリ情報を取得
      const repositories = getProjectConfigValue('repositories', {});
      
      // リポジトリタイプごとにマッピングを作成（用語辞書ベース）
      for (const [repoType, repoName] of Object.entries(repositories)) {
        if (typeof repoName === 'string') {
          // terminology-providerから関連用語を検索
          const relatedTerms = await terminologyProvider.searchPartial(repoType);
          const keywords = [repoType];
          
          // 用語辞書から関連する日本語キーワードを追加
          for (const term of relatedTerms) {
            if (term.repository === repoType || term.english === repoType) {
              keywords.push(term.japanese);
            }
          }
          
          keywordMapping.push({
            keywords,
            path: `${repoType}/index.md`
          });
        }
      }
      
      // 共通ドキュメントは設定から取得
      const dictionaryPath = getProjectConfigValue('documents.dictionary', '_llm-docs/operation/dictionary.md');
      const entryPointPath = getProjectConfigValue('documents.entryPoint', '_llm-docs/requirements_definition.md');
      
      keywordMapping.push(
        { keywords: ['用語', 'dictionary', 'ネーミング'], path: dictionaryPath.replace('_llm-docs/', '') },
        { keywords: ['要件', 'requirements', '仕様'], path: entryPointPath.replace('_llm-docs/', '') }
      );
      
    } catch (error) {
      console.warn('設定読み込みエラー、フォールバック処理を使用:', error);
      
      // フォールバック: 汎用的なマッピング
      keywordMapping.push(
        { keywords: ['用語', 'dictionary', 'ネーミング'], path: 'operation/dictionary.md' },
        { keywords: ['要件', 'requirements', '仕様'], path: 'requirements_definition.md' }
      );
    }

    for (const mapping of keywordMapping) {
      for (const keyword of mapping.keywords) {
        if (query.toLowerCase().includes(keyword.toLowerCase())) {
          const uri = `file://_llm-docs/${mapping.path}`;
          
          suggestions.push({
            uri,
            name: `${keyword}関連ドキュメント`,
            description: `「${keyword}」に関する詳細情報`,
            mimeType: "text/markdown"
          });
        }
      }
    }

    // 重複除去
    const uniqueSuggestions = suggestions.filter((suggestion, index, self) => 
      index === self.findIndex(s => s.uri === suggestion.uri)
    );

    return uniqueSuggestions;
  }

  /**
   * 高度なドキュメント検索（智能Issue生成用）
   */
  async searchDocumentsByContext(context: {
    keywords: string[];
    targetRepo: string;
    categories: string[];
  }): Promise<Array<{
    path: string;
    content: string;
    relevance: number;
    matchedKeywords: string[];
  }>> {
    const results: Array<{
      path: string;
      content: string;
      relevance: number;
      matchedKeywords: string[];
    }> = [];

    try {
      // 対象リポジトリの仕様書を最優先で取得
      const repoDocPath = `${context.targetRepo}/index.md`;
      const repoDocContent = await readTextFileSafe(join(this.docsDir, repoDocPath));
      
      if (repoDocContent) {
        const matchedKeywords = context.keywords.filter(keyword => 
          repoDocContent.toLowerCase().includes(keyword.toLowerCase())
        );
        
        results.push({
          path: repoDocPath,
          content: repoDocContent,
          relevance: 1.0, // 対象リポジトリは最高関連度
          matchedKeywords
        });
      }

      // 全ドキュメントを検索
      const allMarkdownFiles = await getFilesRecursively(this.docsDir, '.md');
      
      for (const filePath of allMarkdownFiles) {
        const relativePath = filePath.replace(this.docsDir + '/', '');
        
        // 既に追加されたリポジトリドキュメントはスキップ
        if (relativePath === repoDocPath) continue;
        
        const content = await readTextFileSafe(filePath);
        if (!content) continue;
        
        const matchedKeywords = context.keywords.filter(keyword => 
          content.toLowerCase().includes(keyword.toLowerCase())
        );
        
        // 関連度計算
        const relevance = this.calculateDocumentRelevance(
          content, 
          context.keywords, 
          context.categories,
          matchedKeywords
        );
        
        if (relevance > 0.1) { // 閾値以上の関連度のみ
          results.push({
            path: relativePath,
            content,
            relevance,
            matchedKeywords
          });
        }
      }

      // 関連度でソート
      return results.sort((a, b) => b.relevance - a.relevance);
    } catch (error) {
      console.error('Error in searchDocumentsByContext:', error);
      return [];
    }
  }

  /**
   * 複数ドキュメントの横断検索
   */
  async crossDocumentSearch(query: string): Promise<Array<{
    document: string;
    matches: Array<{
      line: number;
      content: string;
      context: string;
    }>;
  }>> {
    const searchResults: Array<{
      document: string;
      matches: Array<{
        line: number;
        content: string;
        context: string;
      }>;
    }> = [];

    try {
      const allMarkdownFiles = await getFilesRecursively(this.docsDir, '.md');
      
      for (const filePath of allMarkdownFiles) {
        const relativePath = filePath.replace(this.docsDir + '/', '');
        const content = await readTextFileSafe(filePath);
        
        if (!content) continue;
        
        const matches = this.findMatchesInDocument(content, query);
        
        if (matches.length > 0) {
          searchResults.push({
            document: relativePath,
            matches
          });
        }
      }

      return searchResults;
    } catch (error) {
      console.error('Error in crossDocumentSearch:', error);
      return [];
    }
  }

  /**
   * ドキュメント関連度計算
   */
  private calculateDocumentRelevance(
    content: string,
    keywords: string[],
    categories: string[],
    matchedKeywords: string[]
  ): number {
    let score = 0;
    const contentLower = content.toLowerCase();
    
    // キーワードマッチスコア
    const keywordScore = matchedKeywords.length / keywords.length;
    score += keywordScore * 0.6;
    
    // カテゴリマッチスコア
    const categoryMatches = categories.filter(cat => 
      contentLower.includes(cat.toLowerCase())
    ).length;
    const categoryScore = categoryMatches / Math.max(categories.length, 1);
    score += categoryScore * 0.3;
    
    // 頻度スコア
    const frequencyScore = matchedKeywords.reduce((acc, keyword) => {
      const regex = new RegExp(keyword, 'gi');
      const matches = content.match(regex);
      return acc + (matches ? matches.length * 0.1 : 0);
    }, 0);
    score += Math.min(frequencyScore, 0.1);
    
    return Math.min(score, 1.0);
  }

  /**
   * ドキュメント内のマッチ検索
   */
  private findMatchesInDocument(content: string, query: string): Array<{
    line: number;
    content: string;
    context: string;
  }> {
    const matches: Array<{
      line: number;
      content: string;
      context: string;
    }> = [];
    
    const lines = content.split('\n');
    const queryLower = query.toLowerCase();
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineLower = line.toLowerCase();
      
      if (lineLower.includes(queryLower)) {
        // 前後の文脈を取得
        const contextStart = Math.max(0, i - 2);
        const contextEnd = Math.min(lines.length, i + 3);
        const context = lines.slice(contextStart, contextEnd).join('\n');
        
        matches.push({
          line: i + 1,
          content: line,
          context
        });
      }
    }
    
    return matches;
  }

  /**
   * 用語統一チェック：テキスト内の用語を辞書と照合
   */
  async checkTerminologyConsistency(text: string): Promise<{
    suggestions: Array<{
      original: string;
      suggested: string;
      category: string;
      position: number;
    }>;
    summary: {
      totalChecked: number;
      suggestionsCount: number;
      categories: string[];
    };
  }> {
    const suggestions = [];
    const categories = new Set<string>();
    
    // 用語辞書から全ての用語を取得
    const terminologyResource = await terminologyProvider.readResource("terminology://dictionary/japanese-to-english");
    const terminologyData = JSON.parse(terminologyResource.contents[0].text);
    const mapping = terminologyData.mapping;
    
    // テキスト内の用語をチェック
    for (const [japanese, english] of Object.entries(mapping)) {
      const regex = new RegExp(japanese, 'g');
      let match;
      
      while ((match = regex.exec(text)) !== null) {
        const termEntry = await terminologyProvider.searchJapaneseToEnglish(japanese);
        
        if (termEntry.length > 0) {
          suggestions.push({
            original: japanese,
            suggested: english as string,
            category: termEntry[0].category,
            position: match.index
          });
          categories.add(termEntry[0].category);
        }
      }
    }
    
    return {
      suggestions,
      summary: {
        totalChecked: Object.keys(mapping).length,
        suggestionsCount: suggestions.length,
        categories: Array.from(categories)
      }
    };
  }
}

// シングルトンインスタンス（遅延初期化）
let _docsProvider: DocsProvider | null = null;

export function getDocsProvider(): DocsProvider {
  if (!_docsProvider) {
    _docsProvider = new DocsProvider();
  }
  return _docsProvider;
}

// 後方互換性のため
export const docsProvider = {
  listResources: () => getDocsProvider().listResources(),
  readResource: (uri: string) => getDocsProvider().readResource(uri),
  suggestDocuments: (query: string, maxResults?: number) => getDocsProvider().suggestDocuments(query, maxResults)
};