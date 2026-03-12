import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  AgentMetadata,
  MarketplaceAgent,
  getAgent,
  getIndex,
  registerAgent,
} from './registry';

export interface InstallOptions {
  name?: string;
  version?: string;
  force?: boolean;
}

function getLocalAgentsPath(): string {
  return path.join(os.homedir(), '.swarm', 'agents', 'local');
}

function ensureLocalAgentsExists(): void {
  const localPath = getLocalAgentsPath();
  if (!fs.existsSync(localPath)) {
    fs.mkdirSync(localPath, { recursive: true });
  }
}

export async function installAgent(
  source: string,
  options: InstallOptions = {}
): Promise<AgentMetadata> {
  ensureLocalAgentsPath();
  
  let agent: MarketplaceAgent | null = null;
  let agentName: string;

  if (source.startsWith('http://') || source.startsWith('https://')) {
    throw new Error('Remote registry not yet supported. Use local file path.');
  } else if (fs.existsSync(source)) {
    const metadata = registerAgent(source);
    agentName = metadata.name;
    agent = getAgent(metadata.name);
  } else {
    const index = getIndex();
    const found = index.agents.find(a => a.name === source);
    
    if (!found) {
      throw new Error(`Agent not found in registry: ${source}`);
    }
    
    agentName = found.name;
    agent = getAgent(agentName);
  }

  if (!agent) {
    throw new Error(`Failed to retrieve agent: ${agentName}`);
  }

  const localPath = path.join(getLocalAgentsPath(), `${agentName}.md`);
  
  if (fs.existsSync(localPath) && !options.force) {
    throw new Error(`Agent already installed: ${agentName}. Use --force to reinstall.`);
  }

  const installContent = buildInstallContent(agent);
  fs.writeFileSync(localPath, installContent);

  return agent.metadata;
}

function ensureLocalAgentsPath(): void {
  const localPath = getLocalAgentsPath();
  if (!fs.existsSync(localPath)) {
    fs.mkdirSync(localPath, { recursive: true });
  }
}

function buildInstallContent(agent: MarketplaceAgent): string {
  const frontmatter = `---
name: ${agent.metadata.name}
version: ${agent.metadata.version}
description: ${agent.metadata.description}
author: ${agent.metadata.author}
tags: ${agent.metadata.tags.join(', ')}
installedAt: ${new Date().toISOString()}
---

`;
  return frontmatter + agent.content;
}

export function listInstalledAgents(): string[] {
  ensureLocalAgentsPath();
  const localPath = getLocalAgentsPath();
  const files = fs.readdirSync(localPath).filter(f => f.endsWith('.md'));
  return files.map(f => f.replace('.md', ''));
}

export function getInstalledAgent(name: string): MarketplaceAgent | null {
  const localPath = path.join(getLocalAgentsPath(), `${name}.md`);
  
  if (!fs.existsSync(localPath)) {
    return null;
  }

  const content = fs.readFileSync(localPath, 'utf-8');
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);
  
  if (!match) return null;

  const [, yamlStr] = match;
  const metadata: Record<string, string> = {};
  
  for (const line of yamlStr.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();
      metadata[key] = value;
    }
  }

  return {
    metadata: {
      name: metadata.name,
      version: metadata.version,
      description: metadata.description,
      author: metadata.author,
      tags: metadata.tags?.split(',').map(t => t.trim()) || [],
      createdAt: metadata.createdAt || metadata.installedAt,
      updatedAt: metadata.updatedAt || metadata.installedAt,
    },
    content: content,
  };
}

export function uninstallLocalAgent(name: string): boolean {
  const localPath = path.join(getLocalAgentsPath(), `${name}.md`);
  
  if (!fs.existsSync(localPath)) {
    return false;
  }

  fs.unlinkSync(localPath);
  return true;
}

export function getLocalAgentsPathFn(): string {
  return getLocalAgentsPath();
}
