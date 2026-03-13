import { loadClientConfig, type ClientConfig, type AutoModeConfig } from './client-config.js';

const DEFAULT_AUTO_MODE: AutoModeConfig = {
  enabled: false,
  autoAdvance: false,
  autoSelectFirst: false,
  allowAutoSecrets: false,
  timeout: 86400000, // 24 hours
};

export function getAutoModeConfig(): AutoModeConfig {
  const config = loadClientConfig();
  return config.autoMode || DEFAULT_AUTO_MODE;
}

export function isAutoModeEnabled(): boolean {
  return getAutoModeConfig().enabled;
}

export function shouldAutoAdvanceCheckpoint(): boolean {
  const cfg = getAutoModeConfig();
  return cfg.enabled && cfg.autoAdvance;
}

export function shouldAutoSelectFirst(): boolean {
  const cfg = getAutoModeConfig();
  return cfg.enabled && cfg.autoSelectFirst;
}

export function canAutoApproveHumanAction(): boolean {
  const cfg = getAutoModeConfig();
  // NEVER auto-approve human-action for security
  return false;
}

export function getCheckpointTimeout(): number {
  return getAutoModeConfig().timeout;
}