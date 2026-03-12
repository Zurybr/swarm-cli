import * as chokidar from 'chokidar';
import {
  getConfigPaths,
  reloadConfig,
  setConfigPaths,
  loadAgentsFromMarkdown,
  mergeConfigs,
  getConfig,
  getAgent,
  getAgentByType,
  getAllAgents,
  getAgentsByMode,
  loadSwarmConfig,
  loadSwarmConfigSafe,
} from './agent-config';
import {
  AgentConfig,
  SwarmConfig,
  AgentMode,
  AgentTools,
  validateAgentConfig,
  validateSwarmConfig,
  safeValidateAgentConfig,
  safeValidateSwarmConfig,
} from './agent-schema';
import { loadAgentMarkdownFiles, parseMarkdownWithFrontmatter, AgentMarkdownFile } from './agent-loader';

let watcher: chokidar.FSWatcher | null = null;
let watchCallbacks: Array<(event: 'change' | 'add' | 'unlink', path: string) => void> = [];

export function initConfig(configPath?: string, agentsDir?: string): void {
  const paths = getConfigPaths();
  setConfigPaths(configPath || paths.configPath, agentsDir || paths.agentsDir);
}

export function startWatching(onChange?: () => void): void {
  if (watcher) {
    return;
  }

  const { configPath, agentsDir } = getConfigPaths();

  watcher = chokidar.watch([configPath, agentsDir], {
    persistent: true,
    ignoreInitial: true,
  });

  watcher.on('change', (path) => {
    reloadConfig();
    watchCallbacks.forEach((cb) => cb('change', path));
    onChange?.();
  });

  watcher.on('add', (path) => {
    reloadConfig();
    watchCallbacks.forEach((cb) => cb('add', path));
    onChange?.();
  });

  watcher.on('unlink', (path) => {
    reloadConfig();
    watchCallbacks.forEach((cb) => cb('unlink', path));
    onChange?.();
  });
}

export function stopWatching(): void {
  if (watcher) {
    watcher.close();
    watcher = null;
  }
}

export function onConfigChange(callback: (event: 'change' | 'add' | 'unlink', path: string) => void): void {
  watchCallbacks.push(callback);
}

export {
  setConfigPaths,
  getConfigPaths,
  getConfig,
  getAgent,
  getAgentByType,
  getAllAgents,
  getAgentsByMode,
  loadSwarmConfig,
  loadSwarmConfigSafe,
  loadAgentsFromMarkdown,
  mergeConfigs,
  reloadConfig,
  loadAgentMarkdownFiles,
  parseMarkdownWithFrontmatter,
  validateAgentConfig,
  validateSwarmConfig,
  safeValidateAgentConfig,
  safeValidateSwarmConfig,
  type AgentConfig,
  type SwarmConfig,
  type AgentMode,
  type AgentTools,
  type AgentMarkdownFile,
};
