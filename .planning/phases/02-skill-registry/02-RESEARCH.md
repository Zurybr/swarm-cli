# Phase 2: Skill Registry - Research

**Researched:** 2026-03-09
**Domain:** Agent Skill Registry with SQLite Persistence and CLI
**Confidence:** HIGH

## Summary

Phase 2 implements a central skill registry for agent capabilities with metadata management, versioning, and semantic search. The research identifies three core architectural patterns: (1) a metadata-first registry with progressive disclosure (loading full skill content only when needed), (2) SQLite FTS5 for fast full-text search with ranking, and (3) a layered storage approach separating lightweight discovery metadata from full skill definitions.

The existing codebase provides a solid foundation: the `AgentRegistry` class demonstrates registry patterns with Map-based storage, the `SQLiteConnection` provides persistence infrastructure, and the `SkillTestHarness` from Phase 1 shows the expected skill interface. The CLI framework (Commander) is already in place for adding skill commands.

**Primary recommendation:** Implement a two-tier registry: (1) an in-memory metadata index for fast discovery and (2) SQLite persistence with FTS5 for search. Use semantic versioning (semver) for skill versions. Support keyword-based search initially (FTS5), with vector semantic search as a future enhancement.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REQ-01 | Agent skill registry | Registry pattern from AgentRegistry; FTS5 for search; Metadata schema with name, description, schema, version |
| REQ-01 | Skills can be registered at runtime | CRUD operations via SkillRegistry class; SQLite persistence |
| REQ-01 | Versioned skill definitions | Semantic versioning (semver); version field in metadata |
| REQ-01 | Semantic search / category browsing | SQLite FTS5 full-text search; category/tags metadata field |
| REQ-01 | Persist to SQLite backend | Extend existing SQLiteConnection; skills table with FTS5 virtual table |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| sqlite3 | 5.1.6 | Database persistence | Already in project; FTS5 support built-in |
| semver | 7.x | Version parsing/comparison | Industry standard for semantic versioning |
| commander | 12.0.0 | CLI commands | Already in project for CLI framework |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | 3.x | Schema validation | Validate skill metadata at runtime |
| fuse.js | 7.x | Fuzzy search | Alternative to FTS5 for client-side search |

### Installation
```bash
npm install semver zod
npm install --save-dev @types/semver
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── skills/
│   ├── registry/
│   │   ├── skill-registry.ts       # Main registry class
│   │   ├── skill-store.ts          # SQLite persistence layer
│   │   └── search-index.ts         # FTS5 search implementation
│   ├── types/
│   │   └── skill.ts                # Skill interfaces and schemas
│   ├── schema/
│   │   └── skill-metadata.ts       # Zod schemas for validation
│   └── index.ts                    # Public API exports
├── cli/
│   └── commands/
│       └── skill-commands.ts       # skill register, list, search
└── persistence/
    └── sqlite/
        └── connection.ts           # EXTEND: Add skills table
```

### Pattern 1: Metadata-First Registry with Progressive Disclosure

**What:** Store lightweight metadata for all skills in memory for fast discovery, load full skill definitions only when needed.

**When to use:** When skill definitions are large but discovery needs to be fast. Prevents memory bloat with many skills.

**Example:**
```typescript
// Source: Anthropic Agent Skills pattern + LangGraph dynamic tool selection
// https://www.bishoylabib.com/posts/claude-skills-comprehensive-guide

interface SkillMetadata {
  name: string;
  description: string;
  version: string;           // semver
  category?: string;
  tags?: string[];
  schema?: SkillSchema;      // Input/output schemas
  author?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Skill {
  metadata: SkillMetadata;
  definition: SkillDefinition;  // Full skill implementation
}

class SkillRegistry {
  // Lightweight index - always in memory
  private metadataIndex: Map<string, SkillMetadata> = new Map();

  // Full skills - loaded on demand
  private skillStore: SkillStore;

  constructor(skillStore: SkillStore) {
    this.skillStore = skillStore;
  }

  // Fast discovery - only uses metadata
  async search(query: string): Promise<SkillMetadata[]> {
    const allMetadata = Array.from(this.metadataIndex.values());

    // Use FTS5 for full-text search
    const results = await this.skillStore.search(query);

    return results.map(r => this.metadataIndex.get(r.name)!);
  }

  // Full load - only when skill is needed
  async getSkill(name: string): Promise<Skill | undefined> {
    const metadata = this.metadataIndex.get(name);
    if (!metadata) return undefined;

    const definition = await this.skillStore.loadDefinition(name);
    if (!definition) return undefined;

    return { metadata, definition };
  }

  async register(skill: Skill): Promise<void> {
    // Validate metadata
    validateSkillMetadata(skill.metadata);

    // Store full skill
    await this.skillStore.save(skill);

    // Index metadata
    this.metadataIndex.set(skill.metadata.name, skill.metadata);
  }
}
```

### Pattern 2: SQLite FTS5 Full-Text Search

**What:** Use SQLite's built-in FTS5 extension for fast, ranked full-text search over skill descriptions.

**When to use:** When you need efficient text search with relevance ranking. FTS5 is built into SQLite 3.9+ (sqlite3 5.1.6 uses SQLite 3.40+).

**Example:**
```typescript
// Source: SQLite FTS5 documentation + TypeScript patterns
// https://sqlite.org/fts5.html
// https://www.sqlitetutorial.net/sqlite-full-text-search/

class SkillSearchIndex {
  constructor(private db: sqlite3.Database) {}

  async initialize(): Promise<void> {
    // Main skills table
    await this.run(`
      CREATE TABLE IF NOT EXISTS skills (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL,
        version TEXT NOT NULL,
        category TEXT,
        tags TEXT,  -- JSON array
        schema TEXT, -- JSON
        author TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // FTS5 virtual table for search
    await this.run(`
      CREATE VIRTUAL TABLE IF NOT EXISTS skills_fts USING fts5(
        name,
        description,
        content='skills',
        content_rowid='id'
      )
    `);

    // Triggers to keep FTS index in sync
    await this.run(`
      CREATE TRIGGER IF NOT EXISTS skills_fts_insert
      AFTER INSERT ON skills BEGIN
        INSERT INTO skills_fts(rowid, name, description)
        VALUES (new.rowid, new.name, new.description);
      END
    `);

    await this.run(`
      CREATE TRIGGER IF NOT EXISTS skills_fts_update
      AFTER UPDATE ON skills BEGIN
        UPDATE skills_fts SET
          name = new.name,
          description = new.description
        WHERE rowid = old.rowid;
      END
    `);

    await this.run(`
      CREATE TRIGGER IF NOT EXISTS skills_fts_delete
      AFTER DELETE ON skills BEGIN
        DELETE FROM skills_fts WHERE rowid = old.rowid;
      END
    `);
  }

  async search(query: string, limit: number = 10): Promise<SkillSearchResult[]> {
    // Sanitize query to prevent syntax errors
    const safeQuery = query.replace(/"/g, '""');

    const stmt = this.db.prepare(`
      SELECT
        s.id,
        s.name,
        s.description,
        s.version,
        s.category,
        s.tags,
        rank
      FROM skills_fts fts
      JOIN skills s ON s.rowid = fts.rowid
      WHERE skills_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `);

    return stmt.all(safeQuery, limit) as SkillSearchResult[];
  }

  // Prefix search for autocomplete
  async searchPrefix(prefix: string, limit: number = 5): Promise<SkillSearchResult[]> {
    const stmt = this.db.prepare(`
      SELECT
        s.id,
        s.name,
        s.description,
        s.version,
        rank
      FROM skills_fts fts
      JOIN skills s ON s.rowid = fts.rowid
      WHERE skills_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `);

    return stmt.all(`${prefix}*`, limit) as SkillSearchResult[];
  }

  private run(sql: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}
```

### Pattern 3: Semantic Versioning for Skills

**What:** Use semver (major.minor.patch) for skill versions to enable compatibility checking and updates.

**When to use:** All versioned skills. Enables "latest compatible version" resolution.

**Example:**
```typescript
// Source: Semver best practices
// https://semver.org/

import * as semver from 'semver';

interface VersionedSkill {
  name: string;
  version: string;  // e.g., "1.2.3"
}

class SkillVersionManager {
  // Check if a skill version satisfies a requirement
  // e.g., satisfies("1.2.3", "^1.0.0") => true
  satisfies(version: string, range: string): boolean {
    return semver.satisfies(version, range);
  }

  // Compare two versions
  // returns: -1 if v1 < v2, 0 if equal, 1 if v1 > v2
  compare(v1: string, v2: string): number {
    return semver.compare(v1, v2);
  }

  // Get the latest version from a list
  getLatest(versions: string[]): string | null {
    return semver.maxSatisfying(versions, '*');
  }

  // Validate version format
  isValid(version: string): boolean {
    return semver.valid(version) !== null;
  }

  // Check if update is compatible (same major version)
  isCompatibleUpdate(current: string, candidate: string): boolean {
    const currentMajor = semver.major(current);
    const candidateMajor = semver.major(candidate);
    return currentMajor === candidateMajor &&
           semver.gt(candidate, current);
  }
}
```

### Pattern 4: Skill Schema Definition

**What:** Define input/output schemas for skills to enable validation and composition (preparing for Phase 3).

**When to use:** All skills should have schemas for type safety and composition validation.

**Example:**
```typescript
// Source: LangGraph tool schema patterns + Zod validation
// https://langchain.com/docs/modules/agents/tools/

import { z } from 'zod';

// JSON Schema compatible definition
interface SkillSchema {
  input: JSONSchema;
  output: JSONSchema;
}

// Zod schemas for runtime validation
const SkillMetadataSchema = z.object({
  name: z.string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Name must be lowercase alphanumeric with hyphens'),
  description: z.string().min(10).max(500),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  category: z.enum([
    'security',
    'performance',
    'documentation',
    'testing',
    'general'
  ]).optional(),
  tags: z.array(z.string()).optional(),
  schema: z.object({
    input: z.record(z.any()),
    output: z.record(z.any())
  }).optional(),
  author: z.string().optional()
});

type SkillMetadata = z.infer<typeof SkillMetadataSchema>;

// Validate skill metadata
function validateSkillMetadata(metadata: unknown): SkillMetadata {
  return SkillMetadataSchema.parse(metadata);
}

// Example skill definition
const CodeReviewSkill = {
  metadata: {
    name: 'code-review',
    description: 'Analyzes code for issues and provides recommendations',
    version: '1.0.0',
    category: 'security',
    tags: ['security', 'review', 'code-quality'],
    schema: {
      input: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          language: { type: 'string' }
        },
        required: ['code']
      },
      output: {
        type: 'object',
        properties: {
          issues: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                severity: { enum: ['low', 'medium', 'high', 'critical'] },
                message: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }
};
```

### Pattern 5: CLI Command Structure

**What:** Extend existing Commander CLI with skill management commands.

**When to use:** All CLI interactions with the skill registry.

**Example:**
```typescript
// Source: Existing CLI pattern in src/cli/index.ts

import { Command } from 'commander';
import { SkillRegistry } from '../skills/registry/skill-registry';

export function registerSkillCommands(program: Command, registry: SkillRegistry): void {
  const skillCmd = program
    .command('skill')
    .description('Manage agent skills');

  // skill register
  skillCmd
    .command('register')
    .description('Register a new skill')
    .requiredOption('--name <name>', 'Skill name')
    .requiredOption('--description <desc>', 'Skill description')
    .requiredOption('--version <version>', 'Semantic version (e.g., 1.0.0)')
    .option('--category <cat>', 'Skill category')
    .option('--tags <tags>', 'Comma-separated tags')
    .option('--schema <file>', 'Path to schema JSON file')
    .action(async (options) => {
      const skill = {
        metadata: {
          name: options.name,
          description: options.description,
          version: options.version,
          category: options.category,
          tags: options.tags?.split(',').map((t: string) => t.trim())
        }
      };

      await registry.register(skill);
      console.log(`Registered skill: ${options.name}@${options.version}`);
    });

  // skill list
  skillCmd
    .command('list')
    .description('List all registered skills')
    .option('--category <cat>', 'Filter by category')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      let skills = await registry.getAllMetadata();

      if (options.category) {
        skills = skills.filter(s => s.category === options.category);
      }

      if (options.json) {
        console.log(JSON.stringify(skills, null, 2));
      } else {
        console.log('\nRegistered Skills:\n');
        skills.forEach(s => {
          console.log(`  ${s.name.padEnd(20)} ${s.version.padEnd(10)} ${s.category || 'general'}`);
          console.log(`    ${s.description.substring(0, 60)}...`);
        });
      }
    });

  // skill search
  skillCmd
    .command('search')
    .description('Search skills by description')
    .argument('<query>', 'Search query')
    .option('--limit <n>', 'Maximum results', '10')
    .action(async (query, options) => {
      const results = await registry.search(query, parseInt(options.limit));

      console.log(`\nFound ${results.length} skills matching "${query}":\n`);
      results.forEach((s, i) => {
        console.log(`${i + 1}. ${s.name}@${s.version}`);
        console.log(`   ${s.description}`);
        if (s.tags?.length) {
          console.log(`   Tags: ${s.tags.join(', ')}`);
        }
        console.log();
      });
    });

  // skill get
  skillCmd
    .command('get')
    .description('Get detailed information about a skill')
    .argument('<name>', 'Skill name')
    .action(async (name) => {
      const skill = await registry.getSkill(name);
      if (!skill) {
        console.error(`Skill not found: ${name}`);
        process.exit(1);
      }

      console.log(`\n${skill.metadata.name}@${skill.metadata.version}`);
      console.log(`Description: ${skill.metadata.description}`);
      console.log(`Category: ${skill.metadata.category || 'none'}`);
      console.log(`Tags: ${skill.metadata.tags?.join(', ') || 'none'}`);
      if (skill.metadata.schema) {
        console.log('Schema:', JSON.stringify(skill.metadata.schema, null, 2));
      }
    });
}
```

### Anti-Patterns to Avoid

- **Loading all skills into memory:** Use metadata-first pattern with lazy loading for full definitions.
- **Storing skills only in memory:** Skills must persist to SQLite for cross-session availability.
- **Ad-hoc versioning:** Use semver consistently, not custom version formats.
- **Synchronous database operations:** Always use async/await with sqlite3 to avoid blocking.
- **No schema validation:** Validate skill metadata at registration time using Zod.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Version parsing | Custom regex | `semver` library | Handles edge cases, ranges, comparison |
| Full-text search | LIKE queries | SQLite FTS5 | Indexed, ranked, fast search |
| Schema validation | Manual checks | Zod | Type inference, error messages, composable |
| CLI argument parsing | process.argv | Commander | Already in project, validation, help generation |
| SQL query building | String concatenation | Parameterized queries | Prevents SQL injection |

**Key insight:** The complexity in skill registries comes from search performance, version compatibility, and schema evolution. Established libraries handle edge cases (semver pre-releases, FTS5 query syntax, Zod refinements) that custom solutions miss.

## Common Pitfalls

### Pitfall 1: Blocking Database Operations
**What goes wrong:** Using synchronous SQLite calls in an async context blocks the event loop, causing poor performance.
**Why it happens:** sqlite3 supports both sync and async APIs; sync is tempting for "simple" operations.
**How to avoid:** Always use the Promise-based API or promisify callbacks. Wrap all DB operations in async functions.
**Warning signs:** High latency on skill operations; event loop lag warnings.

### Pitfall 2: FTS5 Query Syntax Errors
**What goes wrong:** User search queries contain FTS5 special characters (quotes, AND, OR) that cause syntax errors.
**Why it happens:** FTS5 has its own query syntax; raw user input isn't valid FTS5.
**How to avoid:** Sanitize queries by escaping quotes: `query.replace(/"/g, '""')`. Consider using `simple` tokenizer for user queries.
**Warning signs:** "fts5 syntax error" in logs; search returning no results for valid queries.

### Pitfall 3: Schema Migration on Skill Updates
**What goes wrong:** Updating a skill's schema breaks existing agents that depend on the old schema.
**Why it happens:** No versioning strategy for schema changes.
**How to avoid:** Use semver: major version bump for breaking schema changes. Store schema with version. Agents pin to specific major versions.
**Warning signs:** Agents failing after skill updates; "property undefined" errors.

### Pitfall 4: Memory Leak with Large Skill Definitions
**What goes wrong:** Loading all skill definitions into memory exhausts heap with many/large skills.
**Why it happens:** Registry keeps full skill objects in a Map.
**How to avoid:** Metadata-first pattern: only metadata in memory, load definitions on demand.
**Warning signs:** Memory usage growing with skill count; slow startup times.

### Pitfall 5: Race Conditions in Registration
**What goes wrong:** Concurrent registrations of the same skill cause duplicates or errors.
**Why it happens:** No transaction wrapping or uniqueness constraints.
**How to avoid:** Use UNIQUE constraint on name+version. Wrap register in transaction. Check existence before insert.
**Warning signs:** Duplicate skills in database; unique constraint errors.

## Code Examples

### Skill Registry Implementation

```typescript
// src/skills/registry/skill-registry.ts
import { Skill, SkillMetadata } from '../types/skill';
import { SkillStore } from './skill-store';
import { SkillSearchIndex } from './search-index';
import { SkillVersionManager } from './version-manager';
import { Logger } from '../../utils/logger';

export class SkillRegistry {
  private logger: Logger;
  private metadataIndex: Map<string, SkillMetadata> = new Map();
  private store: SkillStore;
  private searchIndex: SkillSearchIndex;
  private versionManager: SkillVersionManager;

  constructor(db: sqlite3.Database) {
    this.logger = new Logger('SkillRegistry');
    this.store = new SkillStore(db);
    this.searchIndex = new SkillSearchIndex(db);
    this.versionManager = new SkillVersionManager();
  }

  async initialize(): Promise<void> {
    await this.searchIndex.initialize();
    await this.loadMetadataIndex();
    this.logger.info(`Loaded ${this.metadataIndex.size} skills`);
  }

  async register(skill: Skill): Promise<void> {
    // Validate version format
    if (!this.versionManager.isValid(skill.metadata.version)) {
      throw new Error(`Invalid version: ${skill.metadata.version}`);
    }

    // Check for existing version
    const existing = this.metadataIndex.get(skill.metadata.name);
    if (existing) {
      const comparison = this.versionManager.compare(
        existing.version,
        skill.metadata.version
      );

      if (comparison === 0) {
        throw new Error(
          `Skill ${skill.metadata.name}@${skill.metadata.version} already exists`
        );
      }
    }

    // Save to database
    await this.store.save(skill);

    // Update in-memory index
    this.metadataIndex.set(skill.metadata.name, skill.metadata);

    this.logger.info(
      `Registered skill: ${skill.metadata.name}@${skill.metadata.version}`
    );
  }

  async getSkill(name: string, version?: string): Promise<Skill | undefined> {
    const metadata = this.metadataIndex.get(name);
    if (!metadata) return undefined;

    // If version specified, find matching version
    if (version && !this.versionManager.satisfies(metadata.version, version)) {
      // Load specific version from store
      return this.store.load(name, version);
    }

    const definition = await this.store.loadDefinition(name);
    if (!definition) return undefined;

    return { metadata, definition };
  }

  async search(query: string, limit: number = 10): Promise<SkillMetadata[]> {
    const results = await this.searchIndex.search(query, limit);
    return results
      .map(r => this.metadataIndex.get(r.name))
      .filter((m): m is SkillMetadata => m !== undefined);
  }

  getAllMetadata(): SkillMetadata[] {
    return Array.from(this.metadataIndex.values());
  }

  private async loadMetadataIndex(): Promise<void> {
    const allSkills = await this.store.loadAllMetadata();
    for (const metadata of allSkills) {
      this.metadataIndex.set(metadata.name, metadata);
    }
  }
}
```

### Skill Store with SQLite

```typescript
// src/skills/registry/skill-store.ts
import sqlite3 from 'sqlite3';
import { Skill, SkillMetadata } from '../types/skill';

export class SkillStore {
  constructor(private db: sqlite3.Database) {}

  async save(skill: Skill): Promise<void> {
    const { metadata } = skill;

    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT OR REPLACE INTO skills
         (id, name, description, version, category, tags, schema, author, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          `${metadata.name}@${metadata.version}`,
          metadata.name,
          metadata.description,
          metadata.version,
          metadata.category || null,
          metadata.tags ? JSON.stringify(metadata.tags) : null,
          metadata.schema ? JSON.stringify(metadata.schema) : null,
          metadata.author || null
        ],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async loadAllMetadata(): Promise<SkillMetadata[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT name, description, version, category, tags, schema, author, created_at, updated_at
         FROM skills
         ORDER BY name, version`,
        [],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows.map(row => ({
              ...row,
              tags: row.tags ? JSON.parse(row.tags) : undefined,
              schema: row.schema ? JSON.parse(row.schema) : undefined
            })));
          }
        }
      );
    });
  }

  async loadDefinition(name: string): Promise<SkillDefinition | undefined> {
    // Load from separate storage (e.g., filesystem or blob column)
    // For now, return empty definition
    return {};
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| In-memory only registries | Persistent with SQLite FTS5 | 2024 | Skills survive restarts; fast search |
| Custom version formats | Semantic versioning (semver) | Standard | Compatibility checking; update predictability |
| Loading all skills at startup | Metadata-first, lazy loading | 2024 | Faster startup; lower memory |
| LIKE queries for search | FTS5 full-text search | 2024 | Indexed search; relevance ranking |
| Ad-hoc metadata | JSON Schema/Zod validation | 2024 | Type safety; runtime validation |

**Deprecated/outdated:**
- **FTS3/FTS4:** Use FTS5 (SQLite 3.9+, better ranking, more features)
- **Manual version comparison:** Use semver library (handles pre-releases, ranges)
- **Synchronous DB access:** Use async/await throughout

## Open Questions

1. **Skill Definition Storage**
   - What we know: Metadata stored in SQLite, definitions could be large
   - What's unclear: Should definitions be in SQLite (BLOB) or filesystem?
   - Recommendation: Start with SQLite BLOB for simplicity; move to filesystem if definitions become large

2. **Multi-Version Support**
   - What we know: Skills have versions; semver enables range queries
   - What's unclear: Should registry keep all versions or only latest per major version?
   - Recommendation: Keep all versions; agents pin to specific versions for reproducibility

3. **Skill Dependencies**
   - What we know: Skills may depend on other skills (composability)
   - What's unclear: How to represent and validate dependencies?
   - Recommendation: Add `dependencies` field to metadata; validate at registration time

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.7.0 + ts-jest |
| Config file | `jest.config.ts` (from Phase 1) |
| Quick run command | `npm test -- --testPathPattern=skill` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-01 | Register skill with metadata | unit | `npm test -- skill-registry.test.ts` | No - Wave 0 |
| REQ-01 | Retrieve skill by name | unit | `npm test -- skill-registry.test.ts` | No - Wave 0 |
| REQ-01 | Search skills by description | unit | `npm test -- skill-search.test.ts` | No - Wave 0 |
| REQ-01 | Persist skills across restarts | integration | `npm test -- skill-persistence.test.ts` | No - Wave 0 |
| REQ-01 | CLI skill commands | integration | `npm test -- skill-cli.test.ts` | No - Wave 0 |
| REQ-01 | Semantic versioning validation | unit | `npm test -- skill-version.test.ts` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- --testPathPattern=<module>`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/skills/types/skill.ts` - Skill interfaces
- [ ] `src/skills/schema/skill-metadata.ts` - Zod schemas
- [ ] `src/skills/registry/skill-registry.ts` - Main registry
- [ ] `src/skills/registry/skill-store.ts` - SQLite persistence
- [ ] `src/skills/registry/search-index.ts` - FTS5 search
- [ ] `src/skills/registry/version-manager.ts` - Semver handling
- [ ] `src/cli/commands/skill-commands.ts` - CLI commands
- [ ] `tests/unit/skills/skill-registry.test.ts` - Registry tests
- [ ] `tests/unit/skills/skill-search.test.ts` - Search tests
- [ ] `tests/integration/skill-persistence.test.ts` - Persistence tests

## Sources

### Primary (HIGH confidence)
- [SQLite FTS5 Extension](https://sqlite.org/fts5.html) - Official FTS5 documentation
- [SQLite Tutorial - Full-Text Search](https://www.sqlitetutorial.net/sqlite-full-text-search/) - FTS5 examples and patterns
- [Semantic Versioning](https://semver.org/) - Official semver specification
- [Zod Documentation](https://zod.dev/) - Schema validation patterns

### Secondary (MEDIUM confidence)
- [Agent Skills - Open Standard](https://www.bishoylabib.com/posts/claude-skills-comprehensive-guide) - Claude Code skill patterns
- [LangGraph Dynamic Tools](https://langchain.com/docs/modules/agents/tools/) - Tool registry patterns
- [AG2/AutoGen Documentation](https://docs.ag2.ai) - Multi-agent skill patterns
- [Cosine Similarity TypeScript](https://alexop.dev/posts/how-to-implement-a-cosine-similarity-function-in-typescript-for-vector-comparison/) - Vector search implementation

### Tertiary (LOW confidence)
- [Semantic vs Vector Search](https://www.meilisearch.com/blog/semantic-vs-vector-search) - Search strategy comparison
- [Architecting AI Agents with TypeScript](https://apeatling.com/2025/04/21/architecting-ai-agents-with-typescript/) - General patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in project or widely used
- Architecture: HIGH - Patterns from established frameworks (LangGraph, AG2)
- Pitfalls: MEDIUM - Based on common SQLite/Node.js issues, some inferred

**Research date:** 2026-03-09
**Valid until:** 30 days (patterns are stable)
