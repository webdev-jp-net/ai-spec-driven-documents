import { z } from "zod";
import { readTextFileSafe, getFilesRecursively, resolveProjectPath } from "../utils/file-operations.ts";

// スキーマ定義
const DocumentSearchArgsSchema = z.object({
  query: z.string(),
  directories: z.array(z.enum(["_llm-rules", "_llm-memories", "_llm-docs"])).optional(),
  useRegex: z.boolean().default(false),
  maxResults: z.number().default(10),
  includeContext: z.boolean().default(true),
  contextLines: z.number().default(3)
});

const DocumentReadArgsSchema = z.object({
  path: z.string(),
  startLine: z.number().optional(),
  endLine: z.number().optional()
});

/**
 * ドキュメント検索ハンドラー
 */
export async function documentSearchHandler(args: any): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = DocumentSearchArgsSchema.parse(args);
    const { query, directories, useRegex, maxResults, includeContext, contextLines } = params;
    
    // 検索対象ディレクトリの決定
    const targetDirs = directories || ["_llm-rules", "_llm-memories", "_llm-docs"];
    
    let output = "🔍 ドキュメント検索結果\n\n";
    output += `**検索クエリ**: "${query}"\n`;
    output += `**検索モード**: ${useRegex ? "正規表現" : "テキスト"}\n`;
    output += `**検索対象**: ${targetDirs.join(", ")}\n\n`;
    
    const allResults: Array<{
      file: string;
      matches: Array<{
        line: number;
        content: string;
        context?: string;
      }>;
    }> = [];
    
    // 各ディレクトリを検索
    for (const dir of targetDirs) {
      const dirPath = resolveProjectPath(dir);
      
      try {
        const files = await getFilesRecursively(dirPath, '.md');
        
        for (const filePath of files) {
          const content = await readTextFileSafe(filePath);
          if (!content) continue;
          
          const matches = searchInFile(content, query, useRegex, includeContext, contextLines);
          
          if (matches.length > 0) {
            const relativePath = filePath.replace(resolveProjectPath(''), '');
            allResults.push({
              file: relativePath,
              matches: matches
            });
          }
        }
      } catch (error) {
        console.error(`Error searching in ${dir}:`, error);
      }
    }
    
    // 結果の表示
    if (allResults.length === 0) {
      output += "❌ 該当するドキュメントが見つかりませんでした。\n\n";
      output += "💡 検索のヒント:\n";
      output += "- より一般的なキーワードを使用してください\n";
      output += "- 正規表現モードを試してみてください（useRegex: true）\n";
      output += "- 検索対象ディレクトリを確認してください\n";
    } else {
      let totalMatches = 0;
      let displayedFiles = 0;
      
      for (const result of allResults) {
        if (displayedFiles >= maxResults) break;
        
        output += `## 📄 ${result.file}\n\n`;
        output += `マッチ数: ${result.matches.length}件\n\n`;
        
        for (const match of result.matches.slice(0, 5)) {
          output += `**Line ${match.line}**: \`${match.content.trim()}\`\n`;
          
          if (match.context && includeContext) {
            output += "```\n";
            output += match.context;
            output += "\n```\n";
          }
          output += "\n";
        }
        
        if (result.matches.length > 5) {
          output += `...他${result.matches.length - 5}件のマッチ\n\n`;
        }
        
        totalMatches += result.matches.length;
        displayedFiles++;
      }
      
      if (allResults.length > maxResults) {
        output += `\n📊 合計: ${allResults.length}ファイルで${totalMatches}件のマッチが見つかりました。\n`;
        output += `（最初の${maxResults}ファイルのみ表示）\n`;
      }
    }
    
    return {
      content: [{ type: "text", text: output }]
    };
    
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `❌ ドキュメント検索エラー: ${error instanceof Error ? error.message : String(error)}`
        }
      ]
    };
  }
}

/**
 * ドキュメント読み取りハンドラー
 */
export async function documentReadHandler(args: any): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const params = DocumentReadArgsSchema.parse(args);
    const { path, startLine, endLine } = params;
    
    // パスの検証（_llm-rules, _llm-memories, _llm-docsのみ許可）
    const allowedDirs = ["_llm-rules", "_llm-memories", "_llm-docs"];
    const isAllowed = allowedDirs.some(dir => path.startsWith(dir + "/") || path === dir);
    
    if (!isAllowed) {
      throw new Error(`アクセスが許可されていないパスです: ${path}`);
    }
    
    const fullPath = resolveProjectPath(path);
    const content = await readTextFileSafe(fullPath);
    
    if (!content) {
      throw new Error(`ドキュメントが見つかりません: ${path}`);
    }
    
    let output = `📖 ドキュメント内容\n\n`;
    output += `**ファイル**: ${path}\n`;
    
    // ファイル情報の取得
    try {
      const stat = await Deno.stat(fullPath);
      output += `**最終更新**: ${stat.mtime?.toISOString().split('T')[0] || 'Unknown'}\n`;
      output += `**サイズ**: ${Math.round(stat.size / 1024 * 10) / 10}KB\n`;
    } catch {
      // ファイル情報取得に失敗しても続行
    }
    
    output += "\n---\n\n";
    
    // 内容の処理
    const lines = content.split('\n');
    
    if (startLine !== undefined || endLine !== undefined) {
      const start = (startLine || 1) - 1;
      const end = endLine || lines.length;
      const selectedLines = lines.slice(start, end);
      
      output += `（${startLine || 1}行目から${endLine || lines.length}行目まで）\n\n`;
      output += "```markdown\n";
      output += selectedLines.join('\n');
      output += "\n```\n";
    } else {
      output += "```markdown\n";
      output += content;
      output += "\n```\n";
    }
    
    return {
      content: [{ type: "text", text: output }]
    };
    
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `❌ ドキュメント読み取りエラー: ${error instanceof Error ? error.message : String(error)}`
        }
      ]
    };
  }
}

/**
 * ファイル内検索関数
 */
function searchInFile(
  content: string,
  query: string,
  useRegex: boolean,
  includeContext: boolean,
  contextLineCount: number
): Array<{ line: number; content: string; context?: string }> {
  const lines = content.split('\n');
  const matches: Array<{ line: number; content: string; context?: string }> = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let isMatch = false;
    
    if (useRegex) {
      try {
        const regex = new RegExp(query, 'gi');
        isMatch = regex.test(line);
      } catch {
        // 無効な正規表現の場合は通常の検索にフォールバック
        isMatch = line.toLowerCase().includes(query.toLowerCase());
      }
    } else {
      isMatch = line.toLowerCase().includes(query.toLowerCase());
    }
    
    if (isMatch) {
      const match: { line: number; content: string; context?: string } = {
        line: i + 1,
        content: line
      };
      
      if (includeContext) {
        const contextStart = Math.max(0, i - contextLineCount);
        const contextEnd = Math.min(lines.length, i + contextLineCount + 1);
        const contextLines = lines.slice(contextStart, contextEnd);
        
        // マッチした行をハイライト
        const highlightedContext = contextLines.map((l, idx) => {
          const lineNum = contextStart + idx + 1;
          if (lineNum === i + 1) {
            return `>>> ${lineNum}: ${l}`;
          }
          return `    ${lineNum}: ${l}`;
        }).join('\n');
        
        match.context = highlightedContext;
      }
      
      matches.push(match);
    }
  }
  
  return matches;
}