# Swarm CLI - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Crear sistema CLI de orquestación de agentes que convierte specs en proyectos funcionales, con backend unificado, CLI dual y Web UI.

**Architecture:** Three-tier system (Frontend + CLI dual + Backend) con Mastra core, Symphony-style execution, GitHub sync bidireccional, y memoria híbrida configurable.

**Tech Stack:** TypeScript, Node.js 22+, Mastra, GitHub CLI, SQLite, BGE-M3, Express, WebSocket

---

## FASE 1: Setup Inicial y Core Backend

### Task 1: Estructura base del proyecto

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`

**Step 1: Crear package.json**

```json
{
  "name": "swarm-cli",
  "version": "0.1.0",
  "description": "Orquestación de agentes - Specs a proyectos funcionales",
  "main": "dist/index.js",
  "bin": {
    "swarm-cli": "dist/cli/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "ts-node src/backend/index.ts",
    "cli": "ts-node src/cli/index.ts",
    "test": "jest",
    "lint": "eslint src/"
  },
  "dependencies": {
    "@mastra/core": "^0.1.0",
    "commander": "^12.0.0",
    "express": "^4.18.0",
    "ws": "^8.16.0",
    "sqlite3": "^5.1.6",
    "@octokit/rest": "^20.0.0",
    "yaml": "^2.3.0",
    "chalk": "^5.3.0",
    "inquirer": "^9.2.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/express": "^4.17.0",
    "@types/ws": "^8.5.0",
    "typescript": "^5.3.0",
    "ts-node": "^10.9.0",
    "jest": "^29.7.0",
    "@types/jest": "^29.5.0",
    "eslint": "^8.56.0"
  },
  "engines": {
    "node": ">=22.0.0"
  },
  "license": "MIT"
}
```

**Step 2: Crear tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

**Step 3: Crear .gitignore**

```
node_modules/
dist/
*.log
.env
.env.local
data/
*.db
.DS_Store
.vscode/
.idea/
coverage/
```

**Step 4: Commit inicial**

```bash
git add package.json tsconfig.json .gitignore README.md LICENSE CHANGELOG.md AGENTS.md docs/
git commit -m "chore: initial project structure"
```

---

### Task 2: Configuración y utilidades base

**Files:**
- Create: `src/utils/config-loader.ts`
- Create: `src/utils/logger.ts`
- Create: `config/default.yaml`
- Create: `config/schema.json`

**Step 1: Implementar config-loader**

```typescript
// src/utils/config-loader.ts
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
```

**Step 2: Implementar logger**

```typescript
// src/utils/logger.ts
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export class Logger {
  constructor(private context: string, private level: LogLevel = LogLevel.INFO) {}

  debug(msg: string, meta?: any) {
    if (this.level <= LogLevel.DEBUG) this.log('DEBUG', msg, meta);
  }

  info(msg: string, meta?: any) {
    if (this.level <= LogLevel.INFO) this.log('INFO', msg, meta);
  }

  warn(msg: string, meta?: any) {
    if (this.level <= LogLevel.WARN) this.log('WARN', msg, meta);
  }

  error(msg: string, meta?: any) {
    if (this.level <= LogLevel.ERROR) this.log('ERROR', msg, meta);
  }

  private log(level: string, msg: string, meta?: any) {
    const timestamp = new Date().toISOString();
    const output = `[${timestamp}] [${level}] [${this.context}] ${msg}`;
    console.log(output, meta ? JSON.stringify(meta) : '');
  }
}

export const logger = new Logger('SwarmCLI');
```

**Step 3: Commit**

```bash
git add src/utils/ config/
git commit -m "feat: add config loader and logger utilities"
```

---

### Task 3: Persistencia SQLite base

**Files:**
- Create: `src/persistence/sqlite/connection.ts`
- Create: `src/persistence/sqlite/schema.sql`
- Create: `tests/persistence/sqlite.test.ts`

**Step 1: Implementar conexión SQLite**

```typescript
// src/persistence/sqlite/connection.ts
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { Logger } from '../../utils/logger';

const logger = new Logger('SQLite');

export class SQLiteConnection {
  private db: Database | null = null;

  constructor(private dbPath: string) {}

  async connect(): Promise<void> {
    this.db = await open({
      filename: this.dbPath,
      driver: sqlite3.Database
    });
    logger.info(`Connected to SQLite at ${this.dbPath}`);
    await this.initializeSchema();
  }

  async initializeSchema(): Promise<void> {
    const schema = `
      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        spec TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL,
        dependencies TEXT,
        agent_id TEXT,
        execution_mode TEXT,
        max_retries INTEGER DEFAULT 5,
        retry_count INTEGER DEFAULT 0,
        github_issue_id INTEGER,
        worktree_path TEXT,
        FOREIGN KEY (run_id) REFERENCES runs(id)
      );

      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        role TEXT NOT NULL,
        model TEXT NOT NULL,
        api_url TEXT NOT NULL,
        status TEXT NOT NULL,
        current_task_id TEXT,
        tools TEXT,
        FOREIGN KEY (run_id) REFERENCES runs(id)
      );
    `;
    await this.db?.exec(schema);
    logger.info('Schema initialized');
  }

  getDb(): Database {
    if (!this.db) throw new Error('Database not connected');
    return this.db;
  }

  async close(): Promise<void> {
    await this.db?.close();
    logger.info('Database connection closed');
  }
}
```

**Step 2: Commit**

```bash
git add src/persistence/
git commit -m "feat: add SQLite persistence layer"
```

---

## FASE 2: GitHub Sync y Worktrees

### Task 4: GitHub CLI Integration

**Files:**
- Create: `src/github-sync/github-client.ts`
- Create: `src/github-sync/issue-sync.ts`
- Modify: `src/utils/config-loader.ts` (añadir tipos GitHub)

**Step 1: Implementar cliente GitHub**

```typescript
// src/github-sync/github-client.ts
import { Octokit } from '@octokit/rest';
import { Logger } from '../utils/logger';

const logger = new Logger('GitHub');

export class GitHubClient {
  private octokit: Octokit;

  constructor(token: string) {
    this.octokit = new Octokit({ auth: token });
  }

  async createIssue(owner: string, repo: string, title: string, body: string, labels?: string[]) {
    const { data } = await this.octokit.rest.issues.create({
      owner,
      repo,
      title,
      body,
      labels
    });
    logger.info(`Created issue #${data.number}: ${title}`);
    return data;
  }

  async createProject(owner: string, repo: string, name: string) {
    const { data } = await this.octokit.rest.projects.createForRepo({
      owner,
      repo,
      name
    });
    logger.info(`Created project: ${name}`);
    return data;
  }

  async addIssueToProject(projectId: number, issueId: number) {
    await this.octokit.rest.projects.createCard({
      project_id: projectId,
      content_id: issueId,
      content_type: 'Issue'
    });
    logger.info(`Added issue ${issueId} to project ${projectId}`);
  }
}
```

**Step 2: Commit**

```bash
git add src/github-sync/
git commit -m "feat: add GitHub client integration"
```

---

### Task 5: Git Worktree Manager

**Files:**
- Create: `src/github-sync/worktree-manager.ts`
- Create: `tests/github-sync/worktree-manager.test.ts`

**Step 1: Implementar worktree manager**

```typescript
// src/github-sync/worktree-manager.ts
import { execSync } from 'child_process';
import * as path from 'path';
import { Logger } from '../utils/logger';

const logger = new Logger('Worktree');

export interface Worktree {
  path: string;
  branch: string;
  issueNumber: number;
}

export class WorktreeManager {
  constructor(private basePath: string) {}

  createWorktree(issueNumber: number, branchName: string): Worktree {
    const worktreePath = path.join(this.basePath, `.worktrees/issue-${issueNumber}`);
    
    try {
      // Create branch
      execSync(`git checkout -b ${branchName}`, { cwd: this.basePath });
      
      // Create worktree
      execSync(`git worktree add ${worktreePath} ${branchName}`, { cwd: this.basePath });
      
      logger.info(`Created worktree for issue #${issueNumber} at ${worktreePath}`);
      
      return {
        path: worktreePath,
        branch: branchName,
        issueNumber
      };
    } catch (error) {
      logger.error(`Failed to create worktree for issue #${issueNumber}`, error);
      throw error;
    }
  }

  removeWorktree(issueNumber: number): void {
    const worktreePath = path.join(this.basePath, `.worktrees/issue-${issueNumber}`);
    
    try {
      execSync(`git worktree remove ${worktreePath}`, { cwd: this.basePath });
      logger.info(`Removed worktree for issue #${issueNumber}`);
    } catch (error) {
      logger.error(`Failed to remove worktree for issue #${issueNumber}`, error);
      throw error;
    }
  }

  mergeWorktree(issueNumber: number, targetBranch: string = 'main'): void {
    const worktree = this.getWorktree(issueNumber);
    
    try {
      // Checkout target branch
      execSync(`git checkout ${targetBranch}`, { cwd: this.basePath });
      
      // Merge
      execSync(`git merge ${worktree.branch} --no-ff -m "Merge worktree for issue #${issueNumber}"`, { 
        cwd: this.basePath 
      });
      
      logger.info(`Merged worktree for issue #${issueNumber} into ${targetBranch}`);
    } catch (error) {
      logger.error(`Failed to merge worktree for issue #${issueNumber}`, error);
      throw error;
    }
  }

  private getWorktree(issueNumber: number): Worktree {
    const worktreePath = path.join(this.basePath, `.worktrees/issue-${issueNumber}`);
    return {
      path: worktreePath,
      branch: `issue-${issueNumber}`,
      issueNumber
    };
  }
}
```

**Step 2: Commit**

```bash
git add src/github-sync/worktree-manager.ts
git commit -m "feat: add git worktree manager"
```

---

## FASE 3: Agentes y Orquestación

### Task 6: Base Agent y Registry

**Files:**
- Create: `src/agents/base-agent.ts`
- Create: `src/agents/agent-registry.ts`
- Create: `src/core/orchestrator.ts`

**Step 1: Implementar base agent**

```typescript
// src/agents/base-agent.ts
import { Logger } from '../utils/logger';

export interface AgentConfig {
  id: string;
  runId: string;
  role: string;
  model: string;
  apiUrl: string;
  tools: string[];
}

export abstract class BaseAgent {
  protected logger: Logger;
  protected config: AgentConfig;
  protected status: 'idle' | 'working' | 'completed' | 'failed' = 'idle';

  constructor(config: AgentConfig) {
    this.config = config;
    this.logger = new Logger(`Agent:${config.role}:${config.id}`);
  }

  abstract execute(task: any): Promise<any>;

  getStatus(): string {
    return this.status;
  }

  getId(): string {
    return this.config.id;
  }
}
```

**Step 2: Implementar agent registry**

```typescript
// src/agents/agent-registry.ts
import { BaseAgent } from './base-agent';
import { Logger } from '../utils/logger';

const logger = new Logger('AgentRegistry');

export class AgentRegistry {
  private agents: Map<string, BaseAgent> = new Map();

  register(agent: BaseAgent): void {
    this.agents.set(agent.getId(), agent);
    logger.info(`Registered agent ${agent.getId()}`);
  }

  get(id: string): BaseAgent | undefined {
    return this.agents.get(id);
  }

  getAll(): BaseAgent[] {
    return Array.from(this.agents.values());
  }

  getByStatus(status: string): BaseAgent[] {
    return this.getAll().filter(a => a.getStatus() === status);
  }

  unregister(id: string): void {
    this.agents.delete(id);
    logger.info(`Unregistered agent ${id}`);
  }
}
```

**Step 3: Commit**

```bash
git add src/agents/ src/core/orchestrator.ts
git commit -m "feat: add base agent and registry"
```

---

## FASE 4: API Layer y CLI

### Task 7: API Express + WebSocket

**Files:**
- Create: `src/backend/api/server.ts`
- Create: `src/backend/api/routes/runs.ts`
- Create: `src/backend/api/websocket.ts`

**Step 1: Implementar servidor API**

```typescript
// src/backend/api/server.ts
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from './websocket';
import { runsRouter } from './routes/runs';
import { loadConfig } from '../../utils/config-loader';
import { Logger } from '../../utils/logger';

const logger = new Logger('APIServer');
const config = loadConfig();

export function startServer() {
  const app = express();
  const server = createServer(app);

  app.use(express.json());
  
  // Routes
  app.use('/api/runs', runsRouter);
  
  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // WebSocket
  const wss = new WebSocketServer(server);
  wss.initialize();

  server.listen(config.backend.port, () => {
    logger.info(`API server listening on port ${config.backend.port}`);
  });

  return server;
}
```

**Step 2: Commit**

```bash
git add src/backend/api/
git commit -m "feat: add API server with WebSocket"
```

---

### Task 8: CLI Base

**Files:**
- Create: `src/cli/index.ts`
- Create: `src/cli/human/interactive.ts`
- Create: `src/cli/ai/structured.ts`

**Step 1: Implementar CLI entry point**

```typescript
// src/cli/index.ts
import { Command } from 'commander';
import { interactiveMode } from './human/interactive';
import { structuredMode } from './ai/structured';
import { version } from '../../package.json';

const program = new Command();

program
  .name('swarm-cli')
  .description('Orquestación de agentes - Specs a proyectos funcionales')
  .version(version);

// Interactive mode (default)
program
  .command('interactive')
  .alias('i')
  .description('Modo interactivo para humanos')
  .action(interactiveMode);

// AI mode
program
  .command('ai')
  .description('Modo estructurado para IAs')
  .option('-c, --config <file>', 'Archivo de configuración')
  .action(structuredMode);

// Init command
program
  .command('init')
  .description('Inicializar proyecto')
  .requiredOption('--github <repo>', 'Repositorio GitHub (owner/repo)')
  .option('--specs <file>', 'Archivo de especificaciones')
  .action(async (options) => {
    console.log('Inicializando proyecto...', options);
    // TODO: Implement init
  });

program.parse();
```

**Step 2: Commit**

```bash
git add src/cli/
git commit -m "feat: add CLI base structure"
```

---

## FASE 5: Documentación y Finalización

### Task 9: Documentación Backend Completa

**Files:**
- Create: `docs/architecture/backend-implementation.md`

**Step 1: Crear documentación de implementación**

(Contenido detallado ya guardado en memoria - referirse a memoria `SWARM CLI BACKEND DOCUMENTATION`)

**Step 2: Commit**

```bash
git add docs/
git commit -m "docs: add backend implementation documentation"
```

---

### Task 10: Finalizar y Push

**Step 1: Verificar estructura**

```bash
ls -la
tree -L 2 -I node_modules
```

**Step 2: Commit final**

```bash
git add .
git commit -m "feat: complete phase 1 implementation structure"
```

**Step 3: Crear repositorio GitHub y push**

```bash
# Crear repo via gh CLI
gh repo create swarm-cli --public --description "Orquestación de agentes - Specs a proyectos funcionales"

# Push
git remote add origin https://github.com/Zurybr/swarm-cli.git
git push -u origin master
```

---

## Resumen de Fases

| Fase | Tareas | Focus |
|------|--------|-------|
| 1 | 1-3 | Setup, config, persistencia |
| 2 | 4-5 | GitHub sync, worktrees |
| 3 | 6 | Agentes, orquestación |
| 4 | 7-8 | API, CLI |
| 5 | 9-10 | Docs, finalización |

---

## Notas para Implementación

- Cada task debe tomar 2-5 minutos
- Usar TDD: test primero, luego implementación
- Commits frecuentes con mensajes descriptivos
- Revisar con `superpowers:subagent-driven-development` si se usa modo subagente
