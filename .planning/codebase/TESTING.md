# Testing Patterns

**Analysis Date:** 2026-03-09

## Test Framework

**Runner:**
- Jest 29.7.0 (configured in `package.json`)
- Config: Not detected (no `jest.config.*` file found)
- Likely using Jest defaults

**Assertion Library:**
- Jest built-in assertions (expect)
- TypeScript types via `@types/jest` 29.5.0

**Run Commands:**
```bash
npm test              # Run all tests (uses Jest)
npm run lint          # Run ESLint
```

## Test File Organization

**Location:**
- No test files detected in the codebase
- Tests excluded from TypeScript compilation: `"exclude": ["node_modules", "dist", "tests"]` in `tsconfig.json`
- No `tests/` or `__tests__/` directories found

**Naming:**
- Not applicable - no tests exist
- Standard would be: `*.test.ts` or `*.spec.ts`

**Structure:**
- Not established
- Recommendation based on project structure:
```
src/
├── agents/
│   ├── base-agent.ts
│   └── __tests__/           # Co-located tests
│       └── base-agent.test.ts
├── core/
│   └── orchestrator.ts
│   └── __tests__/
│       └── orchestrator.test.ts
```

## Test Structure

**Suite Organization:**
- No existing test examples
- Recommended pattern based on codebase style:

```typescript
import { AgentRegistry } from '../agent-registry';
import { BaseAgent, AgentConfig, Task } from '../base-agent';

describe('AgentRegistry', () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = new AgentRegistry();
  });

  afterEach(() => {
    // Cleanup if needed
  });

  describe('register', () => {
    it('should register an agent', () => {
      // Test implementation
    });
  });
});
```

**Patterns:**
- Use `beforeEach` for test setup
- Use `afterEach` for cleanup
- Group related tests with `describe` blocks

## Mocking

**Framework:** Jest built-in mocking

**Patterns:**
- No existing examples
- Recommended patterns for this codebase:

```typescript
// Mock the Logger to avoid console output
jest.mock('../../utils/logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }))
}));

// Mock external dependencies
jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => ({
    rest: {
      issues: {
        create: jest.fn().mockResolvedValue({ data: { number: 1 } })
      }
    }
  }))
}));
```

**What to Mock:**
- External API calls (GitHub, LLM APIs)
- Database connections
- File system operations
- Logger output in tests
- `EventEmitter` for orchestrator tests

**What NOT to Mock:**
- Internal utility functions being tested
- Data structures and pure functions
- Type definitions

## Fixtures and Factories

**Test Data:**
- No existing fixtures
- Recommended pattern:

```typescript
// factories/agent-factory.ts
export function createMockAgentConfig(overrides?: Partial<AgentConfig>): AgentConfig {
  return {
    id: `agent-${Date.now()}`,
    runId: `run-${Date.now()}`,
    role: 'frontend',
    model: 'gpt-4',
    apiUrl: 'https://api.openai.com/v1',
    tools: ['react', 'typescript'],
    maxRetries: 5,
    ...overrides
  };
}

export function createMockTask(overrides?: Partial<Task>): Task {
  return {
    id: `task-${Date.now()}`,
    title: 'Test Task',
    description: 'Test description',
    status: 'pending',
    ...overrides
  };
}
```

**Location:**
- Recommended: `src/__tests__/fixtures/` or co-located `__tests__/fixtures/`

## Coverage

**Requirements:**
- No coverage target configured
- No coverage reports generated currently

**View Coverage:**
```bash
# Add to package.json scripts:
"test:coverage": "jest --coverage"

# Then run:
npm run test:coverage
```

## Test Types

**Unit Tests:**
- Scope: Individual classes and functions
- Target areas for testing:
  - `AgentRegistry` - registration, lookup, filtering
  - `Orchestrator` - run lifecycle, task execution
  - `WorktreeManager` - git operations (mock execSync)
  - `Logger` - log level filtering

**Integration Tests:**
- Scope: Module interactions
- Target areas:
  - Agent spawning and execution flow
  - GitHub sync operations
  - Database persistence layer
  - API route handlers

**E2E Tests:**
- Not used
- Could be added for CLI commands

## Critical Areas Needing Tests

**High Priority:**
1. `/home/zurybr/workspaces/swarm-cli/src/agents/agent-registry.ts`
   - `register()`, `get()`, `getByRun()`, `getStats()`

2. `/home/zurybr/workspaces/swarm-cli/src/core/orchestrator.ts`
   - `createRun()`, `spawnAgent()`, `executeTask()`
   - `ralphLoop()` retry logic

3. `/home/zurybr/workspaces/swarm-cli/src/github-sync/worktree-manager.ts`
   - Worktree creation, removal, merge operations

**Medium Priority:**
1. `/home/zurybr/workspaces/swarm-cli/src/github-sync/github-client.ts`
   - GitHub API wrapper methods

2. `/home/zurybr/workspaces/swarm-cli/src/utils/config-loader.ts`
   - Configuration parsing

## Common Patterns

**Async Testing:**
```typescript
it('should create a run', async () => {
  const orchestrator = new Orchestrator();
  const run = await orchestrator.createRun('test spec');

  expect(run).toBeDefined();
  expect(run.id).toMatch(/^run-\d+/);
  expect(run.status).toBe('pending');
});
```

**Error Testing:**
```typescript
it('should handle agent not found', async () => {
  const result = await orchestrator.executeTask('invalid-run', 'invalid-agent', task);

  expect(result.success).toBe(false);
  expect(result.error).toContain('not found');
});
```

**Event Testing:**
```typescript
it('should emit run:created event', async () => {
  const orchestrator = new Orchestrator();
  const mockListener = jest.fn();

  orchestrator.on('run:created', mockListener);
  await orchestrator.createRun('test spec');

  expect(mockListener).toHaveBeenCalledTimes(1);
  expect(mockListener.mock.calls[0][0]).toHaveProperty('id');
});
```

## Testing Dependencies

**Installed:**
- `jest` 29.7.0
- `@types/jest` 29.5.0

**Recommended Additions:**
```json
{
  "devDependencies": {
    "ts-jest": "^29.1.0",
    "jest-mock-extended": "^3.0.0"
  }
}
```

## Jest Configuration Recommendation

Create `jest.config.js`:
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
};
```

---

*Testing analysis: 2026-03-09*
