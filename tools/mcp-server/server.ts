#!/usr/bin/env deno run --allow-all

// deno-lint-ignore-file no-explicit-any

/**
 * AI Spec Driven Document MCP Server
 * Custom JSON-RPC Implementation
 */

// Types
import type {
  JsonRpcRequest,
  JsonRpcResponse,
  McpTool,
  McpToolDefinition,
  McpServerCapabilities,
  McpServerInfo,
} from "./types/mcp.ts";

// ハンドラーとリソースのインポート
import { githubSyncHandler } from "./handlers/github-sync.ts";
import { terminologyCheckHandler } from "./handlers/terminology-checker.ts";
import { taskGeneratorHandler } from "./handlers/task-generator.ts";
import { saveDraftIssuesHandler } from "./handlers/save-draft-issues.ts";
import { documentSearchHandler, documentReadHandler } from "./handlers/document-search.ts";
import { memoryManagerHandler } from "./handlers/memory-manager.ts";
import { loadProjectConfig } from "./utils/project-config-loader.ts";
import { docsProvider } from "./resources/docs-provider.ts";
import { rulesProvider } from "./resources/rules-provider.ts";
import { issuesProvider } from "./resources/issues-provider.ts";
import { terminologyProvider } from "./resources/terminology-provider.ts";

// サーバー設定
const SERVER_NAME = "ai-spec-driven-document-mcp";
const SERVER_VERSION = "1.0.0";

class ProjectMCPServer {
  private tools: Map<string, McpTool> = new Map();
  // 内部ツールとして扱うツール名のセット
  private internalTools: Set<string> = new Set(["check_terminology", "save_draft_issues"]);

  constructor() {
    this.registerTools();
  }

  private registerTools() {
    // GitHub Sync Tool
    this.tools.set("sync_with_github", {
      name: "sync_with_github",
      description: "GitHubとの完全同期（DRAFT→Issue作成、最新状態取得）",
      inputSchema: {
        type: "object",
        properties: {
          repo: {
            type: "string",
            description: "対象リポジトリ（設定で定義されたリポジトリキー）"
          },
          include_closed: {
            type: "boolean",
            description: "クローズされたIssueも含めるか",
            default: true
          }
        },
        required: ["repo"]
      },
      handler: async (args: any) => {
        return await githubSyncHandler(args);
      }
    });

    // Terminology Check Tool
    this.tools.set("check_terminology", {
      name: "check_terminology",
      description: "用語統一チェック・修正提案",
      inputSchema: {
        type: "object",
        properties: {
          text: {
            type: "string",
            description: "チェックしたいテキスト"
          },
          suggest_replacements: {
            type: "boolean",
            description: "置換提案を表示するか",
            default: true
          },
          check_consistency: {
            type: "boolean",
            description: "用語統一チェックを実行するか",
            default: true
          }
        },
        required: ["text"]
      },
      handler: async (args: any) => {
        return await terminologyCheckHandler(args);
      }
    });

    // Save Draft Issues Tool
    this.tools.set("save_draft_issues", {
      name: "save_draft_issues",
      description: "Issue候補をDRAFTセクションに保存",
      inputSchema: {
        type: "object",
        properties: {
          repo: {
            type: "string",
            description: "対象リポジトリ（設定で定義されたリポジトリキー）"
          },
          issues: {
            type: "array",
            description: "保存するIssue候補のリスト",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                body: { type: "string" },
                labels: { type: "string" }
              },
              required: ["title", "labels"]
            }
          }
        },
        required: ["repo", "issues"]
      },
      handler: async (args: any) => {
        return await saveDraftIssuesHandler(args);
      }
    });

    // Task Generation Tool
    this.tools.set("generate_task", {
      name: "generate_task",
      description: "明示的なコマンド実行時のみ動作。自然言語の要件からタスク分解とIssue候補生成",
      inputSchema: {
        type: "object",
        properties: {
          order: {
            type: "string",
            description: "自然言語でのオーダー（例：「ユーザー認証機能を実装したい」）"
          },
          target_repo: {
            type: "string",
            description: "対象リポジトリ（設定で定義されたリポジトリキー）"
          },
          context: {
            type: "string",
            description: "追加コンテキスト（オプション）"
          },
          force_regenerate: {
            type: "boolean",
            description: "強制再生成（キャッシュを無視）",
            default: false
          },
          save_to_draft: {
            type: "boolean",
            description: "DRAFTセクションに保存するか",
            default: false
          }
        },
        required: ["order", "target_repo"]
      },
      handler: async (args: any) => {
        return await taskGeneratorHandler(args);
      }
    });

    // GitHub Projects Manager Tool
    this.tools.set("manage_github_projects", {
      name: "manage_github_projects",
      description: "GitHub Projectsの管理（Issue追加、アクセス確認、設定表示）",
      inputSchema: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["add_issue", "check_access", "list_config"],
            description: "実行するアクション（add_issue: Issue追加, check_access: アクセス確認, list_config: 設定表示）"
          },
          issue_url: {
            type: "string",
            description: "Issueの URL（add_issue時に必要）"
          },
          repo: {
            type: "string",
            description: "リポジトリ名（add_issue時に必要）"
          },
          labels: {
            type: "string",
            description: "ラベル（カンマ区切り、add_issue時にオプション）"
          }
        },
        required: ["action"]
      },
      handler: async (args: any) => {
        const { githubProjectsManagerHandler } = await import("./handlers/github-projects-manager.ts");
        return await githubProjectsManagerHandler(args);
      }
    });

    // Document Search Tool
    this.tools.set("search_documents", {
      name: "search_documents",
      description: "プロジェクトドキュメントの検索（_llm-rules, _llm-memories, _llm-docs）",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "検索クエリ（テキストまたは正規表現）"
          },
          directories: {
            type: "array",
            items: {
              type: "string",
              enum: ["_llm-rules", "_llm-memories", "_llm-docs"]
            },
            description: "検索対象ディレクトリ（省略時は全て）"
          },
          useRegex: {
            type: "boolean",
            description: "正規表現モードを使用するか",
            default: false
          },
          maxResults: {
            type: "number",
            description: "最大表示ファイル数",
            default: 10
          },
          includeContext: {
            type: "boolean",
            description: "マッチ箇所の前後文脈を含めるか",
            default: true
          },
          contextLines: {
            type: "number",
            description: "表示する前後の行数",
            default: 3
          }
        },
        required: ["query"]
      },
      handler: async (args: any) => {
        return await documentSearchHandler(args);
      }
    });

    // Document Read Tool
    this.tools.set("read_document", {
      name: "read_document",
      description: "プロジェクトドキュメントの読み取り（_llm-rules, _llm-memories, _llm-docs）",
      inputSchema: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "読み取るファイルのパス（例: _llm-rules/core_rules.md）"
          },
          startLine: {
            type: "number",
            description: "開始行番号（省略時は1行目から）"
          },
          endLine: {
            type: "number",
            description: "終了行番号（省略時は最後まで）"
          }
        },
        required: ["path"]
      },
      handler: async (args: any) => {
        return await documentReadHandler(args);
      }
    });

    // Memory Manager Tool
    this.tools.set("manage_memory", {
      name: "manage_memory",
      description: "学習記録ファイルの管理（時系列ソート、状態確認）",
      inputSchema: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["sort", "check", "sync"],
            description: "実行するアクション（sort: ソート実行, check: 状態確認, sync: Issue同期後の推奨アクション）",
            default: "sort"
          }
        }
      },
      handler: async (args: any) => {
        return await memoryManagerHandler(args);
      }
    });


  }

  private async handleInitialize(_params: any): Promise<{
    protocolVersion: string;
    capabilities: McpServerCapabilities;
    serverInfo: McpServerInfo;
  }> {
    return {
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: {
          listChanged: true,
        },
        resources: {
          subscribe: true,
          listChanged: true,
        }
      },
      serverInfo: {
        name: SERVER_NAME,
        version: SERVER_VERSION,
      },
    };
  }

  private async handleToolsList(): Promise<{ tools: McpToolDefinition[] }> {
    const tools: McpToolDefinition[] = Array.from(this.tools.values())
      .filter((tool) => !this.internalTools.has(tool.name)) // 内部ツールを除外
      .map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      }));

    return {
      tools,
    };
  }

  private async handleToolsCall(params: any): Promise<any> {
    const { name, arguments: args } = params;

    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }

    return await tool.handler(args);
  }

  private async handleResourcesList(): Promise<any> {
    const resources = [
      ...await docsProvider.listResources(),
      ...await rulesProvider.listResources(),
      ...await issuesProvider.listResources(),
      ...await terminologyProvider.listResources()
    ];

    return { resources };
  }

  private async handleResourcesRead(params: any): Promise<any> {
    const { uri } = params;

    try {
      // URI プレフィックスに基づいてプロバイダーを選択
      if (uri.startsWith("file://_llm-docs/")) {
        return await docsProvider.readResource(uri);
      } else if (uri.startsWith("file://_llm-rules/")) {
        return await rulesProvider.readResource(uri);
      } else if (uri.startsWith("file://_llm-memories/issues/")) {
        return await issuesProvider.readResource(uri);
      } else if (uri.startsWith("terminology://")) {
        return await terminologyProvider.readResource(uri);
      } else {
        throw new Error(`Unknown resource URI: ${uri}`);
      }
    } catch (error) {
      throw new Error(`Error reading resource ${uri}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async handleRequest(
    request: JsonRpcRequest,
  ): Promise<JsonRpcResponse | null> {
    try {
      let result: any;

      switch (request.method) {
        case "initialize":
          result = await this.handleInitialize(request.params);
          break;
        case "tools/list":
          result = await this.handleToolsList();
          break;
        case "tools/call":
          result = await this.handleToolsCall(request.params);
          break;
        case "resources/list":
          result = await this.handleResourcesList();
          break;
        case "resources/read":
          result = await this.handleResourcesRead(request.params);
          break;
        case "notifications/initialized":
          console.error(`${SERVER_NAME} initialized successfully`);
          return null;
        default:
          throw new Error(`Unknown method: ${request.method}`);
      }

      // Only return response if request has an id (not a notification)
      if (request.id !== undefined) {
        return {
          jsonrpc: "2.0",
          id: request.id,
          result,
        };
      }
      return null;
    } catch (error) {
      // Only return error response if request has an id
      if (request.id !== undefined) {
        return {
          jsonrpc: "2.0",
          id: request.id,
          error: {
            code: -32603,
            message: error instanceof Error ? error.message : String(error),
          },
        };
      }
      console.error(`[ERROR] Error in notification:`, error);
      return null;
    }
  }

  async run() {
    console.error(`${SERVER_NAME} v${SERVER_VERSION} starting...`);

    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    let buffer = "";

    // Read from stdin and process JSON-RPC requests
    for await (const chunk of globalThis.Deno.stdin.readable) {
      const text = decoder.decode(chunk);
      buffer += text;

      // Process complete lines (messages)
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // Keep incomplete line in buffer

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        try {
          const request: JsonRpcRequest = JSON.parse(trimmedLine);

          const response = await this.handleRequest(request);
          if (response !== null) {
            const responseText = JSON.stringify(response) + "\n";
            await globalThis.Deno.stdout.write(encoder.encode(responseText));
          }
        } catch (error) {
          console.error(`[ERROR] Failed to process request:`, error);
          console.error(`[ERROR] Problematic line:`, trimmedLine);

          // Try to extract ID from malformed request
          let requestId: string | number | null = null;
          try {
            const partialRequest = JSON.parse(trimmedLine);
            requestId = partialRequest.id || null;
          } catch {
            // If we can't parse at all, use null ID
          }

          const errorResponse: JsonRpcResponse = {
            jsonrpc: "2.0",
            id: requestId,
            error: {
              code: -32700,
              message: "Parse error",
            },
          };

          const responseText = JSON.stringify(errorResponse) + "\n";
          await globalThis.Deno.stdout.write(encoder.encode(responseText));
        }
      }
    }
  }
}

// サーバー開始
if (import.meta.url.endsWith("server.ts")) {
  try {
    // プロジェクト設定を事前に読み込み
    await loadProjectConfig();
    
    const server = new ProjectMCPServer();
    await server.run();
  } catch (error) {
    console.error(`Failed to start ${SERVER_NAME}:`, error);
    Deno.exit(1);
  }
}