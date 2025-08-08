import { z } from "zod";
import { IntelligentIssueAnalyzer, type NormalizedInput, type DocumentContext, type AnalysisResult } from "./intelligent-issue-analyzer.ts";
import { idempotencyManager } from "../utils/idempotency-manager.ts";
import { addDraftToFile } from "../utils/issue-file-manager.ts";
import { loadProjectConfig, getFullRepoName } from "../utils/project-config-loader.ts";
import { exploreProjectDocuments } from "../utils/document-explorer.ts";

const TaskGenerationArgsSchema = z.object({
  order: z.string().min(1),
  target_repo: z.string().optional(),
  context: z.string().optional(),
  force_regenerate: z.boolean().default(false),
  save_to_draft: z.boolean().default(false),
});

export interface GeneratedIssue {
  title: string;
  description: string;
  labels: string;
  priority: string;
  phase: string;
  duration: string;
  dependencies: string[];
  securityConsiderations: string[];
  performanceConsiderations: string[];
  acceptanceCriteria: string[];
}

export interface GenerationResult {
  success: boolean;
  issues: GeneratedIssue[];
  metadata: {
    total_issues: number;
    breakdown: Record<string, number>;
    hash: string;
    cached: boolean;
    dependencies: string[];
    analysis_summary: string;
  };
  error?: string;
}

export async function taskGeneratorHandler(args: any): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const { order, target_repo, context, force_regenerate, save_to_draft } = TaskGenerationArgsSchema.parse(args);

    let output = "🤖 タスク生成システム\n\n";
    output += `📝 オーダー: "${order}"\n`;
    output += `🎯 対象リポジトリ: ${target_repo}\n`;
    if (context) {
      output += `🔍 コンテキスト: ${context}\n`;
    }
    output += "\n";

    const analyzer = new IntelligentIssueAnalyzer();
    
    // Phase 1: 入力正規化
    output += "🔄 Phase 1: 入力正規化中...\n";
    const normalizedInput = await analyzer.normalizeInput(order, target_repo, context);
    output += `   正規化完了: ${normalizedInput.extractedKeywords.length}個のキーワード抽出\n`;
    output += `   ハッシュ: ${normalizedInput.hash}\n\n`;

    // 冪等性チェック
    let cachedResult = null;
    if (!force_regenerate) {
      output += "🔍 冪等性チェック中...\n";
      cachedResult = await idempotencyManager.checkCache(normalizedInput.hash);
      
      if (cachedResult) {
        output += "✅ キャッシュヒット！以前の結果を使用します\n\n";
        output += formatGenerationResult(cachedResult.result, true);
        
        return {
          content: [{ type: "text", text: output }]
        };
      } else {
        output += "   キャッシュなし - 新規生成を開始\n\n";
      }
    }

    // Phase 2: 関連ドキュメント収集
    output += "📚 Phase 2: 関連ドキュメント収集中...\n";
    const documentContext = await analyzer.collectRelevantDocs(normalizedInput);
    output += `   関連ドキュメント: ${documentContext.relevantDocs.length}件\n`;
    output += `   用語マッピング: ${Object.keys(documentContext.terminologyMappings).length}件\n`;
    output += `   プロジェクト制約: ${documentContext.projectConstraints.length}件\n\n`;

    // Phase 3: ルール統合分析
    output += "🔬 Phase 3: ルール統合分析中...\n";
    const analysisResult = await analyzer.analyzeWithRules(documentContext, normalizedInput);
    output += `   タスク構造: ${analysisResult.taskStructure.workflow.length}段階ワークフロー\n`;
    output += `   品質基準: ${analysisResult.qualityStandards.priorityOrder.length}項目\n\n`;

    // Phase 4: Issue生成
    output += "⚡ Phase 4: Issue生成中...\n";
    const generationResult = await generateIssues(normalizedInput, documentContext, analysisResult);
    output += `   生成完了: ${generationResult.issues.length}個のIssue\n\n`;

    // キャッシュ保存
    if (!force_regenerate) {
      await idempotencyManager.saveCache(
        normalizedInput.hash,
        { order, targetRepo: target_repo, context },
        generationResult
      );
    }

    // DRAFTセクションに保存
    if (save_to_draft && generationResult.success) {
      output += "💾 DRAFTセクションに保存中...\n";
      const fullRepoName = getFullRepoName(target_repo);
      const draftIssues = await Promise.all(
        generationResult.issues.map(async (issue) => ({
          title: issue.title,
          body: await formatIssueBody(issue, documentContext, analysisResult),
          labels: issue.labels,
          state: "DRAFT" as const,
          repo: fullRepoName
        }))
      );

      const saved = await addDraftToFile(fullRepoName, draftIssues);
      if (saved) {
        output += `   ✅ ${draftIssues.length}件のDRAFT Issueを保存しました\n\n`;
      } else {
        output += `   ⚠️  DRAFT保存に失敗しました\n\n`;
      }
    } else if (!save_to_draft && generationResult.success) {
      output += "📋 Issue候補を生成しました（保存されていません）\n\n";
      output += "⚠️  **次の手順**:\n";
      output += "1. 上記のIssue候補を確認してください\n";
      output += "2. 内容に問題がなければ、以下のコマンドでDRAFTとして保存:\n";
      output += `   \`save_draft_issues repo="${target_repo}" issues='[生成されたIssue]'\`\n`;
      output += "3. DRAFT保存後、GitHub同期で実際のIssueを作成:\n";
      output += `   \`sync_with_github repo="${target_repo}"\`\n\n`;
    }

    // 結果表示
    output += formatGenerationResult(generationResult, false);

    return {
      content: [{ type: "text", text: output }]
    };

  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `❌ タスク生成エラー: ${error instanceof Error ? error.message : String(error)}`
        }
      ]
    };
  }
}

async function generateIssues(
  input: NormalizedInput,
  context: DocumentContext,
  analysis: AnalysisResult
): Promise<GenerationResult> {
  const issues: GeneratedIssue[] = [];
  const breakdown: Record<string, number> = {};
  const dependencies: string[] = [];

  // 各フェーズでIssueを生成
  for (const [phase, phaseConfig] of Object.entries(analysis.taskStructure.phases)) {
    const phaseIssues = await generateIssuesForPhase(
      phase,
      phaseConfig,
      input,
      context,
      analysis
    );
    
    issues.push(...phaseIssues);
    breakdown[phase] = phaseIssues.length;
    
    // 依存関係の記録
    if (phaseConfig.dependencies.length > 0) {
      dependencies.push(`${phase} depends on: ${phaseConfig.dependencies.join(', ')}`);
    }
  }

  // 分析サマリー生成
  const analysisSummary = generateAnalysisSummary(input, context, analysis);

  return {
    success: true,
    issues,
    metadata: {
      total_issues: issues.length,
      breakdown,
      hash: input.hash,
      cached: false,
      dependencies,
      analysis_summary: analysisSummary
    }
  };
}

async function generateIssuesForPhase(
  phase: string,
  _phaseConfig: any,
  input: NormalizedInput,
  context: DocumentContext,
  analysis: AnalysisResult
): Promise<GeneratedIssue[]> {
  const issues: GeneratedIssue[] = [];
  
  switch (phase) {
    case '設計':
      issues.push(...await generateDesignIssues(input, context, analysis));
      break;
    case '実装':
      issues.push(...await generateImplementationIssues(input, context, analysis));
      break;
    case '検証':
      issues.push(...await generateVerificationIssues(input, context, analysis));
      break;
  }
  
  return issues;
}

async function generateDesignIssues(
  input: NormalizedInput,
  context: DocumentContext,
  analysis: AnalysisResult
): Promise<GeneratedIssue[]> {
  const issues: GeneratedIssue[] = [];
  
  // 基本設計Issue
  issues.push({
    title: `${input.originalOrder}の基本設計`,
    description: await generateDesignDescription(input, context),
    labels: `${analysis.issueGeneration.labelSystem.type.replace('feature', 'design')}, ${analysis.issueGeneration.labelSystem.priority}`,
    priority: analysis.issueGeneration.labelSystem.priority.split(':')[1],
    phase: '設計',
    duration: '1-2日',
    dependencies: [],
    securityConsiderations: analysis.qualityStandards.securityRequirements,
    performanceConsiderations: analysis.qualityStandards.performanceConsiderations,
    acceptanceCriteria: [
      '技術スタックの選定と設定',
      'プロジェクト構造の設計',
      'コンポーネント設計',
      '状態管理設計',
      'ルーティング設計',
      '設計書作成とレビュー完了'
    ]
  });

  // セキュリティ設計（セキュリティ要件がある場合）
  if (analysis.qualityStandards.securityRequirements.length > 0) {
    issues.push({
      title: `${input.originalOrder}のセキュリティ設計`,
      description: `セキュリティ要件を考慮した設計を行います。\n\n` +
                  `考慮事項: ${analysis.qualityStandards.securityRequirements.join(', ')}`,
      labels: `type:design, priority:high, tech:security`,
      priority: 'high',
      phase: '設計',
      duration: '1日',
      dependencies: [],
      securityConsiderations: analysis.qualityStandards.securityRequirements,
      performanceConsiderations: [],
      acceptanceCriteria: [
        'セキュリティ要件の明確化',
        '脆弱性の検討',
        'セキュリティレビュー完了'
      ]
    });
  }

  return issues;
}

async function generateImplementationIssues(
  input: NormalizedInput,
  context: DocumentContext,
  analysis: AnalysisResult
): Promise<GeneratedIssue[]> {
  const issues: GeneratedIssue[] = [];
  
  // 技術スタック情報を抽出
  const techStack = await getProjectTechStack();
  
  // 技術領域別のIssue生成
  const techAreas = analysis.issueGeneration.labelSystem.tech;
  
  if (techAreas.length > 0) {
    for (const techArea of techAreas) {
      const area = techArea.replace('tech:', '');
      
      issues.push({
        title: `${input.originalOrder}の${area}実装`,
        description: await generateImplementationDescription(input, context, area),
        labels: `${analysis.issueGeneration.labelSystem.type}, ${analysis.issueGeneration.labelSystem.priority}, ${techArea}`,
        priority: analysis.issueGeneration.labelSystem.priority.split(':')[1],
        phase: '実装',
        duration: '2-3日',
        dependencies: [`${input.originalOrder}の基本設計`],
        securityConsiderations: analysis.qualityStandards.securityRequirements,
        performanceConsiderations: analysis.qualityStandards.performanceConsiderations,
        acceptanceCriteria: generateImplementationAcceptanceCriteria(techStack, area)
      });
    }
  } else {
    // デフォルト実装
    issues.push({
      title: `${input.originalOrder}の実装`,
      description: await generateImplementationDescription(input, context, 'general'),
      labels: `${analysis.issueGeneration.labelSystem.type}, ${analysis.issueGeneration.labelSystem.priority}`,
      priority: analysis.issueGeneration.labelSystem.priority.split(':')[1],
      phase: '実装',
      duration: '2-3日',
      dependencies: [`${input.originalOrder}の基本設計`],
      securityConsiderations: analysis.qualityStandards.securityRequirements,
      performanceConsiderations: analysis.qualityStandards.performanceConsiderations,
      acceptanceCriteria: generateImplementationAcceptanceCriteria(techStack, 'general')
    });
  }

  return issues;
}

async function generateVerificationIssues(
  input: NormalizedInput,
  context: DocumentContext,
  analysis: AnalysisResult
): Promise<GeneratedIssue[]> {
  const issues: GeneratedIssue[] = [];
  
  // 技術スタック情報を抽出
  const techStack = await getProjectTechStack();
  
  // 統合テスト
  issues.push({
    title: `${input.originalOrder}の統合テスト`,
    description: await generateTestDescription(input, context),
    labels: `type:test, ${analysis.issueGeneration.labelSystem.priority}`,
    priority: analysis.issueGeneration.labelSystem.priority.split(':')[1],
    phase: '検証',
    duration: '1日',
    dependencies: [`${input.originalOrder}の実装`],
    securityConsiderations: analysis.qualityStandards.securityRequirements,
    performanceConsiderations: analysis.qualityStandards.performanceConsiderations,
    acceptanceCriteria: generateTestAcceptanceCriteria(techStack)
  });

  return issues;
}

async function generateTestDescription(input: NormalizedInput, _context: DocumentContext): Promise<string> {
  const techStack = await getProjectTechStack();
  let description = `${input.originalOrder}の統合テストを実施します。\n\n`;
  
  // 技術スタック情報
  const hasAnyTech = Object.values(techStack).some(arr => arr.length > 0);
  
  if (hasAnyTech) {
    description += `## テスト技術\n`;
    
    if (techStack.testing.length > 0) {
      description += `**テストフレームワーク**: ${techStack.testing.join(', ')}\n`;
    }
    if (techStack.frontend.length > 0) {
      description += `**対象フレームワーク**: ${techStack.frontend.join(', ')}\n`;
    }
    if (techStack.language.length > 0) {
      description += `**言語**: ${techStack.language.join(', ')}\n`;
    }
    description += '\n';
  }
  
  // テスト内容
  description += `## テスト内容\n`;
  description += `- ユニットテスト\n`;
  description += `- コンポーネントテスト\n`;
  description += `- 統合テスト\n`;
  description += `- E2Eテスト\n`;
  description += `- パフォーマンステスト\n`;
  description += `- セキュリティテスト\n\n`;
  
  // 品質基準
  description += `## 品質基準\n`;
  description += `- テストカバレッジ: 80%以上\n`;
  description += `- 全テストの成功\n`;
  description += `- パフォーマンス基準のクリア\n`;
  description += `- セキュリティ要件の充足\n\n`;
  
  return description;
}

function generateTestAcceptanceCriteria(techStack: TechStack): string[] {
  const criteria: string[] = [];
  
  if (techStack.testing.length > 0) {
    const testLib = techStack.testing[0]; // 最初のテストライブラリを使用
    criteria.push(`${testLib}によるユニットテストの実装と実行`);
  }
  
  criteria.push('コンポーネントテストの実装と実行');
  criteria.push('統合テストの実装と実行');
  criteria.push('テストカバレッジ80%以上の達成');
  criteria.push('全テストの成功');
  criteria.push('パフォーマンス基準のクリア');
  criteria.push('セキュリティ要件の検証');
  criteria.push('品質基準の充足');
  criteria.push('テストレポートの作成');
  
  return criteria;
}

function generateAnalysisSummary(
  input: NormalizedInput,
  context: DocumentContext,
  analysis: AnalysisResult
): string {
  let summary = `智能分析結果:\n`;
  summary += `- 抽出キーワード: ${input.extractedKeywords.join(', ')}\n`;
  summary += `- 関連ドキュメント: ${context.relevantDocs.length}件\n`;
  summary += `- ワークフロー: ${analysis.taskStructure.workflow.join(' → ')}\n`;
  summary += `- 品質優先度: ${analysis.qualityStandards.priorityOrder.join(' > ')}\n`;
  
  if (analysis.qualityStandards.securityRequirements.length > 0) {
    summary += `- セキュリティ要件: ${analysis.qualityStandards.securityRequirements.join(', ')}\n`;
  }
  
  if (analysis.qualityStandards.performanceConsiderations.length > 0) {
    summary += `- パフォーマンス考慮: ${analysis.qualityStandards.performanceConsiderations.join(', ')}\n`;
  }
  
  return summary;
}

/**
 * 結果フォーマット
 */
function formatGenerationResult(result: GenerationResult, cached: boolean): string {
  let output = "";
  
  if (cached) {
    output += "📋 キャッシュされた結果:\n\n";
  } else {
    output += "📋 生成結果:\n\n";
  }
  
  output += `✅ 成功: ${result.issues.length}個のIssue生成\n`;
  output += `📊 内訳: `;
  
  const breakdownItems: string[] = [];
  for (const [phase, count] of Object.entries(result.metadata.breakdown)) {
    breakdownItems.push(`${phase}(${count})`);
  }
  output += breakdownItems.join(', ') + "\n\n";
  
  // 生成されたIssueの一覧
  output += "🎯 生成されたIssue一覧:\n";
  for (let i = 0; i < result.issues.length; i++) {
    const issue = result.issues[i];
    output += `\n${i + 1}. **${issue.title}**\n`;
    output += `   - Phase: ${issue.phase}\n`;
    output += `   - Duration: ${issue.duration}\n`;
    output += `   - Priority: ${issue.priority}\n`;
    output += `   - Labels: ${issue.labels}\n`;
    
    if (issue.dependencies.length > 0) {
      output += `   - Dependencies: ${issue.dependencies.join(', ')}\n`;
    }
    
    if (issue.securityConsiderations.length > 0) {
      output += `   - Security: ${issue.securityConsiderations.join(', ')}\n`;
    }
  }
  
  // 分析サマリー
  output += `\n📈 分析サマリー:\n${result.metadata.analysis_summary}\n`;
  
  // 依存関係
  if (result.metadata.dependencies.length > 0) {
    output += `\n🔗 依存関係:\n`;
    for (const dep of result.metadata.dependencies) {
      output += `   - ${dep}\n`;
    }
  }
  
  return output;
}

interface TechStack {
  frontend: string[];
  build: string[];
  testing: string[];
  state: string[];
  ui: string[];
  language: string[];
}

/**
 * プロジェクトドキュメントから技術スタック情報を取得
 */
async function getProjectTechStack(): Promise<TechStack> {
  try {
    const projectContext = await exploreProjectDocuments();
    const techStackInfo = projectContext.techStack;
    
    // TechStackInfo を TechStack 形式に変換
    const techStack: TechStack = {
      frontend: [],
      build: [],
      testing: [],
      state: [],
      ui: [],
      language: []
    };
    
    if (techStackInfo.framework) {
      techStack.frontend.push(techStackInfo.framework);
    }
    if (techStackInfo.language) {
      techStack.language.push(techStackInfo.language);
    }
    if (techStackInfo.buildTool) {
      techStack.build.push(techStackInfo.buildTool);
    }
    if (techStackInfo.uiLibrary) {
      techStack.ui.push(techStackInfo.uiLibrary);
    }
    if (techStackInfo.stateManagement) {
      techStack.state.push(techStackInfo.stateManagement);
    }
    if (techStackInfo.testing) {
      techStack.testing.push(techStackInfo.testing);
    }
    if (techStackInfo.styling) {
      techStack.ui.push(techStackInfo.styling);
    }
    
    return techStack;
  } catch (error) {
    console.warn('プロジェクト技術スタック取得に失敗、空の技術スタックを返します:', error);
    return {
      frontend: [],
      build: [],
      testing: [],
      state: [],
      ui: [],
      language: []
    };
  }
}

async function generateDesignDescription(input: NormalizedInput, context: DocumentContext): Promise<string> {
  const techStack = await getProjectTechStack();
  let description = `${input.originalOrder}の基本設計を行います。\n\n`;
  
  // 技術スタック情報
  const hasAnyTech = Object.values(techStack).some(arr => arr.length > 0);
  
  if (hasAnyTech) {
    description += `## 技術スタック\n`;
    
    if (techStack.language.length > 0) {
      description += `**言語**: ${techStack.language.join(', ')}\n`;
    }
    if (techStack.frontend.length > 0) {
      description += `**フレームワーク**: ${techStack.frontend.join(', ')}\n`;
    }
    if (techStack.build.length > 0) {
      description += `**ビルドツール**: ${techStack.build.join(', ')}\n`;
    }
    if (techStack.ui.length > 0) {
      description += `**UI/スタイリング**: ${techStack.ui.join(', ')}\n`;
    }
    if (techStack.state.length > 0) {
      description += `**状態管理**: ${techStack.state.join(', ')}\n`;
    }
    if (techStack.testing.length > 0) {
      description += `**テスト**: ${techStack.testing.join(', ')}\n`;
    }
    description += '\n';
  }
  
  // 設計で決定すべき事項
  description += `## 設計で決定すべき事項\n`;
  description += `- プロジェクト構造とディレクトリ設計\n`;
  description += `- コンポーネント設計方針\n`;
  description += `- ルーティング構成\n`;
  description += `- 状態管理の設計\n`;
  description += `- API通信の設計\n`;
  description += `- スタイリングの設計方針\n`;
  description += `- テスト戦略\n\n`;
  
  // 関連ドキュメント
  if (context.relevantDocs.length > 0) {
    description += `## 参考ドキュメント\n`;
    context.relevantDocs.forEach(doc => {
      description += `- ${doc.path}\n`;
    });
    description += '\n';
  }
  
  return description;
}

async function generateImplementationDescription(input: NormalizedInput, _context: DocumentContext, area: string): Promise<string> {
  const techStack = await getProjectTechStack();
  let description = `${input.originalOrder}の${area === 'general' ? '' : area}実装を行います。\n\n`;
  
  // 技術スタック情報
  const hasAnyTech = Object.values(techStack).some(arr => arr.length > 0);
  
  if (hasAnyTech) {
    description += `## 使用技術\n`;
    
    if (techStack.language.length > 0) {
      description += `**言語**: ${techStack.language.join(', ')}\n`;
    }
    if (techStack.frontend.length > 0) {
      description += `**フレームワーク**: ${techStack.frontend.join(', ')}\n`;
    }
    if (techStack.build.length > 0) {
      description += `**ビルドツール**: ${techStack.build.join(', ')}\n`;
    }
    if (techStack.ui.length > 0) {
      description += `**UI/スタイリング**: ${techStack.ui.join(', ')}\n`;
    }
    if (techStack.state.length > 0) {
      description += `**状態管理**: ${techStack.state.join(', ')}\n`;
    }
    if (techStack.testing.length > 0) {
      description += `**テスト**: ${techStack.testing.join(', ')}\n`;
    }
    description += '\n';
  }
  
  // 実装内容
  description += `## 実装内容\n`;
  if (area === 'frontend' || area === 'general') {
    description += `- 環境構築とプロジェクト初期化\n`;
    description += `- 基本的なファイル構造の作成\n`;
    description += `- 主要コンポーネントの実装\n`;
    description += `- ルーティングの設定\n`;
    description += `- 状態管理の実装\n`;
    description += `- API通信の実装\n`;
    description += `- スタイリングの適用\n`;
  } else {
    description += `- ${area}関連の実装\n`;
    description += `- 必要な設定とセットアップ\n`;
    description += `- 機能の実装\n`;
  }
  description += '\n';
  
  return description;
}

function generateImplementationAcceptanceCriteria(techStack: TechStack, area: string): string[] {
  const criteria: string[] = [];
  
  if (area === 'frontend' || area === 'general') {
    criteria.push('プロジェクト環境の構築完了');
    
    if (techStack.build.length > 0) {
      const buildTool = techStack.build[0]; // 最初のビルドツールを使用
      criteria.push(`${buildTool}による開発環境の構築`);
    }
    
    if (techStack.frontend.length > 0) {
      const framework = techStack.frontend[0]; // 最初のフレームワークを使用
      criteria.push(`${framework}コンポーネントの実装`);
    }
    
    if (techStack.ui.length > 0) {
      const uiLib = techStack.ui[0]; // 最初のUIライブラリを使用
      criteria.push(`${uiLib}コンポーネントの実装`);
    }
    
    if (techStack.state.length > 0) {
      const stateLib = techStack.state[0]; // 最初の状態管理ライブラリを使用
      criteria.push(`${stateLib}による状態管理の実装`);
    }
    
    if (techStack.testing.length > 0) {
      const testLib = techStack.testing[0]; // 最初のテストライブラリを使用
      criteria.push(`${testLib}による単体テストの実装`);
    }
    
    if (techStack.language.length > 0) {
      const language = techStack.language[0]; // 最初の言語を使用
      if (language.includes('TypeScript')) {
        criteria.push(`${language}による型安全性の確保`);
      }
    }
    criteria.push('コードレビューの完了');
    criteria.push('基本的な動作確認');
  } else {
    criteria.push(`${area}機能の実装完了`);
    criteria.push('単体テストの実装');
    criteria.push('コードレビューの完了');
  }
  
  return criteria;
}

/**
 * Issue本文のフォーマット（_llm-docs、implementation_principles.md等を活用）
 */
async function formatIssueBody(
  issue: GeneratedIssue, 
  documentContext: DocumentContext, 
  analysisResult: AnalysisResult
): Promise<string> {
  let body = issue.description + '\n';
  
  // プロジェクト制約を追加
  if (documentContext.projectConstraints.length > 0) {
    body += `## プロジェクト制約\n`;
    documentContext.projectConstraints.forEach(constraint => {
      body += `- ${constraint}\n`;
    });
    body += '\n';
  }
  
  // implementation_principles.mdからの品質基準
  if (analysisResult.qualityStandards.priorityOrder.length > 0) {
    body += `## 品質基準（優先度順）\n`;
    analysisResult.qualityStandards.priorityOrder.forEach((standard, index) => {
      body += `${index + 1}. ${standard}\n`;
    });
    body += '\n';
  }
  
  // 依存関係
  if (issue.dependencies.length > 0) {
    body += `## 依存関係\n`;
    issue.dependencies.forEach(dep => {
      body += `- ${dep}\n`;
    });
    body += '\n';
  }
  
  // 受け入れ条件
  if (issue.acceptanceCriteria.length > 0) {
    body += `## 受け入れ条件\n`;
    issue.acceptanceCriteria.forEach(criteria => {
      body += `- [ ] ${criteria}\n`;
    });
    body += '\n';
  }
  
  // セキュリティ考慮事項（implementation_principles.mdから）
  if (issue.securityConsiderations.length > 0) {
    body += `## セキュリティ考慮事項\n`;
    issue.securityConsiderations.forEach(sec => {
      body += `- ${sec}\n`;
    });
    body += '\n';
  }
  
  // パフォーマンス考慮事項（implementation_principles.mdから）
  if (issue.performanceConsiderations.length > 0) {
    body += `## パフォーマンス考慮事項\n`;
    issue.performanceConsiderations.forEach(perf => {
      body += `- ${perf}\n`;
    });
    body += '\n';
  }
  
  // 関連ドキュメント（_llm-docs配下）
  if (documentContext.relevantDocs.length > 0) {
    body += `## 関連ドキュメント\n`;
    documentContext.relevantDocs.forEach(doc => {
      body += `- [${doc.path}](${doc.path}) (関連度: ${Math.round(doc.relevance * 100)}%)\n`;
    });
    body += '\n';
  }
  
  // 用語マッピング（dictionary.mdから）
  if (Object.keys(documentContext.terminologyMappings).length > 0) {
    body += `## 用語定義\n`;
    Object.entries(documentContext.terminologyMappings).forEach(([japanese, english]) => {
      body += `- **${japanese}**: ${english}\n`;
    });
    body += '\n';
  }
  
  // タスク管理情報
  const currentPhase = analysisResult.taskStructure.phases[issue.phase];
  if (currentPhase) {
    body += `## フェーズ詳細\n`;
    body += `**説明**: ${currentPhase.description}\n`;
    body += `**想定期間**: ${currentPhase.duration}\n`;
    if (currentPhase.dependencies.length > 0) {
      body += `**前提条件**: ${currentPhase.dependencies.join(', ')}\n`;
    }
    body += '\n';
  }
  
  // 技術スタック抽出情報
  const techStack = await getProjectTechStack();
  const hasAnyTech = Object.values(techStack).some(arr => arr.length > 0);
  
  if (hasAnyTech) {
    body += `## 技術スタック詳細\n`;
    
    if (techStack.language.length > 0) {
      body += `**言語**: ${techStack.language.join(', ')}\n`;
    }
    if (techStack.frontend.length > 0) {
      body += `**フロントエンド**: ${techStack.frontend.join(', ')}\n`;
    }
    if (techStack.build.length > 0) {
      body += `**ビルド**: ${techStack.build.join(', ')}\n`;
    }
    if (techStack.ui.length > 0) {
      body += `**UI/CSS**: ${techStack.ui.join(', ')}\n`;
    }
    if (techStack.state.length > 0) {
      body += `**状態管理**: ${techStack.state.join(', ')}\n`;
    }
    if (techStack.testing.length > 0) {
      body += `**テスト**: ${techStack.testing.join(', ')}\n`;
    }
    body += '\n';
  }
  
  body += `---\n🤖 Generated by Task Generation System\n`;
  body += `📊 分析情報: ${documentContext.relevantDocs.length}件の関連ドキュメント、${analysisResult.qualityStandards.priorityOrder.length}項目の品質基準を参照`;
  
  return body;
}

