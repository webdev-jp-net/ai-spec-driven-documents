import { exists } from "@std/fs";
import { ensureDir } from "@std/fs";
import { join, dirname } from "@std/path";
import { pathResolver } from "./path-resolver.ts";

/**
 * ファイルを安全に読み込む
 */
export async function readTextFileSafe(filePath: string): Promise<string | null> {
  try {
    if (await exists(filePath)) {
      return await Deno.readTextFile(filePath);
    }
    return null;
  } catch (error) {
    console.error(`Failed to read file ${filePath}:`, error);
    return null;
  }
}

/**
 * ファイルを安全に書き込む
 */
export async function writeTextFileSafe(filePath: string, content: string): Promise<boolean> {
  try {
    // ディレクトリが存在しない場合は作成
    await ensureDir(dirname(filePath));
    
    await Deno.writeTextFile(filePath, content);
    return true;
  } catch (error) {
    console.error(`Failed to write file ${filePath}:`, error);
    return false;
  }
}

/**
 * ディレクトリ内のファイルを再帰的に取得
 */
export async function getFilesRecursively(
  dirPath: string,
  extension?: string
): Promise<string[]> {
  const files: string[] = [];
  
  try {
    for await (const entry of Deno.readDir(dirPath)) {
      const fullPath = join(dirPath, entry.name);
      
      if (entry.isDirectory) {
        const subFiles = await getFilesRecursively(fullPath, extension);
        files.push(...subFiles);
      } else if (entry.isFile) {
        if (!extension || entry.name.endsWith(extension)) {
          files.push(fullPath);
        }
      }
    }
  } catch (error) {
    console.error(`Failed to read directory ${dirPath}:`, error);
  }
  
  return files;
}

/**
 * マークダウンファイルの先頭メタデータを解析
 */
export function parseMarkdownMetadata(content: string): {
  metadata: Record<string, any>;
  body: string;
} {
  const lines = content.split('\n');
  
  // YAMLフロントマターのチェック
  if (lines[0]?.trim() === '---') {
    const endIndex = lines.findIndex((line, index) => 
      index > 0 && line.trim() === '---'
    );
    
    if (endIndex !== -1) {
      const metadataLines = lines.slice(1, endIndex);
      const body = lines.slice(endIndex + 1).join('\n');
      
      // 簡易的なYAMLパース
      const metadata: Record<string, any> = {};
      for (const line of metadataLines) {
        const colonIndex = line.indexOf(':');
        if (colonIndex !== -1) {
          const key = line.slice(0, colonIndex).trim();
          const value = line.slice(colonIndex + 1).trim();
          
          // 配列の簡易パース
          if (value.startsWith('[') && value.endsWith(']')) {
            metadata[key] = value.slice(1, -1).split(',').map(v => v.trim());
          } else if (value === 'true') {
            metadata[key] = true;
          } else if (value === 'false') {
            metadata[key] = false;
          } else {
            metadata[key] = value;
          }
        }
      }
      
      return { metadata, body };
    }
  }
  
  return { metadata: {}, body: content };
}

/**
 * 現在のリポジトリを判定
 */
export async function getCurrentRepository(): Promise<string | null> {
  try {
    const process = new Deno.Command("git", {
      args: ["remote", "get-url", "origin"],
      stdout: "piped",
      stderr: "piped",
    });
    const { stdout } = await process.output();
    const remoteUrl = new TextDecoder().decode(stdout).trim();
    
    // リポジトリ名を抽出
    const match = remoteUrl.match(/\/([^/]+)\.git$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * 相対パスから絶対パスに変換（非同期版）
 * documentリポジトリ以外では_llm-*パスに_document/プレフィックスを追加
 */
export async function resolveProjectPathAsync(relativePath: string): Promise<string> {
  const currentDir = Deno.cwd();
  
  // 現在のリポジトリを判定
  const repoName = await getCurrentRepository();
  // プロジェクト設定からドキュメントリポジトリ名を取得
  let isDocumentRepo = true; // デフォルトは現在のリポジトリがドキュメントリポジトリ
  try {
    const { getProjectConfigValue } = await import("./project-config-loader.ts");
    const documentRepoName = getProjectConfigValue<string>('documentRepository');
    if (documentRepoName && repoName) {
      isDocumentRepo = repoName === documentRepoName;
    }
  } catch {
    // 設定が読み込めない場合は、現在のリポジトリがドキュメントリポジトリと仮定
    isDocumentRepo = true;
  }
  
  // _llm-で始まるパスかどうかを判定
  const isLlmPath = relativePath.startsWith("_llm-");
  
  // documentリポジトリ以外で_llm-パスの場合、_document/を追加
  if (!isDocumentRepo && isLlmPath) {
    relativePath = join("_document", relativePath);
  }
  
  // MCPサーバーの親ディレクトリをプロジェクトルートとする
  const projectRoot = currentDir.includes('tools/mcp-server') 
    ? join(currentDir, '../../') 
    : currentDir;
    
  return join(projectRoot, relativePath);
}

/**
 * 相対パスから絶対パスに変換（同期版）
 * 後方互換性のための関数
 */
export function resolveProjectPath(relativePath: string): string {
  // 同期版では設定を読み込めないため、pathResolverインスタンスを使用
  return pathResolver.resolve(relativePath);
}

/**
 * ファイルサイズを人間が読みやすい形式に変換
 */
export function formatFileSize(bytes: number): string {
  const sizes = ['B', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 B';
  
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * ファイルの最終更新日時を取得
 */
export async function getFileModificationTime(filePath: string): Promise<Date | null> {
  try {
    const stat = await Deno.stat(filePath);
    return stat.mtime;
  } catch (error) {
    console.error(`Failed to get file modification time for ${filePath}:`, error);
    return null;
  }
}