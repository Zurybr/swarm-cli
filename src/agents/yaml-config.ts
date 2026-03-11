import * as fs from 'fs';
import * as path from 'path';
import { parse as parseYaml } from 'yaml';
import { AgencyAgent } from '../definitions/agency-agents';

/**
 * Load agent configuration from YAML file
 * Supports both .yaml and .yml extensions
 */
export function loadYamlConfig(filePath: string): Partial<AgencyAgent> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`YAML config file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const config = parseYaml(content);

  if (!config || typeof config !== 'object') {
    throw new Error(`Invalid YAML format in: ${filePath}`);
  }

  return validateAgentConfig(config as Record<string, unknown>);
}

/**
 * Validate and transform raw YAML config to AgencyAgent partial
 */
function validateAgentConfig(config: Record<string, unknown>): Partial<AgencyAgent> {
  const requiredFields = ['name', 'description', 'systemPrompt'];
  const missing = requiredFields.filter(f => !config[f]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }

  return {
    id: config.id as string || generateAgentId(config.name as string),
    name: config.name as string,
    division: config.division as string || 'Custom',
    specialty: config.specialty as string || 'custom',
    description: config.description as string,
    personality: config.systemPrompt as string || config.personality as string,
    tools: Array.isArray(config.tools) ? config.tools as string[] : [],
    deliverables: Array.isArray(config.deliverables) ? config.deliverables as string[] : [],
    workflow: Array.isArray(config.workflow) ? config.workflow as string[] : [],
    successMetrics: Array.isArray(config.successMetrics) ? config.successMetrics as string[] : [],
    triggers: Array.isArray(config.triggers) ? config.triggers as string[] : [],
    isDefault: config.isDefault as boolean || false
  };
}

/**
 * Generate agent ID from name
 */
function generateAgentId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Find YAML config file with .yaml or .yml extension
 */
export function findYamlConfig(basePath: string): string | null {
  const extensions = ['.yaml', '.yml'];
  
  for (const ext of extensions) {
    const fullPath = basePath + ext;
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }
  
  return null;
}

/**
 * Load agent from config file (supports both JSON and YAML)
 */
export function loadAgentConfig(filePath: string): Partial<AgencyAgent> {
  const ext = path.extname(filePath).toLowerCase();
  
  if (ext === '.yaml' || ext === '.yml') {
    return loadYamlConfig(filePath);
  }
  
  if (ext === '.json') {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content) as Partial<AgencyAgent>;
  }
  
  throw new Error(`Unsupported config format: ${ext}. Use .yaml, .yml, or .json`);
}
