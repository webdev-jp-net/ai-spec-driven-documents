import { z } from "zod";

// Issue状態の定義
export const IssueStateSchema = z.enum(["DRAFT", "OPEN", "CLOSED"]);
export type IssueState = z.infer<typeof IssueStateSchema>;

// Issue優先度の定義（ProjectsPrioritySchemaと統一）
export const IssuePrioritySchema = z.enum([
  "Critical",
  "High", 
  "Medium",
  "Low"
]);
export type IssuePriority = z.infer<typeof IssuePrioritySchema>;

// Issueタイプの定義
export const IssueTypeSchema = z.enum([
  "Bug",
  "Feature", 
  "Task"
]);
export type IssueType = z.infer<typeof IssueTypeSchema>;

// 技術スタックの定義
export const TechStackSchema = z.enum([
  "frontend",
  "backend",
  "api",
  "database",
  "ui",
  "infra"
]);
export type TechStack = z.infer<typeof TechStackSchema>;

// リポジトリマッピング
export const RepositoryMappingSchema = z.record(z.string());
export type RepositoryMapping = z.infer<typeof RepositoryMappingSchema>;

// Issue基本構造
export const IssueSchema = z.object({
  number: z.number().nullable(),
  title: z.string(),
  body: z.string().optional(),
  state: IssueStateSchema,
  labels: z.array(z.string()).optional(),
  repo: z.string(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  closedAt: z.string().optional(),
  state_reason: z.string().optional(),
  // GitHub Projectsフィールド
  category: z.string().optional(),
  priority: z.string().optional(),
  section: z.string().optional(),
});
export type Issue = z.infer<typeof IssueSchema>;

// GitHub Projectsカテゴリの定義
export const ProjectsCategorySchema = z.enum([
  "structure",
  "frontend", 
  "backend",
  "infrastructure"
]);
export type ProjectsCategory = z.infer<typeof ProjectsCategorySchema>;

// GitHub Projects優先度の定義（IssuePrioritySchemaと統一）
export const ProjectsPrioritySchema = IssuePrioritySchema;
export type ProjectsPriority = z.infer<typeof ProjectsPrioritySchema>;

// GitHub Projectsセクションの定義（文字列として受け入れる）
export const ProjectsSectionSchema = z.string();
export type ProjectsSection = z.infer<typeof ProjectsSectionSchema>;

// DRAFTIssue（Issue番号なし）- 7フィールド形式
export const DraftIssueSchema = z.object({
  title: z.string(),
  body: z.string().optional(),
  label: z.string().optional(),
  category: ProjectsCategorySchema.optional(),
  priority: ProjectsPrioritySchema.optional(),
  section: ProjectsSectionSchema.optional(),
  state: z.literal("DRAFT"),
  repo: z.string(),
});
export type DraftIssue = z.infer<typeof DraftIssueSchema>;

// 重複チェック結果
export const DuplicateResultSchema = z.object({
  existing: IssueSchema,
  similarity: z.number().min(0).max(100),
});
export type DuplicateResult = z.infer<typeof DuplicateResultSchema>;

// Issue生成リクエスト
export const IssueGenerationRequestSchema = z.object({
  requirementsPath: z.string(),
  targetRepo: z.string(),
  analysisContext: z.string().optional(),
});
export type IssueGenerationRequest = z.infer<typeof IssueGenerationRequestSchema>;

// GitHub同期リクエスト
export const GitHubSyncRequestSchema = z.object({
  repo: z.string(),
  includeClosedIssues: z.boolean().default(true),
  limit: z.number().default(100),
});
export type GitHubSyncRequest = z.infer<typeof GitHubSyncRequestSchema>;

// 重複チェックリクエスト
export const DuplicateCheckRequestSchema = z.object({
  title: z.string(),
  repo: z.string(),
  threshold: z.number().min(0).max(100).default(60),
});
export type DuplicateCheckRequest = z.infer<typeof DuplicateCheckRequestSchema>;

// GitHub Projects管理リクエスト
export const ProjectsManageRequestSchema = z.object({
  action: z.enum(["add_issue", "check_access", "list_config"]),
  issue_url: z.string().optional(),
  repo: z.string().optional(),
  labels: z.string().optional(),
});
export type ProjectsManageRequest = z.infer<typeof ProjectsManageRequestSchema>;

// MCPツールレスポンス
export const MCPToolResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.any().optional(),
  error: z.string().optional(),
});
export type MCPToolResponse = z.infer<typeof MCPToolResponseSchema>;