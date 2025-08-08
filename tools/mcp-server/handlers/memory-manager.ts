import { exists } from "@std/fs";
import { z } from "zod";

import { readTextFileSafe } from "../utils/file-operations.ts";
import { pathResolver } from "../utils/path-resolver.ts";

const MemoryManagerArgsSchema = z.object({
  action: z.enum(["check"]).default("check"),
});

// 対象となる学習記録ファイル
const MEMORY_FILES = [
  '_llm-memories/learned.md',
  '_llm-memories/prompts.md',
  '_llm-memories/right-from-the-start.md'
];

/**
 * 学習記録ファイルの状態をチェック
 */
async function checkMemoryFiles(): Promise<string[]> {
  const results: string[] = [];
  
  for (const filePath of MEMORY_FILES) {
    const fullPath = await pathResolver.resolveAsync(filePath);
    
    if (!await exists(fullPath)) {
      results.push(`⚠️ ${filePath}: ファイルが存在しません`);
      continue;
    }
    
    try {
      const content = await readTextFileSafe(fullPath);
      if (!content) {
        results.push(`⚠️ ${filePath}: ファイルの読み込みに失敗しました`);
        continue;
      }
      
      // 簡単な行数カウント
      const lines = content.split('\n').filter(line => line.includes('|') && !line.match(/^\|[\s\-:|]+\|$/));
      const dataRows = lines.filter(line => !line.includes('Issue/Context') && !line.includes('タスク概要'));
      
      results.push(`📄 ${filePath}: ${dataRows.length}行のデータ`);
    } catch (error) {
      results.push(`❌ ${filePath}: 読み取りエラー`);
    }
  }
  
  return results;
}

/**
 * MCP Tool Handler: 学習記録ファイル管理
 */
export async function memoryManagerHandler(args: any): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const { action } = MemoryManagerArgsSchema.parse(args);
    
    let output = "# 🧠 学習記録ファイル管理\n\n";
    
    switch (action) {
      case "check": {
        output += "## 現在の状態\n\n";
        const status = await checkMemoryFiles();
        output += status.join('\n');
        output += "\n\n💡 学習記録ファイルの存在とデータ行数を確認しました";
        break;
      }
      
      default:
        output += "❌ 不明なアクション: " + action;
    }
    
    return { content: [{ type: "text", text: output }] };
    
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `❌ メモリー管理エラー: ${error instanceof Error ? error.message : String(error)}`
        }
      ]
    };
  }
}