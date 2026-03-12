import { z } from 'zod';

export const AgentModeSchema = z.enum(['primary', 'subagent']);

export const AgentToolsSchema = z.union([
  z.boolean(),
  z.literal('ask'),
  z.literal('auto'),
]);

export const PermissionLevelSchema = z.enum(['none', 'read', 'write', 'admin']);

export const PermissionSchema = z.object({
  resource: z.string(),
  level: PermissionLevelSchema,
  conditions: z.array(z.string()).optional(),
});

export const AgentCapabilitiesSchema = z.object({
  canSpawnAgents: z.boolean(),
  canModifyCode: z.boolean(),
  canAccessExternal: z.boolean(),
  canExecuteShell: z.boolean(),
  maxParallelTasks: z.number().int().min(1),
  preferredModel: z.enum(['fast', 'balanced', 'powerful']),
  taskTimeoutMinutes: z.number().int().min(1),
});

export const MetaPromptSchema = z.object({
  agentType: z.string(),
  systemPrompt: z.string(),
  taskPrompts: z.record(z.string()),
  defaultTools: z.array(z.string()),
  responseFormat: z.string(),
  examples: z.array(
    z.object({
      input: z.string(),
      output: z.string(),
      context: z.string().optional(),
    })
  ),
});

export const AgentConfigSchema = z.object({
  id: z.string(),
  type: z.string(),
  name: z.string(),
  description: z.string(),
  mode: AgentModeSchema.default('subagent'),
  tools: AgentToolsSchema.default(true),
  capabilities: AgentCapabilitiesSchema,
  permissions: z.array(PermissionSchema),
  metaPrompt: MetaPromptSchema,
  customConfig: z.record(z.unknown()).optional(),
});

export const SwarmConfigSchema = z.object({
  version: z.string(),
  agents: z.array(AgentConfigSchema),
  settings: z
    .object({
      defaultMode: AgentModeSchema.default('subagent'),
      defaultTools: AgentToolsSchema.default(true),
      maxAgents: z.number().int().min(1).default(10),
      hotReload: z.boolean().default(true),
    })
    .optional(),
});

export type AgentMode = z.infer<typeof AgentModeSchema>;
export type AgentTools = z.infer<typeof AgentToolsSchema>;
export type PermissionLevel = z.infer<typeof PermissionLevelSchema>;
export type Permission = z.infer<typeof PermissionSchema>;
export type AgentCapabilities = z.infer<typeof AgentCapabilitiesSchema>;
export type MetaPrompt = z.infer<typeof MetaPromptSchema>;
export type AgentConfig = z.infer<typeof AgentConfigSchema>;
export type SwarmConfig = z.infer<typeof SwarmConfigSchema>;

export function validateAgentConfig(data: unknown): AgentConfig {
  return AgentConfigSchema.parse(data);
}

export function validateSwarmConfig(data: unknown): SwarmConfig {
  return SwarmConfigSchema.parse(data);
}

export function safeValidateAgentConfig(
  data: unknown
): { success: true; data: AgentConfig } | { success: false; error: z.ZodError } {
  const result = AgentConfigSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

export function safeValidateSwarmConfig(
  data: unknown
): { success: true; data: SwarmConfig } | { success: false; error: z.ZodError } {
  const result = SwarmConfigSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}
