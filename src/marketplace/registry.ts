import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface AgentMetadata {
  name: string;
  version: string;
  description: string;
  author: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface MarketplaceAgent {
  metadata: AgentMetadata;
  content: string;
}

export interface RegistryIndex {
  version: string;
  updatedAt: string;
  agents: AgentMetadata[];
}

function getRegistryPath(): string {
  return path.join(os.homedir(), '.swarm', 'agents');
}

function getIndexPath(): string {
  return path.join(getRegistryPath(), 'index.json');
}

function ensureRegistryExists(): void {
  const registryPath = getRegistryPath();
  if (!fs.existsSync(registryPath)) {
    fs.mkdirSync(registryPath, { recursive: true });
  }
  if (!fs.existsSync(getIndexPath())) {
    const initialIndex: RegistryIndex = {
      version: '1.0.0',
      updatedAt: new Date().toISOString(),
      agents: [],
    };
    fs.writeFileSync(getIndexPath(), JSON.stringify(initialIndex, null, 2));
  }
}

function parseYamlFrontmatter(content: string): { metadata: Record<string, unknown>; body: string } {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);
  
  if (!match) {
    throw new Error('Invalid agent format: missing YAML frontmatter');
  }

  const [, yamlStr, body] = match;
  const metadata: Record<string, unknown> = {};
  
  for (const line of yamlStr.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();
      metadata[key] = value;
    }
  }

  return { metadata, body };
}

function parseAgentContent(filePath: string): MarketplaceAgent {
  const content = fs.readFileSync(filePath, 'utf-8');
  const { metadata, body } = parseYamlFrontmatter(content);

  const agentMetadata: AgentMetadata = {
    name: metadata.name as string,
    version: metadata.version as string,
    description: metadata.description as string,
    author: metadata.author as string,
    tags: (metadata.tags as string)?.split(',').map(t => t.trim()) || [],
    createdAt: (metadata.createdAt as string) || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return { metadata: agentMetadata, content: body };
}

export function registerAgent(agentPath: string): AgentMetadata {
  ensureRegistryExists();
  
  if (!fs.existsSync(agentPath)) {
    throw new Error(`Agent file not found: ${agentPath}`);
  }

  const agent = parseAgentContent(agentPath);
  const agentFileName = `${agent.metadata.name}.md`;
  const destPath = path.join(getRegistryPath(), agentFileName);

  fs.copyFileSync(agentPath, destPath);

  const index = getIndex();
  const existingIdx = index.agents.findIndex(a => a.name === agent.metadata.name);
  
  if (existingIdx >= 0) {
    index.agents[existingIdx] = agent.metadata;
  } else {
    index.agents.push(agent.metadata);
  }
  
  index.updatedAt = new Date().toISOString();
  saveIndex(index);

  return agent.metadata;
}

export function getIndex(): RegistryIndex {
  ensureRegistryExists();
  const indexPath = getIndexPath();
  const content = fs.readFileSync(indexPath, 'utf-8');
  return JSON.parse(content);
}

function saveIndex(index: RegistryIndex): void {
  fs.writeFileSync(getIndexPath(), JSON.stringify(index, null, 2));
}

export function getAgent(name: string): MarketplaceAgent | null {
  ensureRegistryExists();
  const agentPath = path.join(getRegistryPath(), `${name}.md`);
  
  if (!fs.existsSync(agentPath)) {
    return null;
  }

  return parseAgentContent(agentPath);
}

export function listAgents(): AgentMetadata[] {
  return getIndex().agents;
}

export function searchAgents(query: string): AgentMetadata[] {
  const index = getIndex();
  const lowerQuery = query.toLowerCase();
  
  return index.agents.filter(agent => 
    agent.name.toLowerCase().includes(lowerQuery) ||
    agent.description.toLowerCase().includes(lowerQuery) ||
    agent.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
  );
}

export function uninstallAgent(name: string): boolean {
  const agentPath = path.join(getRegistryPath(), `${name}.md`);
  
  if (!fs.existsSync(agentPath)) {
    return false;
  }

  fs.unlinkSync(agentPath);

  const index = getIndex();
  index.agents = index.agents.filter(a => a.name !== name);
  index.updatedAt = new Date().toISOString();
  saveIndex(index);

  return true;
}

export function getRegistryPathFn(): string {
  return getRegistryPath();
}
