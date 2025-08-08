# 🤖 AI Agent Session Control

## MANDATORY FIRST ACTION
**IMMEDIATELY** read and follow: `_llm-rules/session_control.md`
(最初に必ず`_llm-rules/session_control.md`を読み込み、従うこと)

## Rule Loading Instructions
- Use the Read tool to load rule files directly from `_llm-rules/` directory
  (Readツールを使用して`_llm-rules/`ディレクトリから直接ルールファイルを読み込む)
- Follow the complete rule chain: CLAUDE.md → session_control → specialized_rule → core_rules
  (必ず完全なルールチェーンに従う: CLAUDE.md → session_control → 専門ルール → core_rules)
- DO NOT proceed with any coding task without first consulting session_control.md
  (session_control.mdを確認せずにコーディングタスクを進めてはいけない)
- Pay special attention to file structure and project context
  (ファイル構造とプロジェクトの文脈に特別な注意を払う)

## Terminology Unification System
- Built-in terminology checker available via MCP server
  (MCPサーバー経由で用語統一チェッカーが利用可能)
- Automatic document suggestion based on query context
  (クエリの文脈に基づく自動ドキュメント提案)
- Uses `_llm-docs/operation/dictionary.md` as source of truth for terminology
  (用語の正式な情報源として`_llm-docs/operation/dictionary.md`を使用)

## AI Agent Specific Considerations (AIエージェント固有の考慮事項)
- Respect existing project structure and conventions (既存のプロジェクト構造と規約を尊重)
- Analyze codebase before making changes (変更前にコードベースを分析)
- Consider impact on existing functionality (既存機能への影響を考慮)
- Follow established patterns in the project (プロジェクトで確立されたパターンに従う)

## Emergency Fallback (緊急時のフォールバック)
If `_llm-rules/session_control.md` is unavailable, refer to `_llm-rules/core_rules.md` directly.
(`_llm-rules/session_control.md`が利用できない場合は、`_llm-rules/core_rules.md`を直接参照)

---
**⚠️ This file serves as entry point for AI agents (Cursor, Windsurf, Claude Code, etc.). All logic is in _llm-rules/ directory.**
（このファイルはAIエージェント（Cursor、Windsurf、Claude Code等）のエントリーポイント。すべてのロジックは_llm-rules/ディレクトリにあります）
