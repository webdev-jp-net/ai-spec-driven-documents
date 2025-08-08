import { terminologyProvider } from "../resources/terminology-provider.ts";
import { docsProvider } from "../resources/docs-provider.ts";
import { readTextFileSafe, resolveProjectPath } from "../utils/file-operations.ts";
import { getProjectConfigValue } from "../utils/project-config-loader.ts";

/**
 * 正規化された入力データ
 */
export interface NormalizedInput {
  originalOrder: string;
  normalizedOrder: string;
  extractedKeywords: string[];
  targetRepo: string;
  context: string | undefined;
  hash: string;
}

/**
 * ドキュメント文脈情報
 */
export interface DocumentContext {
  relevantDocs: Array<{
    path: string;
    content: string;
    relevance: number;
  }>;
  terminologyMappings: Record<string, string>;
  projectConstraints: string[];
}

export interface AnalysisResult {
  taskStructure: {
    workflow: string[];
    phases: Record<string, {
      duration: string;
      description: string;
      dependencies: string[];
    }>;
  };
  issueGeneration: {
    labelSystem: {
      type: string;
      priority: string;
      tech: string[];
    };
    duplicationRisk: number;
  };
  qualityStandards: {
    priorityOrder: string[];
    securityRequirements: string[];
    performanceConsiderations: string[];
  };
}

export class IntelligentIssueAnalyzer {
  
  async normalizeInput(order: string, targetRepo: string, context?: string): Promise<NormalizedInput> {
    // 基本的な前処理
    const cleanOrder = order.trim().toLowerCase();
    
    // 用語辞書による正規化
    const terminologyData = await terminologyProvider.readResource("terminology://dictionary/japanese-to-english");
    const terminologyMapping = JSON.parse(terminologyData.contents[0].text).mapping;
    
    let normalizedOrder = cleanOrder;
    const extractedKeywords: string[] = [];
    
    // 用語の正規化と キーワード抽出
    for (const [japanese, english] of Object.entries(terminologyMapping)) {
      if (cleanOrder.includes(japanese)) {
        normalizedOrder = normalizedOrder.replace(new RegExp(japanese, 'g'), english as string);
        extractedKeywords.push(english as string);
      }
    }
    
    // 動作キーワードの抽出
    const actionKeywords = this.extractActionKeywords(cleanOrder);
    extractedKeywords.push(...actionKeywords);
    
    // ハッシュ生成（冪等性用）
    const hash = await this.generateHash(order, targetRepo, context);
    
    return {
      originalOrder: order,
      normalizedOrder,
      extractedKeywords: [...new Set(extractedKeywords)], // 重複除去
      targetRepo,
      context,
      hash
    };
  }
  
  /**
   * Phase 2: 関連ドキュメント収集
   */
  async collectRelevantDocs(input: NormalizedInput): Promise<DocumentContext> {
    const relevantDocs = [];
    const terminologyMappings: Record<string, string> = {};
    const projectConstraints: string[] = [];
    
    // 1. 対象リポジトリの仕様書を収集
    const repoDocPath = `${input.targetRepo}/index.md`;
    const repoDocContent = await readTextFileSafe(resolveProjectPath(`_llm-docs/${repoDocPath}`));
    
    if (repoDocContent) {
      relevantDocs.push({
        path: repoDocPath,
        content: repoDocContent,
        relevance: 1.0 // 対象リポジトリは最高関連度
      });
    }
    
    // 2. 関連ドキュメントの自動提案
    const suggestedDocs = await docsProvider.suggestRelevantDocuments(input.originalOrder);
    
    for (const doc of suggestedDocs) {
      if (doc.uri.startsWith("file://_llm-docs/")) {
        const docPath = doc.uri.replace("file://_llm-docs/", "");
        const docContent = await readTextFileSafe(resolveProjectPath(`_llm-docs/${docPath}`));
        
        if (docContent) {
          // 関連度を計算（キーワード一致度ベース）
          const relevance = this.calculateRelevance(input.extractedKeywords, docContent);
          
          relevantDocs.push({
            path: docPath,
            content: docContent,
            relevance
          });
        }
      }
    }
    
    // 3. 用語マッピングの収集
    const terminologyData = await terminologyProvider.readResource("terminology://dictionary/japanese-to-english");
    const fullMapping = JSON.parse(terminologyData.contents[0].text).mapping;
    
    // 関連する用語のみを抽出
    for (const keyword of input.extractedKeywords) {
      if (fullMapping[keyword]) {
        terminologyMappings[keyword] = fullMapping[keyword];
      }
    }
    
    // 4. プロジェクト制約の抽出
    const entryPointPath = getProjectConfigValue<string>('documents.entryPoint', '_llm-docs/requirements_definition.md');
    const requirementsContent = await readTextFileSafe(resolveProjectPath(entryPointPath));
    if (requirementsContent) {
      projectConstraints.push(...this.extractConstraints(requirementsContent));
    }
    
    return {
      relevantDocs: relevantDocs.sort((a, b) => b.relevance - a.relevance), // 関連度順でソート
      terminologyMappings,
      projectConstraints
    };
  }
  
  async analyzeWithRules(_context: DocumentContext, input: NormalizedInput): Promise<AnalysisResult> {
    // 1. task_management_rule.md の分析
    const taskManagementRulePath = getProjectConfigValue<string>('documents.taskManagementRule', '_llm-rules/task_management_rule.md');
    const taskManagementContent = await readTextFileSafe(resolveProjectPath(taskManagementRulePath));
    const taskStructure = this.analyzeTaskStructure(taskManagementContent || '');
    
    // 2. issue_generation_rule.md の分析
    const issueGenerationRulePath = getProjectConfigValue<string>('documents.issueGenerationRule', '_llm-rules/issue_generation_rule.md');
    const issueGenerationContent = await readTextFileSafe(resolveProjectPath(issueGenerationRulePath));
    const issueGeneration = this.analyzeIssueGeneration(issueGenerationContent || '', input);
    
    // 3. implementation_principles.md の分析
    const implementationPrinciplesPath = getProjectConfigValue<string>('documents.implementationPrinciples', '_llm-rules/implementation_principles.md');
    const implementationContent = await readTextFileSafe(resolveProjectPath(implementationPrinciplesPath));
    const qualityStandards = this.analyzeQualityStandards(implementationContent || '', input);
    
    return {
      taskStructure,
      issueGeneration,
      qualityStandards
    };
  }
  
  private extractActionKeywords(text: string): string[] {
    const actionPatterns = [
      /実装|作成|開発|構築/g,
      /追加|新規|作る/g,
      /修正|改善|更新/g,
      /削除|除去|取り除く/g,
      /管理|編集|操作/g,
      /表示|閲覧|確認/g,
      /検索|フィルタ|絞り込み/g
    ];
    
    const keywords: string[] = [];
    for (const pattern of actionPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        keywords.push(...matches);
      }
    }
    
    return keywords;
  }
  
  /**
   * 関連度計算
   */
  private calculateRelevance(keywords: string[], content: string): number {
    let score = 0;
    const contentLower = content.toLowerCase();
    
    for (const keyword of keywords) {
      const keywordLower = keyword.toLowerCase();
      const matches = (contentLower.match(new RegExp(keywordLower, 'g')) || []).length;
      score += matches * 0.1; // 1回の出現で0.1点
    }
    
    return Math.min(score, 1.0); // 最大1.0で制限
  }
  
  private extractConstraints(content: string): string[] {
    const constraints: string[] = [];
    
    // 制約を示すパターンを検索
    const constraintPatterns = [
      /制約|制限|禁止/g,
      /必須|必要|要求/g,
      /セキュリティ|認証|認可/g,
      /パフォーマンス|性能|速度/g
    ];
    
    for (const pattern of constraintPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        constraints.push(...matches);
      }
    }
    
    return [...new Set(constraints)];
  }
  
  private analyzeTaskStructure(_content: string): AnalysisResult['taskStructure'] {
    return {
      workflow: ['設計', '実装', '検証'],
      phases: {
        '設計': {
          duration: '1-2日',
          description: 'システム設計、アーキテクチャ設計、API設計',
          dependencies: []
        },
        '実装': {
          duration: '1-3日',
          description: 'フロントエンド、バックエンド、インフラ実装',
          dependencies: ['設計']
        },
        '検証': {
          duration: '0.5-1日',
          description: 'テスト、レビュー、品質確認',
          dependencies: ['実装']
        }
      }
    };
  }
  
  private analyzeIssueGeneration(_content: string, input: NormalizedInput): AnalysisResult['issueGeneration'] {
    // 機能タイプの判定
    const isBugFix = input.originalOrder.includes('修正') || input.originalOrder.includes('バグ');
    const isEnhancement = input.originalOrder.includes('改善') || input.originalOrder.includes('向上');
    
    let type = 'feature';
    if (isBugFix) type = 'bug';
    else if (isEnhancement) type = 'enhancement';
    
    // 優先度の判定
    const isHighPriority = input.originalOrder.includes('緊急') || input.originalOrder.includes('重要');
    const isLowPriority = input.originalOrder.includes('後で') || input.originalOrder.includes('将来');
    
    let priority = 'medium';
    if (isHighPriority) priority = 'high';
    else if (isLowPriority) priority = 'low';
    
    // 技術領域の判定
    const techAreas: string[] = [];
    if (input.originalOrder.includes('画面') || input.originalOrder.includes('UI')) techAreas.push('frontend');
    if (input.originalOrder.includes('API') || input.originalOrder.includes('サーバー')) techAreas.push('backend');
    if (input.originalOrder.includes('データベース') || input.originalOrder.includes('DB')) techAreas.push('database');
    if (input.originalOrder.includes('インフラ') || input.originalOrder.includes('デプロイ')) techAreas.push('infra');
    
    return {
      labelSystem: {
        type: `type:${type}`,
        priority: `priority:${priority}`,
        tech: techAreas.map(area => `tech:${area}`)
      },
      duplicationRisk: 0.3 // 基本的な重複リスク
    };
  }
  
  private analyzeQualityStandards(_content: string, input: NormalizedInput): AnalysisResult['qualityStandards'] {
    const securityRequirements: string[] = [];
    const performanceConsiderations: string[] = [];
    
    // セキュリティ要件の判定
    if (input.originalOrder.includes('認証') || input.originalOrder.includes('ログイン')) {
      securityRequirements.push('入力値検証', '認証処理', 'セッション管理');
    }
    if (input.originalOrder.includes('データ') || input.originalOrder.includes('情報')) {
      securityRequirements.push('データ暗号化', 'アクセス制御');
    }
    
    // パフォーマンス考慮事項の判定
    if (input.originalOrder.includes('一覧') || input.originalOrder.includes('リスト')) {
      performanceConsiderations.push('ページング', 'キャッシュ', 'インデックス');
    }
    if (input.originalOrder.includes('検索') || input.originalOrder.includes('フィルタ')) {
      performanceConsiderations.push('クエリ最適化', '全文検索', 'インデックス');
    }
    
    return {
      priorityOrder: ['セキュリティ', 'パフォーマンス', '可読性'],
      securityRequirements,
      performanceConsiderations
    };
  }
  
  private async generateHash(order: string, targetRepo: string, context?: string): Promise<string> {
    const content = `${order}:${targetRepo}:${context || ''}`;
    
    // シンプルなハッシュ生成（実際の実装では crypto モジュールを使用）
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32bit整数に変換
    }
    
    return Math.abs(hash).toString(16);
  }
}