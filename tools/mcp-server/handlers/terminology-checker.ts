import { z } from "zod";
import { docsProvider } from "../resources/docs-provider.ts";
import { terminologyProvider } from "../resources/terminology-provider.ts";

const TerminologyCheckArgsSchema = z.object({
  text: z.string(),
  suggest_replacements: z.boolean().default(true),
  check_consistency: z.boolean().default(true),
});


/**
 * 用語統一チェックハンドラー
 */
export async function terminologyCheckHandler(args: any): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const { text, suggest_replacements, check_consistency } = TerminologyCheckArgsSchema.parse(args);

    let output = "📝 用語統一チェック結果\n\n";

    // 基本的な用語チェック
    if (check_consistency) {
      const consistencyResult = await docsProvider.checkTerminologyConsistency(text);
      
      output += "## 用語統一チェック\n\n";
      output += `✅ チェック完了: ${consistencyResult.summary.totalChecked}用語を確認\n`;
      output += `📊 提案件数: ${consistencyResult.summary.suggestionsCount}件\n`;
      output += `🏷️  対象カテゴリ: ${consistencyResult.summary.categories.join(', ')}\n\n`;

      if (consistencyResult.suggestions.length > 0) {
        output += "### 用語統一提案\n\n";
        
        for (const suggestion of consistencyResult.suggestions) {
          output += `- **${suggestion.original}** → \`${suggestion.suggested}\` (${suggestion.category})\n`;
          output += `  位置: ${suggestion.position}文字目\n\n`;
        }
      } else {
        output += "✨ 用語統一に関する問題は見つかりませんでした。\n\n";
      }
    }

    // 置換提案
    if (suggest_replacements) {
      output += "## 推奨用語への置換提案\n\n";
      
      // 日本語→英語マッピングを取得
      const terminologyResource = await terminologyProvider.readResource("terminology://dictionary/japanese-to-english");
      const terminologyData = JSON.parse(terminologyResource.contents[0].text);
      const mapping = terminologyData.mapping;
      
      let replacementCount = 0;
      
      for (const [japanese, english] of Object.entries(mapping)) {
        if (text.includes(japanese)) {
          const termEntry = await terminologyProvider.searchJapaneseToEnglish(japanese);
          if (termEntry.length > 0) {
            output += `### ${japanese} → ${english}\n`;
            output += `**説明**: ${termEntry[0].description}\n`;
            output += `**カテゴリ**: ${termEntry[0].category}\n`;
            output += `**使用場面**: ${termEntry[0].usage}\n\n`;
            
            replacementCount++;
          }
        }
      }
      
      if (replacementCount === 0) {
        output += "特に置換提案はありません。現在の用語使用は適切です。\n\n";
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
          text: `❌ 用語チェックエラー: ${error instanceof Error ? error.message : String(error)}`
        }
      ]
    };
  }
}