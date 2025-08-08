import { z } from "zod";

// GitHub API レスポンス型
const GitHubIssueSchema = z.object({
  number: z.number(),
  title: z.string(),
  body: z.string().nullable(),
  state: z.enum(["open", "closed"]),
  labels: z.array(z.object({
    name: z.string(),
    color: z.string(),
  })),
  created_at: z.string(),
  updated_at: z.string(),
  closed_at: z.string().nullable(),
  html_url: z.string(),
  state_reason: z.string().optional(),
});
type GitHubIssue = z.infer<typeof GitHubIssueSchema>;

/**
 * GitHub CLI の実行結果を解析
 */
export class GitHubClient {
  /**
   * 現在のリポジトリ名を取得
   */
  static async getCurrentRepo(): Promise<string> {
    try {
      const command = new Deno.Command("gh", {
        args: ["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"],
        stdout: "piped",
        stderr: "piped",
      });
      
      const { code, stdout } = await command.output();
      
      if (code !== 0) {
        throw new Error("Failed to get current repository");
      }
      
      return new TextDecoder().decode(stdout).trim();
    } catch (error) {
      console.error("Error getting current repo:", error);
      throw error;
    }
  }

  /**
   * GitHub CLI が認証されているかチェック
   */
  static async checkAuthentication(): Promise<boolean> {
    try {
      const command = new Deno.Command("gh", {
        args: ["auth", "status"],
        stdout: "piped",
        stderr: "piped",
      });
      
      const { code } = await command.output();
      return code === 0;
    } catch (error) {
      console.error("GitHub CLI authentication check failed:", error);
      return false;
    }
  }

  /**
   * 指定されたリポジトリのIssueを取得
   */
  static async fetchIssues(
    repo: string,
    options: {
      state?: "open" | "closed" | "all";
      limit?: number;
    } = {}
  ): Promise<GitHubIssue[]> {
    const { state = "all", limit = 100 } = options;
    
    try {
      const args = [
        "issue", "list",
        "--repo", repo,
        "--limit", limit.toString(),
        "--state", state,
        "--json", "number,title,body,state,labels,createdAt,updatedAt,closedAt,url,stateReason"
      ];
      
      const command = new Deno.Command("gh", {
        args,
        stdout: "piped",
        stderr: "piped",
      });
      
      const { code, stdout, stderr } = await command.output();
      
      if (code !== 0) {
        const errorMsg = new TextDecoder().decode(stderr);
        throw new Error(`GitHub CLI error: ${errorMsg}`);
      }
      
      const output = new TextDecoder().decode(stdout);
      const issues = JSON.parse(output);
      
      return issues.map((issue: any) => ({
        ...issue,
        created_at: issue.createdAt,
        updated_at: issue.updatedAt,
        closed_at: issue.closedAt,
        html_url: issue.url,
        state_reason: issue.stateReason,
      }));
    } catch (error) {
      console.error(`Error fetching issues for ${repo}:`, error);
      throw error;
    }
  }

  /**
   * 新しいIssueを作成
   */
  static async createIssue(
    repo: string,
    title: string,
    options: {
      body?: string;
      labels?: string[];
      assignees?: string[];
    } = {}
  ): Promise<{ number: number; url: string; html_url: string }> {
    const { body = "", labels = [], assignees = [] } = options;
    
    try {
      const args = [
        "issue", "create",
        "--repo", repo,
        "--title", title,
        "--body", body
      ];
      
      // ラベルがある場合は追加
      if (labels.length > 0) {
        args.push("--label", labels.join(","));
      }
      
      // アサインがある場合は追加
      if (assignees.length > 0) {
        args.push("--assignee", assignees.join(","));
      }
      
      const command = new Deno.Command("gh", {
        args,
        stdout: "piped",
        stderr: "piped",
      });
      
      const { code, stdout, stderr } = await command.output();
      
      if (code !== 0) {
        const errorMsg = new TextDecoder().decode(stderr);
        throw new Error(`Failed to create issue: ${errorMsg}`);
      }
      
      const output = new TextDecoder().decode(stdout);
      
      // URLから番号を抽出
      const match = output.match(/https:\/\/github\.com\/[^\/]+\/[^\/]+\/issues\/(\d+)/);
      const number = match ? parseInt(match[1]) : 0;
      
      return {
        number,
        url: output.trim(),
        html_url: output.trim()
      };
    } catch (error) {
      console.error(`Error creating issue in ${repo}:`, error);
      throw error;
    }
  }

  /**
   * リポジトリの情報を取得
   */
  static async getRepoInfo(repo: string): Promise<{
    name: string;
    description: string;
    private: boolean;
    default_branch: string;
  }> {
    try {
      const command = new Deno.Command("gh", {
        args: [
          "repo", "view", repo,
          "--json", "name,description,isPrivate,defaultBranch"
        ],
        stdout: "piped",
        stderr: "piped",
      });
      
      const { code, stdout, stderr } = await command.output();
      
      if (code !== 0) {
        const errorMsg = new TextDecoder().decode(stderr);
        throw new Error(`Failed to get repo info: ${errorMsg}`);
      }
      
      const output = new TextDecoder().decode(stdout);
      const repoInfo = JSON.parse(output);
      
      return {
        name: repoInfo.name,
        description: repoInfo.description || "",
        private: repoInfo.isPrivate,
        default_branch: repoInfo.defaultBranch,
      };
    } catch (error) {
      console.error(`Error getting repo info for ${repo}:`, error);
      throw error;
    }
  }
}