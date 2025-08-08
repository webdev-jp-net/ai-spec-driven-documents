import { join } from "@std/path";
import { readTextFileSafe, getFilesRecursively, resolveProjectPath, parseMarkdownMetadata } from "../utils/file-operations.ts";
import { McpResource } from "../types/mcp.ts";
import { getProjectConfigValue } from "../utils/project-config-loader.ts";

/**
 * ルール（_llm-rules）リソースプロバイダー
 */
export class RulesProvider {
  private rulesDir: string;

  constructor() {
    const rulesPath = getProjectConfigValue<string>('directories.rules', '_llm-rules');
    this.rulesDir = resolveProjectPath(rulesPath);
  }

  /**
   * 利用可能なルールリソースをリストアップ
   */
  async listResources(): Promise<McpResource[]> {
    const resources: McpResource[] = [];

    try {
      const ruleFiles = await getFilesRecursively(this.rulesDir, '.md');

      for (const filePath of ruleFiles) {
        const relativePath = filePath.replace(this.rulesDir + '/', '');
        const uri = `file://_llm-rules/${relativePath}`;
        
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

      // 特別なリソース：セッション制御
      resources.push({
        uri: "file://_llm-rules/session_control.md",
        name: "セッション制御",
        description: "Claude Code セッション制御とルール適用の基点",
        mimeType: "text/markdown"
      });

      // 特別なリソース：コアルール
      resources.push({
        uri: "file://_llm-rules/core_rules.md", 
        name: "コアルール",
        description: "プロジェクト全体の基本ルール",
        mimeType: "text/markdown"
      });

    } catch (error) {
      console.error('Error listing rules resources:', error);
    }

    return resources;
  }

  /**
   * 指定されたリソースを読み込む
   */
  async readResource(uri: string): Promise<{ contents: Array<{ type: string; text: string }> }> {
    try {
      // URIからファイルパスを抽出
      const filePath = uri.replace('file://_llm-rules/', '');
      const fullPath = join(this.rulesDir, filePath);

      const content = await readTextFileSafe(fullPath);
      
      if (!content) {
        throw new Error(`Rule file not found: ${filePath}`);
      }

      // メタデータを解析
      const { metadata, body } = parseMarkdownMetadata(content);
      const fileInfo = await this.getFileInfo(fullPath);
      
      // ヘッダーを構築
      let header = `# ${filePath}\n\n`;
      
      if (metadata.description) {
        header += `**説明**: ${metadata.description}\n`;
      }
      
      if (metadata.alwaysApply) {
        header += `**常時適用**: はい\n`;
      }
      
      if (metadata.version) {
        header += `**バージョン**: ${metadata.version}\n`;
      }
      
      header += `**最終更新**: ${fileInfo.lastModified}\n`;
      header += `**サイズ**: ${fileInfo.size}\n\n`;
      header += `---\n\n`;

      return {
        contents: [
          {
            type: "text",
            text: header + body
          }
        ]
      };

    } catch (error) {
      throw new Error(`Failed to read rule resource: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * ファイルパスに基づいて説明を生成
   */
  private generateDescription(_relativePath: string, fileName: string): string {
    // ファイル名から推測
    if (fileName.includes('session_control')) {
      return 'Claude Code セッション制御の基点ルール';
    } else if (fileName.includes('core_rules')) {
      return 'プロジェクト全体の基本ルール';
    } else if (fileName.includes('naming')) {
      return 'ネーミング規約とコーディングルール';
    } else if (fileName.includes('github')) {
      return 'GitHub統合とワークフロールール';
    } else if (fileName.includes('security')) {
      return 'セキュリティ関連ルール';
    } else if (fileName.includes('performance')) {
      return 'パフォーマンス最適化ルール';
    } else if (fileName.includes('testing')) {
      return 'テスト戦略とルール';
    } else if (fileName.includes('review')) {
      return 'コードレビューガイドライン';
    } else if (fileName.includes('deployment')) {
      return 'デプロイメントルール';
    }

    return `プロジェクトルール: ${fileName}`;
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
let _rulesProvider: RulesProvider | null = null;

export function getRulesProvider(): RulesProvider {
  if (!_rulesProvider) {
    _rulesProvider = new RulesProvider();
  }
  return _rulesProvider;
}

// 後方互換性のため
export const rulesProvider = {
  listResources: () => getRulesProvider().listResources(),
  readResource: (uri: string) => getRulesProvider().readResource(uri)
};