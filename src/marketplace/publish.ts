import * as fs from 'fs';
import * as path from 'path';
import { AgentMetadata, registerAgent } from './registry';

export interface PublishOptions {
  name?: string;
  version?: string;
  description?: string;
  author?: string;
  tags?: string[];
}

function validateAgentContent(content: string): void {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);
  
  if (!match) {
    throw new Error('Invalid agent format: file must start with YAML frontmatter');
  }

  const [, yamlStr] = match;
  const requiredFields = ['name', 'version', 'description', 'author'];
  
  for (const field of requiredFields) {
    if (!yamlStr.includes(`${field}:`)) {
      throw new Error(`Missing required field in frontmatter: ${field}`);
    }
  }

  const body = match[2].trim();
  if (body.length < 10) {
    throw new Error('Agent content is too short (minimum 10 characters)');
  }
}

function parseExistingFrontmatter(content: string): Record<string, string> {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n/;
  const match = content.match(frontmatterRegex);
  
  if (!match) return {};
  
  const yamlStr = match[1];
  const metadata: Record<string, string> = {};
  
  for (const line of yamlStr.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();
      metadata[key] = value;
    }
  }
  
  return metadata;
}

export function publishAgent(
  filePath: string,
  options: PublishOptions = {}
): AgentMetadata {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Agent file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  validateAgentContent(content);

  const existingMeta = parseExistingFrontmatter(content);
  
  const updatedContent = updateFrontmatter(content, {
    name: options.name || existingMeta.name,
    version: options.version || existingMeta.version || '1.0.0',
    description: options.description || existingMeta.description,
    author: options.author || existingMeta.author,
    tags: options.tags?.join(', ') || existingMeta.tags || '',
  });

  const tempPath = filePath + '.tmp';
  fs.writeFileSync(tempPath, updatedContent);
  
  try {
    const metadata = registerAgent(tempPath);
    fs.unlinkSync(tempPath);
    
    return metadata;
  } catch (error) {
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
    throw error;
  }
}

function updateFrontmatter(
  content: string,
  updates: Record<string, string>
): string {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);
  
  if (!match) {
    throw new Error('Invalid agent format');
  }

  const [, yamlStr, body] = match;
  const lines = yamlStr.split('\n');
  const updatedLines: string[] = [];
  const seenKeys = new Set<string>();

  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      seenKeys.add(key);
      
      if (updates[key] !== undefined) {
        updatedLines.push(`${key}: ${updates[key]}`);
      } else {
        updatedLines.push(line);
      }
    } else {
      updatedLines.push(line);
    }
  }

  for (const [key, value] of Object.entries(updates)) {
    if (!seenKeys.has(key)) {
      updatedLines.push(`${key}: ${value}`);
    }
  }

  const newYaml = updatedLines.join('\n');
  return `---\n${newYaml}\n---\n${body}`;
}

export function createAgentTemplate(name: string): string {
  const template = `---
name: ${name}
version: 1.0.0
description: A custom agent for Swarm CLI
author: 
tags: general, custom
createdAt: ${new Date().toISOString()}
---

## Agent Prompt

Describe your agent's purpose and behavior here.

## Capabilities

- Capability 1
- Capability 2

## Usage

Describe how to use this agent.

`;

  return template;
}
