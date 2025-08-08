import { GitHubClient } from "../utils/github-client.ts";
import { loadExistingDrafts, updateIssueListFile } from "../utils/issue-file-manager.ts";
import { gitHubProjectsClient } from "../utils/github-projects.ts";
import { z } from "zod";
import type { DraftIssue } from "../types/issue.ts";
import { docsProvider } from "../resources/docs-provider.ts";
import { loadProjectConfig, getFullRepoName } from "../utils/project-config-loader.ts";
import { collectTaskContext, formatTechStack, formatGuidelines } from "../utils/project-context.ts";

const GitHubSyncArgsSchema = z.object({
  repo: z.string().optional(),
  include_closed: z.boolean().default(true),
});

/**
 * GitHub同期ハンドラー（修正版）
 */
export async function githubSyncHandler(args: any): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const { repo, include_closed } = GitHubSyncArgsSchema.parse(args);

    // プロジェクト設定を読み込み
    await loadProjectConfig();
    
    // リポジトリの正規化
    const fullRepoName = getFullRepoName(repo);

    let output = "";
    // GitHub CLI認証チェック
    const isAuthenticated = await GitHubClient.checkAuthentication();
    if (!isAuthenticated) {
      throw new Error("GitHub CLI is not authenticated. Please run 'gh auth login'");
    }

    // 1. GitHub → ファイル同期
    const issues = await GitHubClient.fetchIssues(fullRepoName, {
      state: include_closed ? "all" : "open",
      limit: 100
    });

    // Issue番号のリストを作成
    const issueNumbers = issues.map(issue => issue.number);
    
    // GitHub ProjectsからフィールドValueを取得
    let projectFieldsMap = new Map<number, { category?: string; priority?: string; section?: string }>();
    try {
      const projectsEnabled = await gitHubProjectsClient.checkProjectAccess();
      if (projectsEnabled) {
        projectFieldsMap = await gitHubProjectsClient.getProjectFieldsForIssues(fullRepoName, issueNumbers);
      }
    } catch (error) {
      console.warn('Failed to get project fields:', error);
    }

    // GitHub Issue をローカル形式に変換
    const localIssues = issues
      .filter(issue => {
        // CLOSEDの場合は、COMPLETEDのみを含める（DUPLICATE, NOT_PLANNEDは除外）
        if ('state' in issue && typeof issue.state === 'string' && 
            issue.state.toUpperCase() === 'CLOSED' && 
            'state_reason' in issue && 
            typeof issue.state_reason === 'string' && 
            issue.state_reason) {
          const reason = issue.state_reason.toUpperCase();
          return reason === 'COMPLETED';
        }
        // OPENの場合はすべて含める
        return true;
      })
      .map(issue => {
        const projectFields = projectFieldsMap.get(issue.number) || {};
        return {
          number: issue.number,
          title: issue.title,
          body: issue.body || "",
          state: issue.state.toUpperCase() as "OPEN" | "CLOSED",
          labels: issue.labels?.map(l => l.name) || [],
          repo: fullRepoName,
          createdAt: issue.created_at,
          updatedAt: issue.updated_at,
          closedAt: issue.closed_at || undefined,
          state_reason: (('state_reason' in issue) && typeof issue.state_reason === 'string') ? issue.state_reason as string : undefined,
          // GitHub Projectsフィールド
          category: projectFields.category,
          priority: projectFields.priority,
          section: projectFields.section
        };
      });

    // 2. 既存DRAFTを読み込み
    const drafts = await loadExistingDrafts(fullRepoName);
    if (drafts.length === 0) {
      await updateIssueListFile(localIssues, fullRepoName, []);
      return { content: [{ type: "text", text: "同期完了" }] };
    }

    // GitHub Projects連携前の基本チェック
    const issuesWithMissingFields = drafts.filter(draft => 
      !draft.category || !draft.priority
    ).length;
    
    if (issuesWithMissingFields > 0) {
      output += `⚠️  ${issuesWithMissingFields}件のIssueでGitHub Projectsフィールドが不足しています。\n`;
      output += "必要フィールド: category, priority\n\n";
    }


    // 3. DRAFT → GitHub登録
    const results: { success: boolean; draft: DraftIssue; result?: any; error?: string }[] = [];
    let projectsEnabled = false;
    try {
      projectsEnabled = await gitHubProjectsClient.checkProjectAccess();
    } catch {}

    for (const draft of drafts) {
      try {
        
        // ラベル取得
        const labelSource = draft.label || '-';
        const finalLabels = labelSource !== '-' ? labelSource.split(',').map((l: string) => l.trim()) : [];
        
        
        const enhancedBody = await generateEnhancedIssueBody(draft, fullRepoName, finalLabels);
        const result = await GitHubClient.createIssue(
          fullRepoName,
          draft.title,
          {
            body: enhancedBody,
            labels: finalLabels
          }
        );
        
        // GitHub API レスポンスのデバッグ情報
        if (projectsEnabled && result.html_url) {
          try {
            
            // DRAFT情報をProjects設定に渡す（デバッグ情報付き）
            const projectsFields: {
              category?: string;
              priority?: string;
              section?: string;
            } = {};
            
            if (draft.category) projectsFields.category = draft.category;
            if (draft.priority) projectsFields.priority = draft.priority;
            if (draft.section) projectsFields.section = draft.section;
            
            
            await gitHubProjectsClient.addIssueToProject(result.html_url, finalLabels, projectsFields);
          } catch (projectError) {
          }
        }
        results.push({ success: true, draft, result });
      } catch (error) {
        results.push({ success: false, draft, error: error instanceof Error ? error.message : String(error) });
      }
    }

    // 4. 再同期 + DRAFT削除
    const latestIssues = await GitHubClient.fetchIssues(fullRepoName, {
      state: include_closed ? "all" : "open",
      limit: 100
    });
    
    // 最新のIssue番号リストを作成
    const latestIssueNumbers = latestIssues.map(issue => issue.number);
    
    // GitHub ProjectsからフィールドValueを再取得
    let latestProjectFieldsMap = new Map<number, { category?: string; priority?: string; section?: string }>();
    try {
      if (projectsEnabled) {
        latestProjectFieldsMap = await gitHubProjectsClient.getProjectFieldsForIssues(fullRepoName, latestIssueNumbers);
      }
    } catch (error) {
      console.warn('Failed to get latest project fields:', error);
    }
    
    const latestLocalIssues = latestIssues
      .filter(issue => {
        // CLOSEDの場合は、COMPLETEDのみを含める（DUPLICATE, NOT_PLANNEDは除外）
        if ('state' in issue && typeof issue.state === 'string' && 
            issue.state.toUpperCase() === 'CLOSED' && 
            'state_reason' in issue && 
            typeof issue.state_reason === 'string' && 
            issue.state_reason) {
          const reason = issue.state_reason.toUpperCase();
          return reason === 'COMPLETED';
        }
        // OPENの場合はすべて含める
        return true;
      })
      .map(issue => {
        const projectFields = latestProjectFieldsMap.get(issue.number) || {};
        return {
          number: issue.number,
          title: issue.title,
          body: issue.body || "",
          state: issue.state.toUpperCase() as "OPEN" | "CLOSED",
          labels: issue.labels?.map(l => l.name) || [],
          repo: fullRepoName,
          createdAt: issue.created_at,
          updatedAt: issue.updated_at,
          closedAt: issue.closed_at || undefined,
          state_reason: (('state_reason' in issue) && typeof issue.state_reason === 'string') ? issue.state_reason as string : undefined,
          // GitHub Projectsフィールド
          category: projectFields.category,
          priority: projectFields.priority,
          section: projectFields.section
        };
      });
    const successfulDrafts = results.filter(r => r.success).map(r => r.draft);
    const remainingDrafts = drafts.filter(d => !successfulDrafts.includes(d));
    await updateIssueListFile(latestLocalIssues, fullRepoName, remainingDrafts);
    return { content: [{ type: "text", text: "同期完了" }] };

  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `❌ GitHub同期エラー: ${error instanceof Error ? error.message : String(error)}`
        }
      ]
    };
  }
}



export async function generateEnhancedIssueBody(draft: DraftIssue, _repoFullName: string, labels: string[]): Promise<string> {
  try {
    // タスクコンテキストを収集
    const taskContext = await collectTaskContext(draft, _repoFullName);
    
    // 用語統一チェックと自動修正
    let correctedTitle = draft.title;
    let correctedBody = draft.body || '';
    
    try {
      const fullText = `${draft.title}\n${draft.body || ''}`;
      const terminologyResult = await docsProvider.checkTerminologyConsistency(fullText);
      taskContext.terminologyCorrections = terminologyResult.suggestions;
      
      // 用語を自動修正
      if (taskContext.terminologyCorrections.length > 0) {
        for (const suggestion of taskContext.terminologyCorrections) {
          const escapedOriginal = suggestion.original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          correctedTitle = correctedTitle.replace(new RegExp(escapedOriginal, 'gi'), suggestion.suggested);
          if (correctedBody) {
            correctedBody = correctedBody.replace(new RegExp(escapedOriginal, 'gi'), suggestion.suggested);
          }
        }
      }
    } catch (error) {
      console.error('用語統一チェックエラー:', error);
    }
    
    // LLMベースの動的Issue本文生成
    return await generateContextAwareIssueBody({
      draft: { ...draft, title: correctedTitle, body: correctedBody },
      taskContext,
      labels,
      repoFullName: _repoFullName
    });
    
  } catch (error) {
    console.error('Issue本文生成エラー:', error);
    // フォールバック: 基本的なIssue本文を生成
    return generateFallbackIssueBody(draft, labels);
  }
}

/**
 * コンテキストを考慮したIssue本文を生成
 */
async function generateContextAwareIssueBody(params: {
  draft: DraftIssue;
  taskContext: any;
  labels: string[];
  repoFullName: string;
}): Promise<string> {
  const { draft, taskContext, repoFullName } = params;
  const repoType = repoFullName.split('/').pop()?.split('-').pop() || 'unknown';
  
  let body = '';
  
  // 概要セクション - プロジェクトコンテキストを反映
  body += `## 概要\n\n`;
  
  if (taskContext.repoTechSpec) {
    body += `${repoType}における${draft.title}の実装を行います。\n`;
    body += `本タスクは、プロジェクトの技術仕様書「${taskContext.repoTechSpec.title}」に基づいて実施します。\n\n`;
  } else {
    body += `${draft.title}の実装を行います。\n\n`;
  }
  
  if (draft.body) {
    body += `**要件詳細**:\n${draft.body}\n\n`;
  }
  
  // 技術要件セクション - 動的に抽出された技術スタック
  if (Object.keys(taskContext.techStack).length > 0) {
    body += `## 技術要件\n\n`;
    body += `**技術スタック**: ${formatTechStack(taskContext.techStack)}\n\n`;
    
    if (taskContext.repoTechSpec) {
      body += `詳細な技術仕様については[${taskContext.repoTechSpec.title}](${taskContext.repoTechSpec.path})を参照してください。\n\n`;
    }
  }
  
  // 実装方針セクション - 実装原則とコアルールを反映
  body += `## 実装方針\n\n`;
  
  const guidelineSections = formatGuidelines(taskContext.guidelines);
  if (guidelineSections.length > 0) {
    for (const section of guidelineSections) {
      body += `${section}\n\n`;
    }
  } else {
    body += `- プロジェクトの既存アーキテクチャとの整合性を保つ\n`;
    body += `- 保守性・再利用性・スケーラビリティを重視する\n\n`;
  }
  
  // 受け入れ条件セクション - タスクの性質に応じて動的生成
  body += `## 受け入れ条件\n\n`;
  
  // 基本的な受け入れ条件
  body += `- [ ] 実装内容が要件を満たしている\n`;
  body += `- [ ] コードレビューが完了している\n`;
  body += `- [ ] 関連ドキュメントが更新されている\n`;
  
  // 技術スタック固有の条件
  if (taskContext.techStack.language?.includes('TypeScript')) {
    body += `- [ ] TypeScript型チェックが通る\n`;
  }
  if (taskContext.techStack.testing) {
    body += `- [ ] テストが実装されている\n`;
  }
  if (taskContext.techStack.buildTool) {
    body += `- [ ] ビルドが成功する\n`;
  }
  
  body += '\n';
  
  // 関連ドキュメントセクション - 動的に特定された関連文書
  if (taskContext.relatedDocuments.length > 0) {
    body += `## 📚 関連ドキュメント\n\n`;
    body += `以下のドキュメントを参照してください：\n\n`;
    
    for (const doc of taskContext.relatedDocuments.slice(0, 5)) {
      body += `- [${doc.title}](${doc.path})\n`;
    }
    body += '\n';
  }
  
  // フッター情報
  body += `---\n🤖 AI-Generated Issue from DRAFT\n`;
  body += `📋 元要望: ${draft.title}\n`;
  
  if (taskContext.terminologyCorrections.length > 0) {
    body += `📝 用語統一: ${taskContext.terminologyCorrections.map((s: any) => `${s.original}→${s.suggested}`).join(', ')}\n`;
  }
  
  if (Object.keys(taskContext.techStack).length > 0) {
    body += `🔧 技術スタック: ${formatTechStack(taskContext.techStack)}\n`;
  }
  
  return body;
}

/**
 * フォールバック用の基本Issue本文生成
 */
function generateFallbackIssueBody(draft: DraftIssue, labels: string[]): string {
  let body = `## 概要\n\n${draft.title}\n\n`;
  
  if (draft.body) {
    body += `**詳細**:\n${draft.body}\n\n`;
  }
  
  body += `## 受け入れ条件\n\n`;
  body += `- [ ] 実装内容が要件を満たしている\n`;
  body += `- [ ] コードレビューが完了している\n\n`;
  
  if (labels.length > 0) {
    body += `**ラベル**: ${labels.join(', ')}\n\n`;
  }
  
  body += `---\n🤖 Basic Issue Generation (Fallback)\n`;
  
  return body;
}

