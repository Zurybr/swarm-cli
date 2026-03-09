import { agentRegistry } from '@/agents/agent-registry';

// Global test utilities
export interface TestContext {
  runId: string;
  agentId: string;
  timestamp: Date;
}

declare global {
  function createTestContext(): TestContext;
}

/**
 * Creates a deterministic test context with unique IDs
 * Uses timestamp and random suffix for uniqueness
 */
global.createTestContext = (): TestContext => ({
  runId: `test-run-${Date.now()}`,
  agentId: `test-agent-${Math.random().toString(36).substr(2, 9)}`,
  timestamp: new Date()
});

// Clean up singletons after each test to prevent test pollution
afterEach(() => {
  // Clear agent registry
  const stats = agentRegistry.getStats();
  if (stats.total > 0) {
    agentRegistry.getAll().forEach(agent => {
      agentRegistry.unregister(agent.getId());
    });
  }
});
