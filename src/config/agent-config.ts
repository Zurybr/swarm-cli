import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import {
  AgentConfig,
  SwarmConfig,
  validateSwarmConfig,
  safeValidateSwarmConfig,
  AgentConfigSchema,
} from './agent-schema';
import { loadAgentMarkdownFiles } from './agent-loader';

let cachedConfig: SwarmConfig | null = null;
let configFilePath: string = '';
let agentsDirectory: string = '';

export function setConfigPaths(configPath: string, agentsDir: string): void {
  configFilePath = configPath;
  agentsDirectory = agentsDir;
  cachedConfig = null;
}

export function getConfigPaths(): { configPath: string; agentsDir: string } {
  return {
    configPath: configFilePath || path.join(process.cwd(), 'swarm.json'),
    agentsDir: agentsDirectory || path.join(process.cwd(), '.swarm', 'agents'),
  };
}

export function loadSwarmConfig(configPath?: string): SwarmConfig {
  const targetPath = configPath || getConfigPaths().configPath;

  if (!fs.existsSync(targetPath)) {
    throw new Error(`Config file not found: ${targetPath}`);
  }

  const content = fs.readFileSync(targetPath, 'utf-8');
  const ext = path.extname(targetPath).toLowerCase();

  let data: unknown;
  if (ext === '.yaml' || ext === '.yml') {
    data = yaml.parse(content);
  } else {
    data = JSON.parse(content);
  }

  return validateSwarmConfig(data);
}

export function loadSwarmConfigSafe(
  configPath?: string
): { success: true; data: SwarmConfig } | { success: false; error: Error } {
  const targetPath = configPath || getConfigPaths().configPath;

  if (!fs.existsSync(targetPath)) {
    return { success: false, error: new Error(`Config file not found: ${targetPath}`) };
  }

  try {
    const content = fs.readFileSync(targetPath, 'utf-8');
    const ext = path.extname(targetPath).toLowerCase();

    let data: unknown;
    if (ext === '.yaml' || ext === '.yml') {
      data = yaml.parse(content);
    } else {
      data = JSON.parse(content);
    }

    return safeValidateSwarmConfig(data);
  } catch (error) {
    return { success: false, error: error as Error };
  }
}

export function getConfig(forceReload = false): SwarmConfig {
  if (cachedConfig && !forceReload) {
    return cachedConfig;
  }

  cachedConfig = loadSwarmConfig();
  return cachedConfig;
}

export function getAgent(agentId: string): AgentConfig | undefined {
  const config = getConfig();
  return config.agents.find((a) => a.id === agentId);
}

export function getAgentByType(agentType: string): AgentConfig | undefined {
  const config = getConfig();
  return config.agents.find((a) => a.type === agentType);
}

export function getAllAgents(): AgentConfig[] {
  const config = getConfig();
  return config.agents;
}

export function getAgentsByMode(mode: 'primary' | 'subagent'): AgentConfig[] {
  const config = getConfig();
  return config.agents.filter((a) => a.mode === mode);
}

export function loadAgentsFromMarkdown(): AgentConfig[] {
  const { agentsDir } = getConfigPaths();
  const markdownFiles = loadAgentMarkdownFiles(agentsDir);

  return markdownFiles
    .map((file) => {
      const parsed = AgentConfigSchema.safeParse(file.frontmatter);
      if (parsed.success) {
        return parsed.data;
      }
      return null;
    })
    .filter((a): a is AgentConfig => a !== null);
}

export function mergeConfigs(jsonConfig: SwarmConfig, markdownAgents: AgentConfig[]): AgentConfig[] {
  const jsonAgents = jsonConfig.agents;
  const markdownById = new Map(markdownAgents.map((a) => [a.id, a]));
  const markdownByType = new Map(markdownAgents.map((a) => [a.type, a]));

  const merged = jsonAgents.map((jsonAgent) => {
    const markdownOverride = markdownById.get(jsonAgent.id) || markdownByType.get(jsonAgent.type);
    if (markdownOverride) {
      return { ...jsonAgent, ...markdownOverride };
    }
    return jsonAgent;
  });

  const jsonIds = new Set(jsonAgents.map((a) => a.id));
  const jsonTypes = new Set(jsonAgents.map((a) => a.type));

  for (const mdAgent of markdownAgents) {
    if (!jsonIds.has(mdAgent.id) && !jsonTypes.has(mdAgent.type)) {
      merged.push(mdAgent);
    }
  }

  return merged;
}

export function reloadConfig(): SwarmConfig {
  cachedConfig = null;
  return getConfig(true);
}
