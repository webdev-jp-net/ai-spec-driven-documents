import { gitHubProjectsClient } from "../utils/github-projects.ts";
import { z } from "zod";

const ProjectsManageArgsSchema = z.object({
  action: z.enum(["add_issue", "check_access", "list_config"]),
  issue_url: z.string().optional(),
  repo: z.string().optional(),
  labels: z.string().optional(),
});

export async function githubProjectsManagerHandler(args: any): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const { action, issue_url, repo, labels } = ProjectsManageArgsSchema.parse(args);

    let output = `🔗 GitHub Projects管理: ${action}\n\n`;

    switch (action) {
      case "check_access":
        output += await handleCheckAccess();
        break;
        
      case "add_issue":
        if (!issue_url || !repo) {
          throw new Error("add_issue requires issue_url and repo parameters");
        }
        output += await handleAddIssue(issue_url, repo, labels || "");
        break;
        
      case "list_config":
        output += await handleListConfig();
        break;
        
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return {
      content: [{ type: "text", text: output }]
    };

  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `❌ GitHub Projects管理エラー: ${error instanceof Error ? error.message : String(error)}`
        }
      ]
    };
  }
}

async function handleCheckAccess(): Promise<string> {
  let output = "🔍 プロジェクトアクセス確認中...\n\n";

  try {
    const hasAccess = await gitHubProjectsClient.checkProjectAccess();
    
    if (hasAccess) {
      output += "✅ プロジェクトアクセス成功\n";
      output += "GitHub Projects連携が正常に動作します\n\n";
      
      // プロジェクト情報を表示
      try {
        const config = new (await import("../utils/github-projects.ts")).GitHubProjectsConfig();
        await config.loadConfig();
        const project = await config.getMainProject();
        
        if (project) {
          output += "📋 プロジェクト情報:\n";
          output += `- プロジェクト番号: #${project.number}\n`;
          output += `- オーナー: ${project.owner}\n`;
          output += `- プロジェクト名: ${project.name}\n`;
          if (project.description) {
            output += `- 説明: ${project.description}\n`;
          }
        } else {
          output += "ℹ️  GitHub Projects連携は無効です（projectNumber未設定）\n";
        }
      } catch (configError) {
        output += "⚠️  プロジェクト設定の読み込みに失敗しました\n";
      }
      
    } else {
      output += "❌ プロジェクトアクセス失敗\n";
      output += "考えられる原因:\n";
      output += "- GitHub CLI の認証が不十分 (gh auth refresh -s project)\n";
      output += "- プロジェクト設定が間違っている\n";
      output += "- プロジェクトへのアクセス権限がない\n";
    }
    
  } catch (error) {
    output += `❌ アクセス確認エラー: ${error instanceof Error ? error.message : String(error)}\n`;
  }

  return output;
}

/**
 * IssueをプロジェクトIn追加
 */
async function handleAddIssue(issueUrl: string, repo: string, labels: string): Promise<string> {
  let output = `📝 Issue をプロジェクトに追加中...\n`;
  output += `🔗 Issue URL: ${issueUrl}\n`;
  output += `📁 リポジトリ: ${repo}\n`;
  output += `🏷️  ラベル: ${labels || "なし"}\n\n`;

  try {
    const labelArray = labels ? labels.split(',').map(l => l.trim()) : [];
    const itemId = await gitHubProjectsClient.addIssueToProject(issueUrl, labelArray);
    
    output += `✅ プロジェクト追加成功\n`;
    output += `📋 プロジェクトアイテムID: ${itemId}\n\n`;
    
    // 設定されたフィールドを表示
    output += "🎯 自動設定されたフィールド:\n";
    
    // ラベルマッピングを表示
    try {
      const config = new (await import("../utils/github-projects.ts")).GitHubProjectsConfig();
      const labelMapping = await config.mapLabelsToFields(labelArray);
      
      output += "- Status: Backlog (デフォルト)\n";
      
      for (const [field, value] of Object.entries(labelMapping)) {
        if (field !== 'section') {
          output += `- ${field}: ${value}\n`;
        }
      }
      
      if (Object.keys(labelMapping).length === 0) {
        output += "- デフォルト値のみ設定\n";
      }
      
    } catch (configError) {
      output += "- フィールド情報の取得に失敗\n";
    }
    
  } catch (error) {
    output += `❌ プロジェクト追加失敗: ${error instanceof Error ? error.message : String(error)}\n`;
  }

  return output;
}

/**
 * プロジェクト設定表示
 */
async function handleListConfig(): Promise<string> {
  let output = "⚙️  プロジェクト設定情報:\n\n";

  try {
    const config = new (await import("../utils/github-projects.ts")).GitHubProjectsConfig();
    await config.loadConfig();
    
    // プロジェクト情報
    const project = await config.getMainProject();
    output += "📋 メインプロジェクト:\n";
    output += `- 番号: #${project.number}\n`;
    output += `- オーナー: ${project.owner}\n`;
    output += `- 名前: ${project.name}\n`;
    if (project.description) {
      output += `- 説明: ${project.description}\n`;
    }
    output += "\n";
    
    // フィールド設定
    const fields = await config.getFields();
    output += "🎯 プロジェクトフィールド:\n";
    for (const [fieldName, fieldConfig] of Object.entries(fields)) {
      output += `- ${fieldName} (${fieldConfig.type})\n`;
      if (fieldConfig.options) {
        output += `  オプション: ${fieldConfig.options.join(', ')}\n`;
      }
    }
    output += "\n";
    
    // ラベルマッピングのサンプル
    output += "🏷️  ラベルマッピング例:\n";
    const sampleLabels = ["type:feature", "priority:high", "tech:frontend"];
    const mapping = await config.mapLabelsToFields(sampleLabels);
    for (const [field, value] of Object.entries(mapping)) {
      output += `- ${field}: ${value}\n`;
    }
    
  } catch (error) {
    output += `❌ 設定読み込みエラー: ${error instanceof Error ? error.message : String(error)}\n`;
  }

  return output;
}