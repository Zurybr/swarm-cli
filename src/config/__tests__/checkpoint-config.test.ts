import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  getAutoModeConfig,
  isAutoModeEnabled,
  shouldAutoAdvanceCheckpoint,
  shouldAutoSelectFirst,
  canAutoApproveHumanAction,
  getCheckpointTimeout,
} from '../checkpoint-config.js';

jest.unmock('../checkpoint-config.js');

describe('Checkpoint Config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.SWARM_AUTO_MODE_ENABLED;
    delete process.env.SWARM_AUTO_ADVANCE;
    delete process.env.SWARM_AUTO_SELECT_FIRST;
    delete process.env.SWARM_CHECKPOINT_TIMEOUT;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should have auto-mode disabled by default', () => {
    expect(isAutoModeEnabled()).toBe(false);
  });

  it('should have default timeout of 24 hours', () => {
    expect(getCheckpointTimeout()).toBe(86400000);
  });

  it('should not auto-advance by default', () => {
    expect(shouldAutoAdvanceCheckpoint()).toBe(false);
  });

  it('should not auto-select first option by default', () => {
    expect(shouldAutoSelectFirst()).toBe(false);
  });

  it('should never auto-approve human-action for security', () => {
    expect(canAutoApproveHumanAction()).toBe(false);
  });

  it('should return full auto-mode config', () => {
    const config = getAutoModeConfig();
    
    expect(config).toHaveProperty('enabled');
    expect(config).toHaveProperty('autoAdvance');
    expect(config).toHaveProperty('autoSelectFirst');
    expect(config).toHaveProperty('allowAutoSecrets');
    expect(config).toHaveProperty('timeout');
  });
});
