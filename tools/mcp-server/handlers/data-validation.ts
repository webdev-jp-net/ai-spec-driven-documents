import { validateIssueDataIntegrity, formatValidationReport } from "../utils/data-validator.ts";
import { z } from "zod";

const DataValidationArgsSchema = z.object({
  detailed: z.boolean().default(true),
  fix_auto: z.boolean().default(false),
});

/**
 * データ整合性バリデーションハンドラー
 */
export async function dataValidationHandler(args: any): Promise<{ content: Array<{ type: string; text: string }> }> {
  try {
    const { detailed, fix_auto } = DataValidationArgsSchema.parse(args);

    // データ整合性検証を実行
    const validationResult = await validateIssueDataIntegrity();

    // レポート生成
    const report = formatValidationReport(validationResult);

    let responseText = report;

    // 自動修正オプション（将来の拡張用）
    if (fix_auto && !validationResult.isValid) {
      responseText += '\\n\\n🔧 自動修正機能は今後実装予定です。';
      responseText += '\\n現在は手動での修正をお願いします。';
    }

    // 改善提案の追加
    if (!validationResult.isValid) {
      responseText += '\\n\\n📋 推奨アクション:';
      responseText += '\\n1. フォーマット不整合がある場合、MCPサーバーの同期機能を実行';
      responseText += '\\n2. 型違反がある場合、該当行を手動修正';
      responseText += '\\n3. 修正後、再度バリデーションを実行して確認';
    }

    return {
      content: [{
        type: "text",
        text: responseText
      }]
    };

  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `バリデーション実行エラー: ${error.message}`
      }]
    };
  }
}