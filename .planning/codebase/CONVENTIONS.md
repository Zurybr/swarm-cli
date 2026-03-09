# Coding Conventions

**Analysis Date:** 2026-03-09

## Naming Patterns

**Files:**
- Use kebab-case for filenames: `base-agent.ts`, `agent-registry.ts`, `worktree-manager.ts`
- Index files for entry points: `index.ts` in `/src/cli/`, `/src/backend/`
- Barrel exports for module boundaries

**Classes:**
- PascalCase with descriptive names: `BaseAgent`, `AgentRegistry`, `Orchestrator`, `WorktreeManager`
- Abstract base classes prefixed with `Base`: `BaseAgent`
- Service classes use descriptive suffixes: `GitHubClient`, `SQLiteConnection`, `ProjectSync`

**Interfaces:**
- PascalCase with descriptive names: `AgentConfig`, `AgentResult`, `Task`, `Run`
- Config interfaces use `Config` suffix: `AgentConfig`, `OrchestratorConfig`
- Result interfaces use `Result` suffix: `AgentResult`

**Variables:**
- camelCase for variables and functions: `agentRegistry`, `createRun`, `executeTask`
- Private class fields use underscore prefix (not observed; use `private` keyword)
- Constants use UPPER_SNAKE_CASE for enums: `LogLevel.DEBUG`, `LogLevel.INFO`

**Types:**
- Union types for status enums: `'pending' | 'in_progress' | 'completed' | 'failed'`
- String literal types for fixed values
- Optional properties use `?`: `apiKey?: string`, `metadata?: Record<string, any>`

## Code Style

**Formatting:**
- No explicit formatter configured (no Prettier config found)
- 2-space indentation observed
- Semicolons required
- Single quotes for strings

**Linting:**
- ESLint configured in `package.json`: `"lint": "eslint src/"`
- No custom ESLint config file detected

**TypeScript Configuration:**
- Target: ES2022
- Module: CommonJS
- Strict mode enabled
- Source maps and declarations generated

## Import Organization

**Order:**
1. Node.js built-in modules: `import { EventEmitter } from 'events'`
2. Third-party dependencies: `import { Command } from 'commander'`
3. Internal modules (relative paths): `import { Logger } from '../utils/logger'`

**Path Aliases:**
- Not configured - uses relative imports only
- Import depth: typically `../../` for cross-module imports

**Example pattern:**
```typescript
import { Router, Request, Response } from 'express';
import { agentRegistry } from '../../../agents/agent-registry';
import { Logger } from '../../../utils/logger';
```

## Error Handling

**Patterns:**
- Try-catch blocks with typed error handling:
```typescript
try {
  const result = await agent.execute(task);
} catch (error) {
  logger.error(`Iteration ${iteration} threw exception`, error);
  lastResult = {
    success: false,
    error: `Exception: ${error instanceof Error ? error.message : String(error)}`
  };
}
```

- Error propagation through result objects: `AgentResult` with `success` boolean and `error` string
- Graceful degradation with null returns for lookup failures

**Error Types:**
- Use `Error` class for exceptions
- Convert unknown errors to strings: `error instanceof Error ? error.message : String(error)`

## Logging

**Framework:** Custom `Logger` class in `/home/zurybr/workspaces/swarm-cli/src/utils/logger.ts`

**Patterns:**
```typescript
const logger = new Logger('ContextName');

logger.info(`Starting task: ${task.title}`, { taskId: task.id });
logger.warn(`Attempt ${attempt}/${retries} failed, retrying in ${delay}ms`, { error: lastError.message });
logger.error(`Failed to create run`, error);
```

**Log Levels:**
- DEBUG (0) - Development diagnostics
- INFO (1) - General operations
- WARN (2) - Recoverable issues
- ERROR (3) - Failures requiring attention

**Context Naming:**
- Use PascalCase context identifiers: `'AgentRegistry'`, `'Orchestrator'`, `'APIServer'`
- Match context to class/module name

## Comments

**When to Comment:**
- TODO markers for unimplemented features: `// TODO: Implement task listing from database`
- Section headers for organization: `// RALPH LOOP - if enabled, retry until success`
- Inline explanations for complex logic

**JSDoc/TSDoc:**
- Not extensively used
- Interface properties self-documenting via names

## Function Design

**Size:**
- Functions typically 10-30 lines
- Async/await preferred over raw promises

**Parameters:**
- Destructure options objects for named parameters:
```typescript
async spawnAgent(
  runId: string,
  agencyAgentId: string,
  modelConfig: { model: string; apiUrl: string; apiKey?: string }
)
```

**Return Values:**
- Explicit return types on public methods
- Nullable returns for lookups: `get(id: string): BaseAgent | undefined`
- Result objects for operations: `Promise<AgentResult>`

## Module Design

**Exports:**
- Named exports for classes and interfaces: `export class AgentRegistry`
- Type exports alongside implementations
- Singleton instances exported: `export const agentRegistry = new AgentRegistry()`

**Barrel Files:**
- Not heavily used; direct imports preferred

**Class Structure:**
```typescript
// 1. Properties (protected/private)
protected logger: Logger;
protected config: AgentConfig;

// 2. Constructor
constructor(config: AgentConfig) {
  this.config = { ...config, maxRetries: config.maxRetries || 5 };
  this.logger = new Logger(`Agent:${config.role}:${config.id}`);
}

// 3. Abstract methods (if applicable)
abstract execute(task: Task): Promise<AgentResult>;

// 4. Public methods
getStatus(): string { ... }

// 5. Protected methods
protected async beforeExecute(task: Task): Promise<void> { ... }
```

## Class Design Patterns

**Abstract Base Classes:**
```typescript
export abstract class BaseAgent {
  protected logger: Logger;
  protected config: AgentConfig;
  protected status: 'idle' | 'working' | 'completed' | 'failed' = 'idle';

  constructor(config: AgentConfig) {
    this.config = { ...config, maxRetries: config.maxRetries || 5 };
    this.logger = new Logger(`Agent:${config.role}:${config.id}`);
  }

  abstract execute(task: Task): Promise<AgentResult>;
}
```

**Singleton Pattern:**
```typescript
// Singleton instance
export const agentRegistry = new AgentRegistry();
```

**EventEmitter Extension:**
```typescript
export class Orchestrator extends EventEmitter {
  // Emit events for external subscribers
  this.emit('run:created', run);
}
```

## Configuration Patterns

**Environment-based:**
```typescript
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const configPath = process.env.SWARM_CONFIG || './config/default.yaml';
```

**Default Values:**
```typescript
this.config = {
  maxParallelAgents: config.maxParallelAgents || 10,
  defaultRetries: config.defaultRetries || 5,
  ralphLoopEnabled: config.ralphLoopEnabled ?? true,  // Use nullish coalescing for booleans
};
```

## Retry Logic Pattern

**Exponential Backoff:**
```typescript
protected async retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries: number = this.config.maxRetries || 5
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
      this.logger.warn(`Attempt ${attempt}/${retries} failed...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error(`Failed after ${retries} retries`);
}
```

---

*Convention analysis: 2026-03-09*
