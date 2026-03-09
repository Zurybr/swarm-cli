# Phase 3: Composable Builder - Research

**Researched:** 2026-03-09
**Domain:** Agent Composition, Fluent APIs, Schema Validation
**Confidence:** HIGH

## Summary

Phase 3 implements a composable agent builder that enables constructing agents by combining skills from the registry with validated input/output compatibility. The research identifies four core patterns: (1) fluent builder APIs for ergonomic agent composition, (2) JSON Schema-based compatibility validation for skill chaining, (3) decorator/wrapper patterns for integrating with the existing `BaseAgent` class, and (4) graph-based composition models from LangGraph and AG2.

The existing codebase provides a solid foundation: `BaseAgent` is an abstract class with lifecycle hooks (`beforeExecute`, `afterExecute`), `AgentRegistry` manages agent instances, and Phase 2's `SkillRegistry` provides skill metadata with input/output schemas. The key challenge is bridging these systems: allowing skills to be composed into agent configurations that can instantiate `BaseAgent` subclasses.

**Primary recommendation:** Implement a two-layer architecture: (1) `AgentBuilder` fluent API for declarative composition with validation, and (2) `ComposedAgent` class extending `BaseAgent` that executes skills as a pipeline. Use JSON Schema compatibility checking for input/output validation at build time.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REQ-02 | Agents as composition of 1+ skills | Builder pattern with `.use()` chain; Skill array in agent config |
| REQ-02 | Input/output compatibility validation | JSON Schema compatibility checking; Schema matching for chained skills |
| REQ-02 | Agents with skill configurations | Builder `.withConfig()` pattern; Skill-specific options |
| REQ-02 | Integration with existing BaseAgent | ComposedAgent extends BaseAgent; Override execute() to run skill pipeline |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ajv | 8.x | JSON Schema validation | Industry standard; fast; supports draft-07/2019-09/2020-12 |
| ajv-formats | 2.x | Format validation for AJV | Adds date, email, uri, etc. validation |
| zod | 3.x | Runtime type validation | Already in project; can convert to JSON Schema |
| zod-to-json-schema | 3.x | Zod to JSON Schema conversion | Bridge between Zod types and AJV validation |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| json-schema-diff-validator | 1.x | Schema compatibility checking | Validate if output schema matches input schema |
| fast-json-stringify | 5.x | Fast serialization | If performance becomes critical for schema validation |

### Installation
```bash
npm install ajv ajv-formats zod-to-json-schema
npm install --save-dev @types/ajv
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── agents/
│   ├── builder/
│   │   ├── agent-builder.ts       # Fluent builder API
│   │   ├── composed-agent.ts      # BaseAgent implementation for compositions
│   │   ├── skill-chain.ts         # Skill chain validation and execution
│   │   └── schema-validator.ts    # JSON Schema compatibility checking
│   ├── types/
│   │   └── composition.ts         # Composition type definitions
│   └── index.ts                   # Public API exports
├── skills/
│   └── registry/                  # From Phase 2
│       └── skill-registry.ts
└── cli/
    └── commands/
        └── agent-commands.ts      # agent build command
```

### Pattern 1: Fluent Builder API

**What:** Chainable API for declarative agent composition with type safety.

**When to use:** All agent composition scenarios. Provides ergonomic interface and captures composition intent.

**Example:**
```typescript
// Source: Builder pattern from LangGraph + Fluent API best practices
// https://langchain.com/docs/modules/agents/agent_types/

import { AgentBuilder } from './builder/agent-builder';
import { skillRegistry } from '../skills/registry/skill-registry';

// Build agent by composing skills
const securityAgent = new AgentBuilder(skillRegistry)
  .withName('security-reviewer')
  .withDescription('Reviews code for security vulnerabilities')
  .use('code-parser', { language: 'typescript' })
  .use('secret-detector', { severityThreshold: 'medium' })
  .use('vulnerability-scanner', { cweList: ['CWE-79', 'CWE-89'] })
  .withOutput('security-report')
  .build();

// Builder validates compatibility at build()
// Throws if code-parser output doesn't match secret-detector input
```

**Implementation:**
```typescript
// src/agents/builder/agent-builder.ts
import { SkillRegistry } from '../../skills/registry/skill-registry';
import { SkillMetadata } from '../../skills/types/skill';
import { SchemaValidator } from './schema-validator';
import { ComposedAgent } from './composed-agent';
import { AgentConfig } from '../base-agent';

export interface SkillConfig {
  skillName: string;
  version?: string;
  config?: Record<string, unknown>;
}

export interface CompositionConfig {
  name: string;
  description: string;
  skills: SkillConfig[];
  outputSkill?: string;
  globalConfig?: Record<string, unknown>;
}

export class AgentBuilder {
  private skillRegistry: SkillRegistry;
  private schemaValidator: SchemaValidator;
  private config: Partial<CompositionConfig> = {};
  private skillChain: SkillConfig[] = [];

  constructor(skillRegistry: SkillRegistry) {
    this.skillRegistry = skillRegistry;
    this.schemaValidator = new SchemaValidator();
  }

  withName(name: string): this {
    this.config.name = name;
    return this;
  }

  withDescription(description: string): this {
    this.config.description = description;
    return this;
  }

  use(skillName: string, config?: Record<string, unknown>): this {
    this.skillChain.push({ skillName, config });
    return this;
  }

  useVersion(skillName: string, version: string, config?: Record<string, unknown>): this {
    this.skillChain.push({ skillName, version, config });
    return this;
  }

  withOutput(skillName: string): this {
    this.config.outputSkill = skillName;
    return this;
  }

  withGlobalConfig(config: Record<string, unknown>): this {
    this.config.globalConfig = config;
    return this;
  }

  async build(): Promise<ComposedAgent> {
    if (!this.config.name) {
      throw new Error('Agent name is required');
    }

    if (this.skillChain.length === 0) {
      throw new Error('At least one skill is required');
    }

    // Load all skill metadata
    const resolvedSkills = await this.resolveSkills();

    // Validate input/output compatibility
    const validationResult = await this.schemaValidator.validateChain(resolvedSkills);
    if (!validationResult.valid) {
      throw new Error(`Skill chain validation failed: ${validationResult.errors.join(', ')}`);
    }

    // Create agent config
    const agentConfig: AgentConfig = {
      id: `composed-${this.config.name}-${Date.now()}`,
      runId: '', // Set by orchestrator
      role: this.config.name,
      model: 'gpt-4', // Default, can be overridden
      apiUrl: '',
      tools: resolvedSkills.map(s => s.metadata.name)
    };

    // Build composition config
    const compositionConfig: CompositionConfig = {
      name: this.config.name,
      description: this.config.description || '',
      skills: this.skillChain,
      outputSkill: this.config.outputSkill,
      globalConfig: this.config.globalConfig
    };

    return new ComposedAgent(agentConfig, compositionConfig, this.skillRegistry);
  }

  private async resolveSkills(): Promise<SkillMetadata[]> {
    const resolved: SkillMetadata[] = [];
    for (const skillConfig of this.skillChain) {
      const skill = await this.skillRegistry.getSkill(
        skillConfig.skillName,
        skillConfig.version
      );
      if (!skill) {
        throw new Error(`Skill not found: ${skillConfig.skillName}` +
          (skillConfig.version ? `@${skillConfig.version}` : ''));
      }
      resolved.push(skill.metadata);
    }
    return resolved;
  }
}
```

### Pattern 2: JSON Schema Compatibility Validation

**What:** Validate that output of skill N is compatible with input of skill N+1.

**When to use:** At agent build time to catch composition errors early.

**Example:**
```typescript
// Source: JSON Schema validation patterns + AJV documentation
// https://ajv.js.org/

import Ajv from 'ajv';
import addFormats from 'ajv-formats';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class SchemaValidator {
  private ajv: Ajv;

  constructor() {
    this.ajv = new Ajv({ strict: false, allErrors: true });
    addFormats(this.ajv);
  }

  async validateChain(skills: SkillMetadata[]): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (let i = 0; i < skills.length - 1; i++) {
      const current = skills[i];
      const next = skills[i + 1];

      if (!current.schema?.output) {
        warnings.push(`${current.name}: No output schema defined`);
        continue;
      }

      if (!next.schema?.input) {
        warnings.push(`${next.name}: No input schema defined`);
        continue;
      }

      const compatibility = this.checkCompatibility(
        current.schema.output,
        next.schema.input
      );

      if (!compatible) {
        errors.push(
          `Incompatible chain: ${current.name} output ` +
          `does not match ${next.name} input: ` +
          compatibility.errors.join(', ')
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  private checkCompatibility(
    outputSchema: Record<string, unknown>,
    inputSchema: Record<string, unknown>
  ): { compatible: boolean; errors: string[] } {
    // Strategy: Check if input schema is a subset/subset of output schema
    // This is a simplified check - production may need more sophisticated analysis

    const errors: string[] = [];

    // Check required fields in input are present in output
    const inputRequired = (inputSchema.required as string[]) || [];
    const outputProperties = (outputSchema.properties as Record<string, unknown>) || {};

    for (const required of inputRequired) {
      if (!(required in outputProperties)) {
        errors.push(`Missing required field: ${required}`);
      }
    }

    // Type compatibility checks
    const inputProps = (inputSchema.properties as Record<string, unknown>) || {};
    for (const [key, inputProp] of Object.entries(inputProps)) {
      const outputProp = outputProperties[key];
      if (outputProp) {
        const typeCheck = this.checkTypeCompatibility(
          (inputProp as any).type,
          (outputProp as any).type
        );
        if (!typeCheck.compatible) {
          errors.push(`Type mismatch for ${key}: ${typeCheck.error}`);
        }
      }
    }

    return {
      compatible: errors.length === 0,
      errors
    };
  }

  private checkTypeCompatibility(
    inputType: string | string[],
    outputType: string | string[]
  ): { compatible: boolean; error?: string } {
    // Handle array types
    const inputTypes = Array.isArray(inputType) ? inputType : [inputType];
    const outputTypes = Array.isArray(outputType) ? outputType : [outputType];

    // Check if any output type satisfies any input type
    const compatible = inputTypes.some(it =>
      outputTypes.some(ot => this.areTypesCompatible(it, ot))
    );

    if (!compatible) {
      return {
        compatible: false,
        error: `input expects ${inputTypes.join('|')}, output provides ${outputTypes.join('|')}`
      };
    }

    return { compatible: true };
  }

  private areTypesCompatible(input: string, output: string): boolean {
    // Same type is always compatible
    if (input === output) return true;

    // number accepts integer
    if (input === 'number' && output === 'integer') return true;

    // string accepts specific formats
    if (input === 'string' && output === 'string') return true;

    // null handling
    if (input === 'null' || output === 'null') return input === output;

    return false;
  }
}
```

### Pattern 3: ComposedAgent - BaseAgent Integration

**What:** Extend `BaseAgent` to execute composed skills as a pipeline.

**When to use:** When agent needs to participate in existing orchestration that expects `BaseAgent`.

**Example:**
```typescript
// Source: Extending BaseAgent with composition behavior
// Based on existing BaseAgent from src/agents/base-agent.ts

import { BaseAgent, AgentConfig, Task, AgentResult } from '../base-agent';
import { CompositionConfig } from './agent-builder';
import { SkillRegistry } from '../../skills/registry/skill-registry';
import { Logger } from '../../utils/logger';

export class ComposedAgent extends BaseAgent {
  private compositionConfig: CompositionConfig;
  private skillRegistry: SkillRegistry;
  private logger: Logger;

  constructor(
    config: AgentConfig,
    compositionConfig: CompositionConfig,
    skillRegistry: SkillRegistry
  ) {
    super(config);
    this.compositionConfig = compositionConfig;
    this.skillRegistry = skillRegistry;
    this.logger = new Logger(`ComposedAgent:${config.role}`);
  }

  async execute(task: Task): Promise<AgentResult> {
    await this.beforeExecute(task);

    try {
      let currentInput: unknown = this.extractInput(task);
      const skillResults: Array<{ skill: string; output: unknown }> = [];

      // Execute skills in sequence
      for (const skillConfig of this.compositionConfig.skills) {
        this.logger.info(`Executing skill: ${skillConfig.skillName}`);

        const skill = await this.skillRegistry.getSkill(
          skillConfig.skillName,
          skillConfig.version
        );

        if (!skill) {
          throw new Error(`Skill not found: ${skillConfig.skillName}`);
        }

        // Merge global config with skill-specific config
        const mergedConfig = {
          ...this.compositionConfig.globalConfig,
          ...skillConfig.config
        };

        // Execute skill (placeholder - actual execution depends on skill definition)
        const output = await this.executeSkill(skill, currentInput, mergedConfig);

        skillResults.push({
          skill: skillConfig.skillName,
          output
        });

        // Output becomes input for next skill
        currentInput = output;
      }

      // Format final result
      const result: AgentResult = {
        success: true,
        output: this.formatOutput(currentInput, skillResults),
        artifacts: this.extractArtifacts(skillResults)
      };

      await this.afterExecute(result);
      return result;

    } catch (error) {
      const result: AgentResult = {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
      await this.afterExecute(result);
      return result;
    }
  }

  private extractInput(task: Task): unknown {
    // Extract structured input from task description
    // Could parse JSON, extract code blocks, etc.
    try {
      return JSON.parse(task.description);
    } catch {
      return { content: task.description };
    }
  }

  private async executeSkill(
    skill: Skill,
    input: unknown,
    config: Record<string, unknown>
  ): Promise<unknown> {
    // Placeholder: Actual implementation depends on skill definition structure
    // This would call the skill's execution function
    this.logger.debug(`Executing ${skill.metadata.name} with config:`, config);
    return { result: 'placeholder' };
  }

  private formatOutput(
    finalOutput: unknown,
    skillResults: Array<{ skill: string; output: unknown }>
  ): string {
    // Format based on outputSkill if specified
    if (this.compositionConfig.outputSkill) {
      const outputResult = skillResults.find(
        r => r.skill === this.compositionConfig.outputSkill
      );
      if (outputResult) {
        return JSON.stringify(outputResult.output, null, 2);
      }
    }

    return JSON.stringify(finalOutput, null, 2);
  }

  private extractArtifacts(
    skillResults: Array<{ skill: string; output: unknown }>
  ): string[] {
    // Extract file paths or artifact references from results
    const artifacts: string[] = [];
    for (const result of skillResults) {
      const output = result.output as any;
      if (output?.artifacts) {
        artifacts.push(...output.artifacts);
      }
      if (output?.filePath) {
        artifacts.push(output.filePath);
      }
    }
    return artifacts;
  }
}
```

### Pattern 4: Agent Composition from Configuration

**What:** Define agents declaratively in configuration files for reproducibility.

**When to use:** For domain expert agents (Phase 4) that should be version-controlled.

**Example:**
```typescript
// Source: Configuration-driven agent definitions
// src/agents/definitions/security-agent.ts

import { CompositionConfig } from '../builder/agent-builder';

export const securityAgentConfig: CompositionConfig = {
  name: 'security-reviewer',
  description: 'Analyzes code for security vulnerabilities and secrets',
  skills: [
    {
      skillName: 'file-reader',
      config: { encoding: 'utf-8' }
    },
    {
      skillName: 'secret-detector',
      config: { severityThreshold: 'medium' }
    },
    {
      skillName: 'vulnerability-scanner',
      config: { includeCWE: true }
    },
    {
      skillName: 'security-report-generator',
      config: { format: 'markdown' }
    }
  ],
  outputSkill: 'security-report-generator'
};

// Factory function for creating from config
export async function createSecurityAgent(
  skillRegistry: SkillRegistry
): Promise<ComposedAgent> {
  return new AgentBuilder(skillRegistry)
    .withName(securityAgentConfig.name)
    .withDescription(securityAgentConfig.description)
    .use('file-reader', securityAgentConfig.skills[0].config)
    .use('secret-detector', securityAgentConfig.skills[1].config)
    .use('vulnerability-scanner', securityAgentConfig.skills[2].config)
    .use('security-report-generator', securityAgentConfig.skills[3].config)
    .withOutput(securityAgentConfig.outputSkill!)
    .build();
}
```

### Pattern 5: CLI Command for Agent Building

**What:** CLI command to build and register composed agents.

**When to use:** For interactive agent creation and management.

**Example:**
```typescript
// Source: Commander CLI pattern from existing codebase
// src/cli/commands/agent-commands.ts

import { Command } from 'commander';
import { AgentBuilder } from '../../agents/builder/agent-builder';
import { SkillRegistry } from '../../skills/registry/skill-registry';
import { agentRegistry } from '../../agents/agent-registry';

export function registerAgentCommands(
  program: Command,
  skillRegistry: SkillRegistry
): void {
  const agentCmd = program
    .command('agent')
    .description('Manage composed agents');

  // agent build
  agentCmd
    .command('build')
    .description('Build a new composed agent')
    .requiredOption('--name <name>', 'Agent name')
    .requiredOption('--skills <skills>', 'Comma-separated skill names')
    .option('--description <desc>', 'Agent description')
    .option('--config <file>', 'Path to JSON config file')
    .option('--output <skill>', 'Output skill name')
    .action(async (options) => {
      const builder = new AgentBuilder(skillRegistry)
        .withName(options.name)
        .withDescription(options.description || '');

      // Parse skills and add to builder
      const skillNames = options.skills.split(',').map((s: string) => s.trim());
      for (const skillName of skillNames) {
        builder.use(skillName);
      }

      if (options.output) {
        builder.withOutput(options.output);
      }

      try {
        const agent = await builder.build();
        agentRegistry.register(agent, {
          type: 'composed',
          skills: skillNames
        });
        console.log(`Built agent: ${options.name} with skills: ${skillNames.join(', ')}`);
      } catch (error) {
        console.error(`Build failed: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });
}
```

### Anti-Patterns to Avoid

- **Runtime schema validation only:** Validate at build time to catch errors early.
- **Tight coupling to skill implementations:** Use metadata and schemas, not implementation details.
- **Mutable agent configuration:** Builder should create immutable agent configs.
- **Synchronous skill resolution:** Always use async when loading skills from registry.
- **Ignoring schema warnings:** Warnings about missing schemas indicate potential runtime issues.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON Schema validation | Manual type checking | AJV | Handles complex schemas, refs, formats |
| Schema compatibility | Custom comparison logic | AJV + custom rules | Edge cases in type coercion, refs |
| Builder pattern | Class with void methods | Return `this` for chaining | Standard fluent API pattern |
| Type conversion | Manual JSON Schema generation | zod-to-json-schema | Maintains type safety |
| Deep object comparison | `JSON.stringify` comparison | Deep equality library | Handles circular refs, undefined |

**Key insight:** Schema validation and compatibility checking have many edge cases (type coercion, $ref resolution, format validation). AJV handles these correctly; custom solutions miss edge cases that cause runtime failures.

## Common Pitfalls

### Pitfall 1: Schema Version Mismatches
**What goes wrong:** Skills use different JSON Schema drafts (draft-07 vs 2020-12) causing validation failures.
**Why it happens:** No standardization on schema version across skills.
**How to avoid:** Standardize on JSON Schema 2020-12. Validate schema versions at registration.
**Warning signs:** Validation errors on valid data; $ref resolution failures.

### Pitfall 2: Circular Dependencies in Skill Chains
**What goes wrong:** Agent composition creates circular references (skill A -> B -> A).
**Why it happens:** No validation of skill dependency graph.
**How to avoid:** Build dependency graph and detect cycles during validation.
**Warning signs:** Infinite loops during execution; stack overflow errors.

### Pitfall 3: Mutable Builder State
**What goes wrong:** Reusing a builder instance creates agents with unexpected configurations.
**Why it happens:** Builder methods mutate internal state and return same instance.
**How to avoid:** Document that builders are single-use, or implement `.clone()` method.
**Warning signs:** Second agent has skills from first agent's configuration.

### Pitfall 4: Async Validation in Build
**What goes wrong:** Builder.build() fails late due to async skill loading errors.
**Why it happens:** Skills loaded lazily during validation, not at registration.
**How to avoid:** Pre-load all skill metadata before validation step.
**Warning signs:** Build fails after partial validation; inconsistent error timing.

### Pitfall 5: Type Safety Loss in Chains
**What goes wrong:** TypeScript loses type information through skill chains.
**Why it happens:** Dynamic skill composition can't be statically typed.
**How to avoid:** Use generics for known skill combinations; runtime validation for dynamic.
**Warning signs:** `any` types propagating; no autocomplete on skill outputs.

## Code Examples

### Complete Agent Builder Usage

```typescript
// Example: Building a code review agent
import { AgentBuilder } from './agents/builder/agent-builder';
import { skillRegistry } from './skills/registry/skill-registry';
import { agentRegistry } from './agents/agent-registry';

async function createCodeReviewAgent() {
  const builder = new AgentBuilder(skillRegistry);

  const agent = await builder
    .withName('code-reviewer')
    .withDescription('Reviews code for quality and security issues')
    .use('file-reader', { encoding: 'utf-8' })
    .use('syntax-parser', { language: 'typescript' })
    .use('complexity-analyzer', { maxComplexity: 10 })
    .use('security-scanner', { rules: ['xss', 'injection'] })
    .use('report-generator', { format: 'markdown' })
    .withOutput('report-generator')
    .build();

  // Register with agent registry for orchestration
  agentRegistry.register(agent, {
    type: 'composed',
    capabilities: ['code-review', 'security']
  });

  return agent;
}

// Execute via existing orchestration
const agent = await createCodeReviewAgent();
const result = await agent.execute({
  id: 'task-1',
  title: 'Review auth.ts',
  description: JSON.stringify({ filePath: 'src/auth.ts' }),
  status: 'pending'
});
```

### Schema Compatibility Check

```typescript
// Example: Checking if two skills can be chained
import { SchemaValidator } from './agents/builder/schema-validator';

const validator = new SchemaValidator();

const outputSchema = {
  type: 'object',
  properties: {
    code: { type: 'string' },
    language: { type: 'string' },
    ast: { type: 'object' }
  },
  required: ['code', 'language']
};

const inputSchema = {
  type: 'object',
  properties: {
    code: { type: 'string' },
    language: { type: 'string' }
  },
  required: ['code']
};

const result = validator.checkCompatibility(outputSchema, inputSchema);
// result.compatible = true (output has all required input fields)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded agent logic | Composed from skills | 2024 | Reusability, testability |
| Runtime type checking | JSON Schema validation | 2023 | Early error detection |
| Imperative agent building | Fluent builder APIs | 2024 | Readability, maintainability |
| Monolithic agents | Skill chains | 2024 | Modularity, composition |
| Manual compatibility | Automated schema checking | 2024 | Fewer runtime errors |

**Deprecated/outdated:**
- **Manual type guards:** Use JSON Schema validation instead
- **Class inheritance for agents:** Prefer composition over inheritance
- **String-based skill matching:** Use schema-based compatibility

## Open Questions

1. **Skill Execution Model**
   - What we know: Skills have metadata with schemas
   - What's unclear: How are skills actually executed? Function calls? LLM prompts?
   - Recommendation: Define `SkillExecutor` interface; implementations can vary

2. **Parallel Skill Execution**
   - What we know: Current design is sequential
   - What's unclear: Should skills support parallel branches (fan-out/fan-in)?
   - Recommendation: Start sequential; add parallel patterns in Phase 5 (Orchestration)

3. **Error Handling Strategy**
   - What we know: Skills can fail; need error handling
   - What's unclear: Should chains support fallback skills? Retry logic?
   - Recommendation: Add `.onError()` builder method; integrate with BaseAgent retry

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.7.0 + ts-jest |
| Config file | `jest.config.ts` (from Phase 1) |
| Quick run command | `npm test -- --testPathPattern=builder` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-02 | Build agent with skill chain | unit | `npm test -- agent-builder.test.ts` | No - Wave 0 |
| REQ-02 | Validate skill compatibility | unit | `npm test -- schema-validator.test.ts` | No - Wave 0 |
| REQ-02 | Reject incompatible skills | unit | `npm test -- schema-validator.test.ts` | No - Wave 0 |
| REQ-02 | ComposedAgent extends BaseAgent | unit | `npm test -- composed-agent.test.ts` | No - Wave 0 |
| REQ-02 | Execute skill chain | integration | `npm test -- composed-agent.test.ts` | No - Wave 0 |
| REQ-02 | CLI agent build command | integration | `npm test -- agent-cli.test.ts` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- --testPathPattern=<module>`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/agents/builder/agent-builder.ts` - Fluent builder API
- [ ] `src/agents/builder/composed-agent.ts` - BaseAgent implementation
- [ ] `src/agents/builder/schema-validator.ts` - JSON Schema validation
- [ ] `src/agents/builder/skill-chain.ts` - Chain execution logic
- [ ] `src/agents/types/composition.ts` - Composition types
- [ ] `src/cli/commands/agent-commands.ts` - CLI commands
- [ ] `tests/unit/agents/builder/agent-builder.test.ts` - Builder tests
- [ ] `tests/unit/agents/builder/schema-validator.test.ts` - Validation tests
- [ ] `tests/integration/agents/composed-agent.test.ts` - Integration tests

## Sources

### Primary (HIGH confidence)
- [AJV JSON Schema Validator](https://ajv.js.org/) - Official documentation
- [JSON Schema](https://json-schema.org/) - Official specification
- [Zod Documentation](https://zod.dev/) - Schema validation library
- [TypeScript Builder Pattern](https://refactoring.guru/design-patterns/builder/typescript/example) - Design pattern reference

### Secondary (MEDIUM confidence)
- [LangGraph Agent Composition](https://langchain.com/docs/modules/agents/agent_types/) - Agent composition patterns
- [AG2/AutoGen Multi-Agent](https://docs.ag2.ai) - Multi-agent orchestration patterns
- [Fluent Interface Pattern](https://martinfowler.com/bliki/FluentInterface.html) - API design patterns

### Tertiary (LOW confidence)
- [Agent Composition Patterns](https://apeatling.com/2025/04/21/architecting-ai-agents-with-typescript/) - General agent patterns
- [Schema Compatibility](https://medium.com/@apiltamang/json-schema-compatibility-and-versioning-43d9e6d6e8b4) - Schema evolution

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - AJV and Zod are industry standards
- Architecture: HIGH - Patterns from LangGraph, AG2, and established builder patterns
- Pitfalls: MEDIUM - Based on common schema validation issues, some inferred

**Research date:** 2026-03-09
**Valid until:** 30 days (patterns are stable)
