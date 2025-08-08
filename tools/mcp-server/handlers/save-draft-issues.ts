import { z } from "zod";
import { addDraftToFile } from "../utils/issue-file-manager.ts";
import type { DraftIssue } from "../types/issue.ts";
import { ProjectsCategorySchema, ProjectsPrioritySchema, ProjectsSectionSchema } from "../types/issue.ts";
import { loadProjectConfig, getFullRepoName } from "../utils/project-config-loader.ts";

const SaveDraftIssuesArgsSchema = z.object({
  repo: z.string(),
  issues: z.array(z.object({
    title: z.string(),
    body: z.string().optional(),
    label: z.string().optional(),
    category: ProjectsCategorySchema.optional(),
    priority: ProjectsPrioritySchema.optional(),
    section: ProjectsSectionSchema.optional()
  }))
});

/**
 * DRAFT Issue保存ハンドラー
 */
export async function saveDraftIssuesHandler(args: any): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const { repo, issues } = SaveDraftIssuesArgsSchema.parse(args);

    let output = "💾 DRAFT Issue保存処理を開始\n\n";
    output += `📝 対象リポジトリ: ${repo}\n`;
    output += `📊 保存対象: ${issues.length}件のIssue\n\n`;

    // プロジェクト設定を読み込み
    await loadProjectConfig();
    
    // リポジトリ名の正規化
    const fullRepoName = getFullRepoName(repo);

    // DraftIssue形式に変換（新7フィールド形式対応）
    const draftIssues: DraftIssue[] = issues.map(issue => ({
      title: issue.title,
      body: issue.body,
      label: issue.label || '',
      category: issue.category,
      priority: issue.priority,
      section: issue.section,
      state: "DRAFT" as const,
      repo: fullRepoName
    }));

    // 保存処理
    const saved = await addDraftToFile(fullRepoName, draftIssues);
    
    if (saved) {
      output += `✅ ${draftIssues.length}件のDRAFT Issueを保存しました\n\n`;
      
      // 保存されたIssueの一覧表示（新7フィールド形式）
      output += "📋 保存されたIssue一覧:\n";
      draftIssues.forEach((issue, index) => {
        output += `${index + 1}. **${issue.title}**\n`;
        output += `   - Label: ${issue.label || '未設定'}\n`;
        output += `   - Category: ${issue.category || '未設定'}\n`;
        output += `   - Priority: ${issue.priority || '未設定'}\n`;
        output += `   - Section: ${issue.section || '未設定'}\n`;
        output += `   - Status: DRAFT\n\n`;
      });
      
      output += "⚠️  **次の手順**:\n";
      output += "1. 保存されたDRAFT Issueを確認してください\n";
      output += "2. 内容に問題がなければ、以下のコマンドでGitHubに同期:\n";
      output += `   \`sync_with_github repo="${repo}"\`\n\n`;
      
      output += "⚠️  **注意事項**:\n";
      output += "- GitHub同期により、DRAFT IssueがGitHub上の実際のIssueになります\n";
      output += "- 同期前に必ず内容を確認してください\n";
      output += "- 同期後は削除・修正が困難になります\n";
    } else {
      output += `❌ DRAFT Issue保存に失敗しました\n\n`;
      output += "**可能な原因**:\n";
      output += "- Issue管理ファイルが見つからない\n";
      output += "- ファイル書き込み権限がない\n";
      output += "- ディスク容量不足\n";
    }

    return {
      content: [{ type: "text", text: output }]
    };

  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `❌ DRAFT Issue保存エラー: ${error instanceof Error ? error.message : String(error)}`
        }
      ]
    };
  }
}