export interface TestContext {
    runId: string;
    agentId: string;
    timestamp: Date;
}
declare global {
    function createTestContext(): TestContext;
}
//# sourceMappingURL=setup.d.ts.map