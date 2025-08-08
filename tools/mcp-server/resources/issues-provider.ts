import { join } from "@std/path";
import { readTextFileSafe, getFilesRecursively, resolveProjectPath } from "../utils/file-operations.ts";
import { McpResource } from "../types/mcp.ts";
import { getProjectConfigValue } from "../utils/project-config-loader.ts";

/**
 * Issue（_llm-memories/issues）リソースプロバイダー
 */
export class IssuesProvider {
  private issuesDir: string;

  constructor() {
    const issuesPath = getProjectConfigValue<string>('directories.issues', '_llm-memories/issues');
    this.issuesDir = resolveProjectPath(issuesPath);
  }

  /**
   * 利用可能なIssueリソースをリストアップ
   */
  async listResources(): Promise<McpResource[]> {
    const resources: McpResource[] = [];

    try {
      const issueFiles = await getFilesRecursively(this.issuesDir, '.md');

      for (const filePath of issueFiles) {
        const relativePath = filePath.replace(this.issuesDir + '/', '');
        const uri = `file://_llm-memories/issues/${relativePath}`;
        
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

      // 特別なリソース：Issueサマリー
      resources.push({
        uri: "file://_llm-memories/issues/summary",
        name: "Issueサマリー",
        description: "全リポジトリのIssue統計と概要",
        mimeType: "text/plain"
      });

    } catch (error) {
      console.error('Error listing issues resources:', error);
    }

    return resources;
  }

  /**
   * 指定されたリソースを読み込む
   */
  async readResource(uri: string): Promise<{ contents: Array<{ type: string; text: string }> }> {
    try {
      // 特別なサマリーリソース
      if (uri === "file://_llm-memories/issues/summary") {
        const summary = await this.generateIssueSummary();
        return {
          contents: [
            {
              type: "text",
              text: summary
            }
          ]
        };
      }

      // URIからファイルパスを抽出
      const filePath = uri.replace('file://_llm-memories/issues/', '');
      const fullPath = join(this.issuesDir, filePath);

      const content = await readTextFileSafe(fullPath);
      
      if (!content) {
        throw new Error(`Issue file not found: ${filePath}`);
      }

      // Issueファイルの解析
      const issueStats = this.parseIssueFile(content);
      const fileInfo = await this.getFileInfo(fullPath);
      
      // ヘッダーを構築
      let header = `# ${filePath}\n\n`;
      header += `**リポジトリ**: ${this.extractRepoFromPath(filePath)}\n`;
      header += `**最終更新**: ${fileInfo.lastModified}\n`;
      header += `**ファイルサイズ**: ${fileInfo.size}\n\n`;
      
      // Issue統計
      header += `## Issue統計\n`;
      header += `- **OPEN**: ${issueStats.open}件\n`;
      header += `- **CLOSED**: ${issueStats.closed}件\n`;
      header += `- **DRAFT**: ${issueStats.draft}件\n`;
      header += `- **合計**: ${issueStats.total}件\n\n`;
      
      if (issueStats.draft > 0) {
        header += `⚠️ DRAFT Issuesがあります。sync_with_githubツールで同期を実行してください。\n\n`;
      }
      
      header += `---\n\n`;

      return {
        contents: [
          {
            type: "text",
            text: header + content
          }
        ]
      };

    } catch (error) {
      throw new Error(`Failed to read issue resource: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 全Issueファイルのサマリーを生成
   */
  private async generateIssueSummary(): Promise<string> {
    let summary = "# Issue管理サマリー\n\n";
    summary += `**生成日時**: ${new Date().toISOString().split('T')[0]}\n\n`;
    
    try {
      const issueFiles = await getFilesRecursively(this.issuesDir, '.md');
      
      let totalOpen = 0;
      let totalClosed = 0;
      let totalDraft = 0;
      
      summary += "## リポジトリ別統計\n\n";
      
      for (const filePath of issueFiles) {
        const content = await readTextFileSafe(filePath);
        if (!content) continue;
        
        const fileName = filePath.split('/').pop() || '';
        const repoName = this.extractRepoFromPath(fileName);
        const stats = this.parseIssueFile(content);
        
        summary += `### ${repoName}\n`;
        summary += `- OPEN: ${stats.open}件\n`;
        summary += `- CLOSED: ${stats.closed}件\n`;
        summary += `- DRAFT: ${stats.draft}件\n`;
        summary += `- 合計: ${stats.total}件\n\n`;
        
        totalOpen += stats.open;
        totalClosed += stats.closed;
        totalDraft += stats.draft;
      }
      
      summary += "## 全体統計\n\n";
      summary += `- **総OPEN**: ${totalOpen}件\n`;
      summary += `- **総CLOSED**: ${totalClosed}件\n`;
      summary += `- **総DRAFT**: ${totalDraft}件\n`;
      summary += `- **総計**: ${totalOpen + totalClosed + totalDraft}件\n\n`;
      
      if (totalDraft > 0) {
        summary += `⚠️ **${totalDraft}件のDRAFT Issuesがあります**\n`;
        summary += "sync_with_githubツールで同期を実行してください。\n\n";
      }
      
      summary += "## 利用可能なツール\n\n";
      summary += "- `generate_issue_drafts`: 要件からIssue候補を生成\n";
      summary += "- `sync_with_github`: GitHubとの同期実行\n";
      summary += "- `load_rules`: プロジェクトルール読み込み\n";
      
    } catch (error) {
      summary += `エラー: ${error instanceof Error ? error.message : String(error)}\n`;
    }
    
    return summary;
  }

  /**
   * Issueファイルの内容を解析して統計を取得
   */
  private parseIssueFile(content: string): { open: number; closed: number; draft: number; total: number } {
    const lines = content.split('\n');
    let open = 0;
    let closed = 0;
    let draft = 0;
    
    for (const line of lines) {
      if (line.includes('| OPEN |')) {
        open++;
      } else if (line.includes('| CLOSED |')) {
        closed++;
      } else if (line.includes('| DRAFT |')) {
        draft++;
      }
    }
    
    return {
      open,
      closed,
      draft,
      total: open + closed + draft
    };
  }

  /**
   * ファイルパスに基づいて説明を生成
   */
  private generateDescription(_relativePath: string, fileName: string): string {
    const repoName = this.extractRepoFromPath(fileName);
    return `${repoName}リポジトリのIssue管理`;
  }

  /**
   * ファイルパスからリポジトリ名を抽出
   */
  private extractRepoFromPath(fileName: string): string {
    const key = fileName.replace('.md', '');
    const repositories = getProjectConfigValue<Record<string, string>>('repositories', {});
    return repositories[key] || key;
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
}

// シングルトンインスタンス（遅延初期化）
let _issuesProvider: IssuesProvider | null = null;

export function getIssuesProvider(): IssuesProvider {
  if (!_issuesProvider) {
    _issuesProvider = new IssuesProvider();
  }
  return _issuesProvider;
}

// 後方互換性のため
export const issuesProvider = {
  listResources: () => getIssuesProvider().listResources(),
  readResource: (uri: string) => getIssuesProvider().readResource(uri)
};