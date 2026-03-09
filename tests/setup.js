"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const agent_registry_1 = require("@/agents/agent-registry");
/**
 * Creates a deterministic test context with unique IDs
 * Uses timestamp and random suffix for uniqueness
 */
global.createTestContext = () => ({
    runId: `test-run-${Date.now()}`,
    agentId: `test-agent-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date()
});
// Clean up singletons after each test to prevent test pollution
afterEach(() => {
    // Clear agent registry
    const stats = agent_registry_1.agentRegistry.getStats();
    if (stats.total > 0) {
        agent_registry_1.agentRegistry.getAll().forEach(agent => {
            agent_registry_1.agentRegistry.unregister(agent.getId());
        });
    }
});
//# sourceMappingURL=setup.js.map