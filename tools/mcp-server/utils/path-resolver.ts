import { exists } from "@std/fs";
import { join, resolve } from "@std/path";
import { loadProjectConfig, getProjectConfigValue } from "./project-config-loader.ts";

export interface PathResolverOptions {
  baseDir?: string;
  autoPrefix?: boolean;
}

export class PathResolver {
  private baseDir: string;
  private isDocumentRepo: boolean;
  private autoPrefix: boolean;
  private envPrefix: string = "PROJECT";
  private documentRepoName: string = "document";

  constructor(options: PathResolverOptions = {}) {
    this.baseDir = options.baseDir || Deno.cwd();
    this.autoPrefix = options.autoPrefix ?? true;
    this.isDocumentRepo = true; // デフォルトは現在のリポジトリがドキュメントリポジトリ
    this.initializeConfig();
  }

  private async initializeConfig() {
    try {
      await loadProjectConfig();
      this.envPrefix = 'PROJECT';
      const documentRepository = getProjectConfigValue<string>('documentRepository');
      
      // documentRepositoryが未設定の場合は現在のリポジトリ名を取得
      if (!documentRepository) {
        const currentRepoName = await this.detectCurrentRepoName();
        this.documentRepoName = currentRepoName || 'document';
        // 自己参照の場合は常にドキュメントリポジトリ
        this.isDocumentRepo = true;
      } else {
        this.documentRepoName = documentRepository;
        this.isDocumentRepo = this.detectDocumentRepo();
      }
    } catch {
      // 設定ファイルが読めない場合は、現在のリポジトリがドキュメントリポジトリと仮定
      this.isDocumentRepo = true;
      this.documentRepoName = 'document'; // フォールバック
    }
  }

  private detectDocumentRepo(): boolean {
    // 環境変数での明示的な指定を優先
    if (Deno.env.get(`${this.envPrefix}_REPO_TYPE`) === "document") {
      return true;
    }

    // パスベースの判定（フォールバック）
    return this.baseDir.includes(this.documentRepoName);
  }

  /**
   * プロジェクトルートディレクトリを取得
   */
  private getProjectRoot(): string {
    // MCPサーバーディレクトリから3階層上がプロジェクトルート
    if (this.baseDir.includes('tools/mcp-server')) {
      return resolve(this.baseDir, '../../../');
    }
    return this.baseDir;
  }

  /**
   * 相対パスを解決（同期版）
   */
  resolve(relativePath: string): string {
    // 自動プレフィックス処理
    if (this.autoPrefix && this.shouldAddPrefix(relativePath)) {
      relativePath = join("_document", relativePath);
    }

    return resolve(this.getProjectRoot(), relativePath);
  }

  /**
   * 相対パスを解決（非同期版 - より正確なリポジトリ判定）
   */
  async resolveAsync(relativePath: string): Promise<string> {
    // 非同期版では正確なリポジトリ判定を行う
    if (!this.isDocumentRepo) {
      this.isDocumentRepo = await this.detectDocumentRepoAsync();
    }

    return this.resolve(relativePath);
  }

  /**
   * プレフィックスを追加すべきか判定
   */
  private shouldAddPrefix(path: string): boolean {
    return !this.isDocumentRepo && path.startsWith("_llm-");
  }

  /**
   * 現在のリポジトリ名を取得
   */
  private async detectCurrentRepoName(): Promise<string | null> {
    try {
      const process = new Deno.Command("git", {
        args: ["remote", "get-url", "origin"],
        stdout: "piped",
        stderr: "piped",
      });
      const { stdout } = await process.output();
      const remoteUrl = new TextDecoder().decode(stdout).trim();
      
      // URLからリポジトリ名を抽出
      // 例: git@github.com:org/repo-name.git → repo-name
      // 例: https://github.com/org/repo-name.git → repo-name
      const match = remoteUrl.match(/\/([^\/]+?)(?:\.git)?$/);
      if (match) {
        return match[1];
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * 非同期でのリポジトリ判定（より正確）
   */
  private async detectDocumentRepoAsync(): Promise<boolean> {
    try {
      const process = new Deno.Command("git", {
        args: ["remote", "get-url", "origin"],
        stdout: "piped",
        stderr: "piped",
      });
      const { stdout } = await process.output();
      const remoteUrl = new TextDecoder().decode(stdout).trim();
      return remoteUrl.includes(this.documentRepoName);
    } catch {
      return this.detectDocumentRepo(); // フォールバック
    }
  }

  /**
   * パスが存在するか確認
   */
  async exists(relativePath: string): Promise<boolean> {
    const fullPath = await this.resolveAsync(relativePath);
    return await exists(fullPath);
  }
}

// シングルトンインスタンス
export const pathResolver = new PathResolver();

// 後方互換性のための関数
export function resolveProjectPath(relativePath: string): string {
  return pathResolver.resolve(relativePath);
}

export async function resolveProjectPathAsync(relativePath: string): Promise<string> {
  return pathResolver.resolveAsync(relativePath);
}