/**
 * Type definitions tests
 */

import type {
  AgentType,
  VariableType,
  TemplateVariable,
  PromptTemplate,
  PromptVersion,
  InjectedContext,
  OptimizationStrategy,
  MetaPromptConfig,
} from '../types.js';

describe('Type Exports', () => {
  it('should have correct AgentType values', () => {
    const agentTypes: AgentType[] = [
      'coordinator',
      'researcher',
      'planner',
      'executor',
      'reviewer',
      'tester',
      'debugger',
      'optimizer',
      'documenter',
      'validator',
      'migrator',
      'analyzer',
    ];

    expect(agentTypes).toHaveLength(12);
  });

  it('should have correct VariableType values', () => {
    const variableTypes: VariableType[] = [
      'string',
      'number',
      'boolean',
      'array',
      'object',
      'code',
      'json',
      'markdown',
    ];

    expect(variableTypes).toHaveLength(8);
  });

  it('should have correct OptimizationStrategy values', () => {
    const strategies: OptimizationStrategy[] = [
      'token_reduction',
      'clarity_enhancement',
      'context_compression',
      'focus_narrowing',
      'example_addition',
      'constraint_tightening',
    ];

    expect(strategies).toHaveLength(6);
  });

  it('should create valid TemplateVariable', () => {
    const variable: TemplateVariable = {
      name: 'testVar',
      type: 'string',
      description: 'A test variable',
      required: true,
      default: 'default value',
      pattern: '^[a-z]+$',
      constraints: {
        minLength: 1,
        maxLength: 100,
      },
    };

    expect(variable.name).toBe('testVar');
    expect(variable.type).toBe('string');
    expect(variable.required).toBe(true);
    expect(variable.default).toBe('default value');
  });

  it('should create valid PromptTemplate', () => {
    const template: PromptTemplate = {
      id: 'test-template',
      name: 'Test Template',
      description: 'A test template',
      agentType: 'executor',
      content: 'Test content with {{variable}}',
      variables: [
        {
          name: 'variable',
          type: 'string',
          description: 'A variable',
          required: true,
        },
      ],
      metadata: {
        author: 'test',
        createdAt: new Date(),
        modifiedAt: new Date(),
        tags: ['test'],
        complexity: 3,
        estimatedTokens: 100,
        isActive: true,
      },
    };

    expect(template.id).toBe('test-template');
    expect(template.agentType).toBe('executor');
    expect(template.variables).toHaveLength(1);
  });

  it('should create valid PromptVersion', () => {
    const version: PromptVersion = {
      version: '1.0.0',
      templateId: 'test-template',
      content: 'Template content',
      changelog: 'Initial version',
      author: 'test',
      createdAt: new Date(),
      isCurrent: true,
      parentVersion: '0.9.0',
    };

    expect(version.version).toBe('1.0.0');
    expect(version.isCurrent).toBe(true);
    expect(version.parentVersion).toBe('0.9.0');
  });

  it('should create valid InjectedContext', () => {
    const context: InjectedContext = {
      task: 'Test task',
      project: {
        name: 'Test Project',
        path: '/test/path',
        language: 'typescript',
        framework: 'jest',
      },
      code: {
        files: ['test.ts'],
        snippets: [
          {
            file: 'test.ts',
            lines: { start: 1, end: 10 },
            content: 'const x = 1;',
            language: 'typescript',
            relevance: 0.9,
          },
        ],
        dependencies: ['lodash'],
      },
      history: {
        previousAttempts: ['attempt1'],
        learnings: ['learning1'],
        errors: ['error1'],
      },
      environment: {
        os: 'linux',
        shell: 'bash',
        nodeVersion: '20.0.0',
        tools: ['git', 'npm'],
      },
      custom: {
        customKey: 'customValue',
      },
    };

    expect(context.task).toBe('Test task');
    expect(context.project?.name).toBe('Test Project');
    expect(context.code?.snippets).toHaveLength(1);
  });

  it('should create valid MetaPromptConfig', () => {
    const config: MetaPromptConfig = {
      defaultAgentType: 'executor',
      maxContextTokens: 4000,
      optimizationEnabled: true,
      defaultStrategy: 'token_reduction',
      storagePath: './storage',
      versioningEnabled: true,
    };

    expect(config.defaultAgentType).toBe('executor');
    expect(config.maxContextTokens).toBe(4000);
    expect(config.optimizationEnabled).toBe(true);
  });
});
