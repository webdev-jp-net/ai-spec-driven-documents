import { readTextFileSafe, resolveProjectPath } from "./file-operations.ts";
import { loadProjectConfig, getProjectConfigValue } from "./project-config-loader.ts";

export interface ProjectConfig {
  number: number;
  owner: string;
  name: string;
  description?: string;
}

export interface ProjectField {
  name: string;
  type: "SINGLE_SELECT" | "TEXT" | "NUMBER" | "DATE";
  options?: string[];
}

export interface LabelFieldMapping {
  [labelPattern: string]: {
    [fieldName: string]: string;
  };
}

export interface RepoSectionMapping {
  [repoName: string]: string;
}

export class GitHubProjectsConfig {
  private configPath: string;
  private config: any = null;

  constructor() {
    const githubProjectsConfigPath = getProjectConfigValue<string>('documents.githubProjectsConfig', '_llm-docs/operation/github-projects-config.md');
    this.configPath = resolveProjectPath(githubProjectsConfigPath);
  }

  /**
   * 設定ファイルを読み込んで解析
   */
  async loadConfig(): Promise<void> {
    try {
      const content = await readTextFileSafe(this.configPath);
      if (!content) {
        throw new Error("GitHub Projects config file not found");
      }

      this.config = this.parseConfig(content);
    } catch (error) {
      console.error('Error loading GitHub Projects config:', error);
      throw error;
    }
  }

  /**
   * 設定ファイルの内容を解析
   */
  private parseConfig(content: string): any {
    const config: any = {
      projects: {},
      fields: {},
      labelFieldMapping: {},
      repoSectionMapping: {}
    };

    const lines = content.split('\n');
    let inJsonBlock = false;
    let jsonBuffer = '';
    let currentSection = '';

    for (const line of lines) {
      // JSONブロックの開始/終了を検出
      if (line.includes('```json')) {
        inJsonBlock = true;
        jsonBuffer = '';
        continue;
      }
      
      if (line.includes('```') && inJsonBlock) {
        inJsonBlock = false;
        try {
          const jsonData = JSON.parse(jsonBuffer);
          
          // セクションに応じてデータを格納
          if (currentSection.includes('プロジェクト詳細設定') || currentSection.includes('プロジェクト一覧')) {
            Object.assign(config.projects, jsonData.projects || jsonData);
          } else if (currentSection.includes('フィールド定義')) {
            Object.assign(config.fields, jsonData.fields || jsonData);
          } else if (currentSection.includes('ラベル体系とプロジェクトフィールドのマッピング')) {
            Object.assign(config.labelFieldMapping, jsonData.label_to_field_mapping || jsonData);
            Object.assign(config.repoSectionMapping, jsonData.repo_to_section_mapping || jsonData);
          } else if (currentSection.includes('リポジトリ→セクション変換規則')) {
            Object.assign(config.repoSectionMapping, jsonData.repo_to_section || jsonData);
          }
        } catch (error) {
          console.warn('Failed to parse JSON block:', error);
        }
        continue;
      }

      if (inJsonBlock) {
        jsonBuffer += line + '\n';
      } else {
        // セクション見出しを追跡
        if (line.startsWith('###')) {
          currentSection = line;
        }
      }
    }

    return config;
  }

  /**
   * メインプロジェクトの設定を取得
   */
  async getMainProject(): Promise<ProjectConfig | null> {
    try {
      await loadProjectConfig();
      const projectNumber = getProjectConfigValue<number>('github.projectNumber');
      const ownerName = getProjectConfigValue<string>('github.ownerName');
      
      if (projectNumber && ownerName) {
        return {
          number: projectNumber,
          owner: ownerName,
          name: `Project #${projectNumber}`
        };
      }
      
      // projectNumberが設定されていない場合はnullを返す
      if (!projectNumber) {
        return null;
      }
    } catch {
      // 設定が読めない場合は既存の設定にフォールバック
    }

    // 既存の設定ファイルから読み込み
    if (!this.config) {
      await this.loadConfig();
    }

    const mainProject = this.config.projects?.main;
    if (!mainProject) {
      return null; // エラーではなくnullを返す
    }

    return {
      number: mainProject.number,
      owner: mainProject.owner,
      name: mainProject.name,
      description: mainProject.description
    };
  }

  /**
   * フィールド設定を取得
   */
  async getFields(): Promise<Record<string, ProjectField>> {
    if (!this.config) {
      await this.loadConfig();
    }

    return this.config.fields || {};
  }

  /**
   * ラベルからフィールド値をマッピング
   */
  async mapLabelsToFields(labels: string[]): Promise<Record<string, string>> {
    if (!this.config) {
      await this.loadConfig();
    }

    const mapping = this.config.labelFieldMapping || {};
    const result: Record<string, string> = {};

    for (const label of labels) {
      const labelMapping = mapping[label];
      if (labelMapping) {
        Object.assign(result, labelMapping);
      }
    }

    return result;
  }


  /**
   * デフォルトフィールド値を取得
   */
  getDefaultFieldValues(): Record<string, string> {
    return {
      'Status': 'Backlog',
      'priority': 'Medium',
      'category': 'frontend'
    };
  }
}

/**
 * GitHub Projects API クライアント
 */
export class GitHubProjectsClient {
  private config: GitHubProjectsConfig;

  constructor() {
    this.config = new GitHubProjectsConfig();
  }

  /**
   * Issueをプロジェクトに追加
   */
  async addIssueToProject(
    issueUrl: string, 
    labels: string[] = [], 
    projectsFields?: { category?: string; priority?: string; section?: string }
  ): Promise<string | null> {
    try {
      const project = await this.config.getMainProject();
      
      // projectが設定されていない場合はスキップ
      if (!project) {
        console.log('GitHub Projects integration skipped: projectNumber not configured');
        return null;
      }
      
      // Issueをプロジェクトに追加
      const addResult = await this.executeGhCommand([
        'project', 'item-add', project.number.toString(),
        '--owner', project.owner,
        '--url', issueUrl,
        '--format', 'json'
      ]);

      const itemData = JSON.parse(addResult);
      const itemId = itemData.id;

      // フィールドを設定
      await this.setProjectFields(project, itemId, labels, projectsFields);

      return itemId;
    } catch (error) {
      throw new Error(`Failed to add issue to project: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * プロジェクトフィールドを設定
   */
  private async setProjectFields(
    project: ProjectConfig, 
    itemId: string, 
    labels: string[], 
    projectsFields?: { category?: string; priority?: string; section?: string }
  ): Promise<void> {
    try {
      // プロジェクトIDを取得
      const projectResult = await this.executeGhCommand([
        'project', 'view', project.number.toString(),
        '--owner', project.owner,
        '--format', 'json'
      ]);
      const projectData = JSON.parse(projectResult);
      const projectId = projectData.id;

      // フィールド情報を取得
      const fieldsResult = await this.executeGhCommand([
        'project', 'field-list', project.number.toString(),
        '--owner', project.owner,
        '--format', 'json'
      ]);
      const fieldsData = JSON.parse(fieldsResult);

      // ラベルからフィールド値をマッピング
      const labelMapping = await this.config.mapLabelsToFields(labels);

      // DRAFT由来のフィールド値を優先適用
      if (projectsFields) {
        if (projectsFields.category) {
          labelMapping['category'] = projectsFields.category;
        }
        if (projectsFields.priority) {
          labelMapping['priority'] = projectsFields.priority;
        }
        if (projectsFields.section) {
          labelMapping['section'] = projectsFields.section;
        }
      }

      // デフォルト値をマージ（優先順位: DRAFT > ラベルマッピング > デフォルト）
      const defaultValues = this.config.getDefaultFieldValues();
      const finalMapping = { ...defaultValues, ...labelMapping };

      // 各フィールドを設定
      for (const [fieldName, fieldValue] of Object.entries(finalMapping)) {
        await this.setFieldValue(fieldsData, projectId, itemId, fieldName, fieldValue, project.number.toString());
      }

    } catch (error) {
      console.warn('Failed to set project fields:', error);
    }
  }

  /**
   * 個別フィールド値を設定
   */
  private async setFieldValue(
    fieldsData: any, 
    projectId: string, 
    itemId: string, 
    fieldName: string, 
    fieldValue: string,
    projectNumber: string
  ): Promise<void> {
    try {
      const field = fieldsData.fields?.find((f: any) => f.name === fieldName);
      if (!field) {
        console.warn(`Field '${fieldName}' not found in project`);
        return;
      }

      const fieldId = field.id;

      if (field.options) {
        // SINGLE_SELECT フィールドの場合
        const option = field.options.find((opt: any) => opt.name === fieldValue);
        if (!option) {
          console.warn(`Option '${fieldValue}' not found for field '${fieldName}'`);
          return;
        }

        await this.executeGhCommand([
          'project', 'item-edit', projectNumber,
          '--id', itemId,
          '--project-id', projectId,
          '--field-id', fieldId,
          '--single-select-option-id', option.id
        ]);
      } else {
        // TEXT フィールドの場合
        await this.executeGhCommand([
          'project', 'item-edit', projectNumber,
          '--id', itemId,
          '--project-id', projectId,
          '--field-id', fieldId,
          '--text', fieldValue
        ]);
      }
    } catch (error) {
      console.warn(`Failed to set field '${fieldName}':`, error);
    }
  }

  /**
   * GitHub CLIコマンドを実行
   */
  private async executeGhCommand(args: string[]): Promise<string> {
    try {
      // Deno.Commandを使用
      const cmd = new Deno.Command('gh', { args });
      const { code, stdout, stderr } = await cmd.output();
      
      if (code !== 0) {
        const errorText = new TextDecoder().decode(stderr);
        throw new Error(errorText || 'Command failed');
      }
      
      const result = new TextDecoder().decode(stdout);
      return result.trim();
    } catch (error: any) {
      throw new Error(`GitHub CLI command failed: ${error.message}`);
    }
  }

  /**
   * プロジェクト認証状態をチェック
   */
  async checkProjectAccess(): Promise<boolean> {
    try {
      const project = await this.config.getMainProject();
      
      // projectが設定されていない場合はfalseを返す
      if (!project) {
        return false;
      }
      
      await this.executeGhCommand([
        'project', 'view', project.number.toString(),
        '--owner', project.owner,
        '--format', 'json'
      ]);
      
      return true;
    } catch (error) {
      console.error('Project access check failed:', error);
      return false;
    }
  }

  /**
   * Issue番号のリストからProjectフィールド値を取得
   */
  async getProjectFieldsForIssues(repoFullName: string, issueNumbers: number[]): Promise<Map<number, { category?: string; priority?: string; section?: string }>> {
    const fieldsMap = new Map<number, { category?: string; priority?: string; section?: string }>();
    
    try {
      await this.config.loadConfig();
      const project = await this.config.getMainProject();
      
      // ownerTypeを取得
      const ownerType = getProjectConfigValue<string>('github.ownerType', 'organization');
      const ownerQuery = ownerType === 'user' ? 'user' : 'organization';
      
      // GraphQLクエリでProject内のIssue情報を取得
      const query = `
        query {
          ${ownerQuery}(login: "${project.owner}") {
            projectV2(number: ${project.number}) {
              items(first: 100) {
                nodes {
                  id
                  content {
                    ... on Issue {
                      number
                      repository {
                        nameWithOwner
                      }
                    }
                  }
                  fieldValues(first: 20) {
                    nodes {
                      ... on ProjectV2ItemFieldSingleSelectValue {
                        field {
                          ... on ProjectV2SingleSelectField {
                            name
                          }
                        }
                        name
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `;
      
      const result = await this.executeGhCommand([
        'api', 'graphql',
        '-f', `query=${query}`
      ]);
      
      const data = JSON.parse(result);
      const items = data.data?.[ownerQuery]?.projectV2?.items?.nodes || [];
      
      // 対象リポジトリのIssueをフィルタリング
      for (const item of items) {
        const issueNumber = item.content?.number;
        const repoName = item.content?.repository?.nameWithOwner;
        
        if (issueNumber && repoName === repoFullName && issueNumbers.includes(issueNumber)) {
          const fields: { category?: string; priority?: string; section?: string } = {};
          
          // フィールド値を抽出
          for (const fieldValue of item.fieldValues?.nodes || []) {
            const fieldName = fieldValue.field?.name;
            const value = fieldValue.name;
            
            if (fieldName === 'category') fields.category = value;
            if (fieldName === 'priority') fields.priority = value;
            if (fieldName === 'section') fields.section = value;
          }
          
          fieldsMap.set(issueNumber, fields);
        }
      }
      
    } catch (error) {
      console.error('Failed to get project fields for issues:', error);
    }
    
    return fieldsMap;
  }
}

// シングルトンインスタンス（遅延初期化）
let _gitHubProjectsClient: GitHubProjectsClient | null = null;

export function getGitHubProjectsClient(): GitHubProjectsClient {
  if (!_gitHubProjectsClient) {
    _gitHubProjectsClient = new GitHubProjectsClient();
  }
  return _gitHubProjectsClient;
}

// 後方互換性のため
export const gitHubProjectsClient = {
  getProjectInfo: () => getGitHubProjectsClient().getProjectInfo(),
  getFieldId: (fieldName: string) => getGitHubProjectsClient().getFieldId(fieldName),
  getFieldOptions: (fieldName: string) => getGitHubProjectsClient().getFieldOptions(fieldName),
  addIssueToProject: (issueUrl: string, fieldValues?: Record<string, string>) => 
    getGitHubProjectsClient().addIssueToProject(issueUrl, fieldValues),
  verifyFieldValues: (fieldValues: Record<string, string>) => 
    getGitHubProjectsClient().verifyFieldValues(fieldValues),
  getProjectConfigSummary: () => getGitHubProjectsClient().getProjectConfigSummary()
};