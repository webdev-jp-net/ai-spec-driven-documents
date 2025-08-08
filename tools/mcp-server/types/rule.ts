import { z } from "zod";

// ルールタイプの定義
export const RuleTypeSchema = z.enum([
  "core",
  "implementation",
  "github_integration",
  "issue_generation",
  "test",
  "task_management",
  "session_control"
]);
export type RuleType = z.infer<typeof RuleTypeSchema>;

// ルールメタデータ
export const RuleMetadataSchema = z.object({
  description: z.string(),
  globs: z.union([z.string(), z.array(z.string())]),
  alwaysApply: z.boolean().default(false),
});
export type RuleMetadata = z.infer<typeof RuleMetadataSchema>;

// ルール構造
export const RuleSchema = z.object({
  filePath: z.string(),
  fileName: z.string(),
  type: RuleTypeSchema,
  metadata: RuleMetadataSchema,
  content: z.string(),
  lastModified: z.string(),
});
export type Rule = z.infer<typeof RuleSchema>;

// タスクタイプの定義
export const TaskTypeSchema = z.enum([
  "frontend_development",
  "backend_development", 
  "fullstack_development",
  "testing",
  "github_operations",
  "task_decomposition",
  "documentation",
  "requirements_generation",
  "issue_generation"
]);
export type TaskType = z.infer<typeof TaskTypeSchema>;

// タスクコンテキスト
export const TaskContextSchema = z.object({
  type: TaskTypeSchema,
  description: z.string(),
  technologies: z.array(z.string()).optional(),
  repositories: z.array(z.string()).optional(),
  priority: z.enum(["high", "medium", "low"]).default("medium"),
});
export type TaskContext = z.infer<typeof TaskContextSchema>;

// 適用可能なルール
export const ApplicableRulesSchema = z.object({
  taskType: TaskTypeSchema,
  requiredRules: z.array(z.string()),
  optionalRules: z.array(z.string()).optional(),
  conditions: z.array(z.string()),
});
export type ApplicableRules = z.infer<typeof ApplicableRulesSchema>;

// ルール読み込みリクエスト
export const RuleLoadRequestSchema = z.object({
  ruleNames: z.array(z.string()),
  taskContext: TaskContextSchema.optional(),
});
export type RuleLoadRequest = z.infer<typeof RuleLoadRequestSchema>;