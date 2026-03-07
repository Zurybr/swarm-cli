import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';

export interface Config {
  backend: {
    port: number;
    auth: { type: string; secret: string };
  };
  persistence: {
    sqlite: { path: string };
    vector: { type: string; dimensions: number };
    graph: { type: string; uri: string };
  };
  github: { syncInterval: number };
  embedding: { default: string; providers: Record<string, any> };
  agents: { maxParallel: number; defaultRetries: number };
}

export function loadConfig(): Config {
  const configPath = process.env.SWARM_CONFIG || './config/default.yaml';
  const content = fs.readFileSync(configPath, 'utf-8');
  return yaml.parse(content);
}
