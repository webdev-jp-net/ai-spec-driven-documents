import { readTextFileSafe } from "../utils/file-operations.ts";
import { join } from "@std/path";

export interface ProjectConfig {
  github: {
    ownerType: "organization" | "user";
    ownerName: string;
    projectNumber?: number;
  };
  repositories: Record<string, string>;
  documentRepository?: string;
  documents?: {
    entryPoint?: string;
    dictionary?: string;
    implementationPrinciples?: string;
    coreRules?: string;
    githubProjectsConfig?: string;
    taskManagementRule?: string;
    issueGenerationRule?: string;
  };
  directories?: {
    docs?: string;
    rules?: string;
    memories?: string;
    issues?: string;
  };
}

// デフォルト設定
const DEFAULT_CONFIG: ProjectConfig = {
  github: {
    ownerType: "organization",
    ownerName: "your-org-name"
  },
  repositories: {
    main: "your-main-repo"
  },
  documents: {
    entryPoint: "_llm-docs/requirements_definition.md",
    dictionary: "_llm-docs/dictionary.md",
    implementationPrinciples: "_llm-rules/implementation_principles.md",
    coreRules: "_llm-rules/core_rules.md",
    githubProjectsConfig: "_llm-docs/github-projects-config.md",
    taskManagementRule: "_llm-rules/task_management_rule.md",
    issueGenerationRule: "_llm-rules/issue_generation_rule.md"
  },
  directories: {
    docs: "_llm-docs",
    rules: "_llm-rules",
    memories: "_llm-memories",
    issues: "_llm-memories/issues"
  }
};

let cachedProjectConfig: ProjectConfig | null = null;
let projectConfigLoadTime: number = 0;
const PROJECT_CONFIG_CACHE_TTL = 5 * 60 * 1000; // 5分

/**
 * MCPサーバー設定から渡された設定を取得
 */
function getMcpServerConfig(): ProjectConfig | null {
  // MCP_CONFIG環境変数から設定を取得（MCPランタイムが自動的に設定）
  const mcpConfigStr = Deno.env.get('MCP_CONFIG');
  if (mcpConfigStr) {
    try {
      return JSON.parse(mcpConfigStr);
    } catch (error) {
      console.error('Failed to parse MCP_CONFIG:', error);
    }
  }
  return null;
}

/**
 * .mcp.jsonファイルから設定を読み込み
 */
async function loadFromMcpJson(): Promise<ProjectConfig | null> {
  try {
    // プロジェクトルートの.mcp.jsonを読み込み
    const mcpJsonPath = join(Deno.cwd(), '.mcp.json');
    const content = await readTextFileSafe(mcpJsonPath);
    
    if (!content) {
      return null;
    }
    
    const mcpConfig = JSON.parse(content);
    const serverConfig = mcpConfig?.mcpServers?.['ai-spec-driven-document']?.config;
    
    if (serverConfig) {
      return serverConfig as ProjectConfig;
    }
  } catch (error) {
    console.error('Failed to load .mcp.json:', error);
  }
  
  return null;
}

/**
 * プロジェクト設定を読み込み
 */
export async function loadProjectConfig(forceReload = false): Promise<ProjectConfig> {
  // キャッシュチェック
  if (!forceReload && cachedProjectConfig && (Date.now() - projectConfigLoadTime) < PROJECT_CONFIG_CACHE_TTL) {
    return cachedProjectConfig;
  }

  // 1. MCPランタイムから渡された設定を優先
  let config = getMcpServerConfig();
  
  // 2. .mcp.jsonから読み込み
  if (!config) {
    config = await loadFromMcpJson();
  }
  
  // 3. デフォルト設定を使用
  if (!config) {
    console.warn('No project configuration found. Using default configuration.');
    config = DEFAULT_CONFIG;
  }
  
  cachedProjectConfig = config;
  projectConfigLoadTime = Date.now();
  
  return cachedProjectConfig;
}

/**
 * プロジェクト設定値を取得
 */
export function getProjectConfigValue<T = any>(key: string, defaultValue: T): T;
export function getProjectConfigValue<T = any>(key: string): T | undefined;
export function getProjectConfigValue<T = any>(key: string, defaultValue?: T): T | undefined {
  if (!cachedProjectConfig) {
    throw new Error('プロジェクト設定が読み込まれていません。loadProjectConfig() を先に呼び出してください。');
  }
  
  const keys = key.split('.');
  let current: any = cachedProjectConfig;
  
  for (const k of keys) {
    if (current && typeof current === 'object' && k in current) {
      current = current[k];
    } else {
      return defaultValue;
    }
  }
  
  return current as T;
}

/**
 * リポジトリ名マッピングを生成
 */
export function generateRepoMapping(): Record<string, string> {
  const repositories = getProjectConfigValue<ProjectConfig['repositories']>('repositories', {});
  const mapping: Record<string, string> = {};
  
  for (const [key, repoName] of Object.entries(repositories || {})) {
    mapping[repoName] = key;
  }
  
  return mapping;
}


/**
 * デフォルトリポジトリキーを取得
 */
export function getDefaultRepoKey(): string | null {
  const repositories = getProjectConfigValue<ProjectConfig['repositories']>('repositories', {});
  const repoKeys = Object.keys(repositories || {});
  
  // リポジトリが1つだけの場合、それをデフォルトとする
  if (repoKeys.length === 1) {
    return repoKeys[0];
  }
  
  return null;
}

/**
 * リポジトリのフルネームを取得
 */
export function getFullRepoName(repoKey?: string): string {
  const repositories = getProjectConfigValue<ProjectConfig['repositories']>('repositories', {});
  
  // repoKeyが未指定の場合、デフォルトを使用
  if (!repoKey) {
    const defaultKey = getDefaultRepoKey();
    if (defaultKey) {
      repoKey = defaultKey;
    } else {
      throw new Error('Repository not specified and no default repository found');
    }
  }
  
  const repoName = repositories?.[repoKey];
  if (!repoName) {
    throw new Error(`Repository not found: ${repoKey}`);
  }
  
  const ownerName = getProjectConfigValue<string>('github.ownerName', 'your-org-name');
  return `${ownerName}/${repoName}`;
}