import { readTextFileSafe, resolveProjectPath } from "../utils/file-operations.ts";
import { McpResource } from "../types/mcp.ts";
import { getProjectConfigValue } from "../utils/project-config-loader.ts";

/**
 * 用語辞書の項目
 */
export interface TerminologyEntry {
  japanese: string;
  english: string;
  description: string;
  usage: string;
  category: string;
  repository: string | undefined;
  value: string | number | undefined;
}

/**
 * 用語辞書リソースプロバイダー
 */
export class TerminologyProvider {
  private dictionaryPath: string | null = null;
  private terminologyMap: Map<string, TerminologyEntry[]> = new Map();
  private reverseMap: Map<string, TerminologyEntry> = new Map();

  constructor() {
    // 辞書パスは初期化時に設定から取得
  }

  /**
   * 設定から辞書パスを取得
   */
  private async getDictionaryPath(): Promise<string> {
    if (this.dictionaryPath) {
      return this.dictionaryPath;
    }

    try {
      // 設定から辞書パスを取得、デフォルト値で後方互換性確保
      const dictionaryPath = getProjectConfigValue<string>('documents.dictionary', '_llm-docs/operation/dictionary.md');
      this.dictionaryPath = resolveProjectPath(dictionaryPath);
      return this.dictionaryPath;
    } catch (error) {
      // 設定読み込みエラー時はデフォルト値を使用
      console.warn('設定読み込みエラー、デフォルトの辞書パスを使用:', error);
      this.dictionaryPath = resolveProjectPath('_llm-docs/operation/dictionary.md');
      return this.dictionaryPath;
    }
  }

  /**
   * 利用可能な用語辞書リソースをリストアップ
   */
  async listResources(): Promise<McpResource[]> {
    await this.loadDictionary();

    const resources: McpResource[] = [
      {
        uri: "terminology://dictionary/full",
        name: "完全な用語辞書",
        description: "全ての用語マッピングを含む完全な辞書",
        mimeType: "application/json"
      },
      {
        uri: "terminology://dictionary/japanese-to-english",
        name: "日本語→英語マッピング",
        description: "日本語用語から英語用語への変換マッピング",
        mimeType: "application/json"
      },
      {
        uri: "terminology://dictionary/english-to-japanese",
        name: "英語→日本語マッピング",
        description: "英語用語から日本語用語への変換マッピング",
        mimeType: "application/json"
      },
      {
        uri: "terminology://dictionary/categories",
        name: "用語カテゴリ一覧",
        description: "用語のカテゴリ別分類",
        mimeType: "application/json"
      },
      {
        uri: "terminology://dictionary/repositories",
        name: "リポジトリ用語マッピング",
        description: "リポジトリ名と用語の対応関係",
        mimeType: "application/json"
      }
    ];

    return resources;
  }

  /**
   * 指定されたリソースを読み込む
   */
  async readResource(uri: string): Promise<{ contents: Array<{ type: string; text: string }> }> {
    await this.loadDictionary();

    try {
      let content: string;

      switch (uri) {
        case "terminology://dictionary/full":
          content = this.generateFullDictionary();
          break;
        case "terminology://dictionary/japanese-to-english":
          content = this.generateJapaneseToEnglishMapping();
          break;
        case "terminology://dictionary/english-to-japanese":
          content = this.generateEnglishToJapaneseMapping();
          break;
        case "terminology://dictionary/categories":
          content = this.generateCategoryMapping();
          break;
        case "terminology://dictionary/repositories":
          content = this.generateRepositoryMapping();
          break;
        default:
          throw new Error(`Unknown terminology resource: ${uri}`);
      }

      return {
        contents: [
          {
            type: "text",
            text: content
          }
        ]
      };

    } catch (error) {
      throw new Error(`Failed to read terminology resource: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 辞書ファイルを読み込んで解析
   */
  private async loadDictionary(): Promise<void> {
    try {
      const dictionaryPath = await this.getDictionaryPath();
      const content = await readTextFileSafe(dictionaryPath);
      if (!content) {
        throw new Error("Dictionary file not found");
      }

      this.terminologyMap.clear();
      this.reverseMap.clear();

      this.parseDictionary(content);
    } catch (error) {
      console.error('Error loading dictionary:', error);
    }
  }

  /**
   * 辞書の内容を解析してマップを構築
   */
  private parseDictionary(content: string): void {
    const lines = content.split('\n');
    let currentCategory = '';
    let inTable = false;

    for (const line of lines) {
      // カテゴリヘッダーの検出
      if (line.startsWith('###')) {
        currentCategory = line.replace('###', '').trim();
        inTable = false;
        continue;
      }

      // テーブルヘッダーの検出
      if (line.includes('|') && line.includes('日本語') && line.includes('英語')) {
        inTable = true;
        continue;
      }

      // テーブル区切り線をスキップ
      if (line.includes('|') && line.includes('---')) {
        continue;
      }

      // テーブル行の処理
      if (inTable && line.includes('|')) {
        const cells = line.split('|').map(c => c.trim()).filter(c => c);
        
        if (cells.length >= 2) {
          const entry: TerminologyEntry = {
            japanese: cells[0] || '',
            english: cells[1] || '',
            description: cells[2] || '',
            usage: cells[3] || '',
            category: currentCategory,
            repository: cells[4] || undefined,
            value: cells[2] && !isNaN(Number(cells[2])) ? Number(cells[2]) : undefined
          };

          // 日本語→英語マッピング
          if (!this.terminologyMap.has(entry.japanese)) {
            this.terminologyMap.set(entry.japanese, []);
          }
          this.terminologyMap.get(entry.japanese)!.push(entry);

          // 英語→日本語マッピング（逆引き）
          this.reverseMap.set(entry.english, entry);
        }
      }
    }
  }

  /**
   * 完全な辞書を生成
   */
  private generateFullDictionary(): string {
    const dictionary: Record<string, TerminologyEntry[]> = {};
    
    for (const [key, entries] of this.terminologyMap) {
      dictionary[key] = entries;
    }

    return JSON.stringify({
      metadata: {
        source: "dictionary.md",
        totalEntries: this.terminologyMap.size,
        categories: this.getCategories()
      },
      dictionary
    }, null, 2);
  }

  /**
   * 日本語→英語マッピングを生成
   */
  private generateJapaneseToEnglishMapping(): string {
    const mapping: Record<string, string> = {};
    
    for (const [japanese, entries] of this.terminologyMap) {
      // 複数の英語対応がある場合は最初のものを使用
      if (entries.length > 0) {
        mapping[japanese] = entries[0].english;
      }
    }

    return JSON.stringify({
      metadata: {
        direction: "japanese-to-english",
        totalMappings: Object.keys(mapping).length
      },
      mapping
    }, null, 2);
  }

  /**
   * 英語→日本語マッピングを生成
   */
  private generateEnglishToJapaneseMapping(): string {
    const mapping: Record<string, string> = {};
    
    for (const [english, entry] of this.reverseMap) {
      mapping[english] = entry.japanese;
    }

    return JSON.stringify({
      metadata: {
        direction: "english-to-japanese",
        totalMappings: Object.keys(mapping).length
      },
      mapping
    }, null, 2);
  }

  /**
   * カテゴリマッピングを生成
   */
  private generateCategoryMapping(): string {
    const categories: Record<string, TerminologyEntry[]> = {};
    
    for (const [, entries] of this.terminologyMap) {
      for (const entry of entries) {
        if (!categories[entry.category]) {
          categories[entry.category] = [];
        }
        categories[entry.category].push(entry);
      }
    }

    return JSON.stringify({
      metadata: {
        totalCategories: Object.keys(categories).length,
        categories: Object.keys(categories)
      },
      categories
    }, null, 2);
  }

  /**
   * リポジトリマッピングを生成
   */
  private generateRepositoryMapping(): string {
    const repositories: Record<string, TerminologyEntry[]> = {};
    
    for (const [, entries] of this.terminologyMap) {
      for (const entry of entries) {
        if (entry.repository) {
          if (!repositories[entry.repository]) {
            repositories[entry.repository] = [];
          }
          repositories[entry.repository].push(entry);
        }
      }
    }

    return JSON.stringify({
      metadata: {
        totalRepositories: Object.keys(repositories).length,
        repositories: Object.keys(repositories)
      },
      repositories
    }, null, 2);
  }

  /**
   * カテゴリ一覧を取得
   */
  private getCategories(): string[] {
    const categories = new Set<string>();
    
    for (const [, entries] of this.terminologyMap) {
      for (const entry of entries) {
        categories.add(entry.category);
      }
    }

    return Array.from(categories);
  }

  /**
   * 用語検索（日本語→英語）
   */
  async searchJapaneseToEnglish(term: string): Promise<TerminologyEntry[]> {
    await this.loadDictionary();
    return this.terminologyMap.get(term) || [];
  }

  /**
   * 用語検索（英語→日本語）
   */
  async searchEnglishToJapanese(term: string): Promise<TerminologyEntry | undefined> {
    await this.loadDictionary();
    return this.reverseMap.get(term);
  }

  /**
   * 部分一致検索
   */
  async searchPartial(query: string): Promise<TerminologyEntry[]> {
    await this.loadDictionary();
    
    const results: TerminologyEntry[] = [];
    
    for (const [, entries] of this.terminologyMap) {
      for (const entry of entries) {
        if (entry.japanese.includes(query) || 
            entry.english.includes(query) ||
            entry.description.includes(query)) {
          results.push(entry);
        }
      }
    }

    return results;
  }

  /**
   * 高度なキーワード正規化（智能Issue生成用）
   */
  async normalizeKeywords(text: string): Promise<{
    normalized: string;
    mappings: Record<string, string>;
    extractedTerms: TerminologyEntry[];
  }> {
    await this.loadDictionary();
    
    const mappings: Record<string, string> = {};
    const extractedTerms: TerminologyEntry[] = [];
    let normalized = text;
    
    // 全ての用語マッピングを適用
    for (const [japanese, entries] of this.terminologyMap) {
      if (normalized.includes(japanese)) {
        const primaryEntry = entries[0]; // 最初のエントリを使用
        normalized = normalized.replace(new RegExp(japanese, 'g'), primaryEntry.english);
        mappings[japanese] = primaryEntry.english;
        extractedTerms.push(primaryEntry);
      }
    }
    
    // 逆引きマッピングも適用
    for (const [english, entry] of this.reverseMap) {
      if (normalized.includes(english) && !extractedTerms.includes(entry)) {
        extractedTerms.push(entry);
      }
    }
    
    return {
      normalized,
      mappings,
      extractedTerms
    };
  }

  /**
   * 関連用語の提案（智能Issue生成用）
   */
  async suggestRelatedTerms(baseTerms: string[]): Promise<TerminologyEntry[]> {
    await this.loadDictionary();
    
    const suggestions: TerminologyEntry[] = [];
    const categories = new Set<string>();
    
    // 基本用語のカテゴリを収集
    for (const term of baseTerms) {
      const entries = await this.searchJapaneseToEnglish(term);
      for (const entry of entries) {
        categories.add(entry.category);
      }
    }
    
    // 同じカテゴリの他の用語を提案
    for (const [, entries] of this.terminologyMap) {
      for (const entry of entries) {
        if (categories.has(entry.category) && !baseTerms.includes(entry.japanese)) {
          suggestions.push(entry);
        }
      }
    }
    
    // 関連度でソート（カテゴリ一致度、使用頻度など）
    return suggestions.slice(0, 10); // 上位10件を返す
  }

  /**
   * 用語の関連度スコア計算
   */
  async calculateTermRelevance(term: string, context: string): Promise<number> {
    await this.loadDictionary();
    
    const entries = await this.searchJapaneseToEnglish(term);
    if (entries.length === 0) return 0;
    
    const entry = entries[0];
    let score = 0;
    
    // 基本スコア
    score += 0.5;
    
    // 文脈一致度
    if (context.includes(entry.japanese) || context.includes(entry.english)) {
      score += 0.3;
    }
    
    // 説明文の関連度
    if (entry.description && context.includes(entry.description)) {
      score += 0.2;
    }
    
    // カテゴリ関連度
    if (entry.category && context.includes(entry.category)) {
      score += 0.1;
    }
    
    return Math.min(score, 1.0);
  }
}

// シングルトンインスタンス（遅延初期化）
let _terminologyProvider: TerminologyProvider | null = null;

export function getTerminologyProvider(): TerminologyProvider {
  if (!_terminologyProvider) {
    _terminologyProvider = new TerminologyProvider();
  }
  return _terminologyProvider;
}

// 後方互換性のため
export const terminologyProvider = {
  listResources: () => getTerminologyProvider().listResources(),
  readResource: (uri: string) => getTerminologyProvider().readResource(uri),
  loadDictionary: () => getTerminologyProvider().loadDictionary(),
  getTerminologyMapping: (includeDescription?: boolean) => getTerminologyProvider().getTerminologyMapping(includeDescription),
  checkAndSuggestReplacements: (text: string) => getTerminologyProvider().checkAndSuggestReplacements(text)
};