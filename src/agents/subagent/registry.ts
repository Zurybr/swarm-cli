import { BaseAgent, AgentConfig, Task, AgentResult } from '../base-agent';

export type SubagentType = 'general' | 'explore' | 'researcher' | 'debugger' | 'tester';

export interface SubagentDefinition {
  type: SubagentType;
  name: string;
  description: string;
  systemPrompt: string;
  defaultTools: string[];
  capabilities: {
    canModifyCode: boolean;
    canExecuteShell: boolean;
    canAccessExternal: boolean;
  };
}

export const SUBAGENT_DEFINITIONS: Record<SubagentType, SubagentDefinition> = {
  general: {
    type: 'general',
    name: '@general',
    description: 'General purpose assistant for miscellaneous tasks',
    systemPrompt: `You are the @general subagent - a versatile general-purpose assistant.

Your responsibilities:
- Handle miscellaneous tasks that don't fit other specialized agents
- Provide helpful responses and general guidance
- Coordinate with other agents when needed
- Summarize findings and present clear results

Always maintain a helpful, professional tone.`,
    defaultTools: ['read', 'glob', 'grep'],
    capabilities: {
      canModifyCode: false,
      canExecuteShell: false,
      canAccessExternal: false,
    },
  },
  explore: {
    type: 'explore',
    name: '@explore',
    description: 'Explore codebase structure and understand architecture',
    systemPrompt: `You are the @explore subagent - a codebase exploration specialist.

Your responsibilities:
- Explore and map codebase structure
- Identify file relationships and dependencies
- Understand architectural patterns
- Find relevant files for given tasks
- Provide detailed analysis of code organization

Use glob, grep, and read tools to thoroughly explore.`,
    defaultTools: ['glob', 'grep', 'read', 'bash'],
    capabilities: {
      canModifyCode: false,
      canExecuteShell: true,
      canAccessExternal: false,
    },
  },
  researcher: {
    type: 'researcher',
    name: '@researcher',
    description: 'Research and gather information on topics',
    systemPrompt: `You are the @researcher subagent - a research specialist.

Your responsibilities:
- Research topics thoroughly using available sources
- Gather relevant documentation and examples
- Compile findings into organized reports
- Provide citations and references when possible
- Stay focused on the research objective

Prioritize accuracy and comprehensiveness.`,
    defaultTools: ['read', 'grep', 'webfetch'],
    capabilities: {
      canModifyCode: false,
      canExecuteShell: false,
      canAccessExternal: true,
    },
  },
  debugger: {
    type: 'debugger',
    name: '@debugger',
    description: 'Debug issues and find root causes',
    systemPrompt: `You are the @debugger subagent - a debugging specialist.

Your responsibilities:
- Analyze error messages and stack traces
- Identify root causes of bugs
- Trace execution flow to find issues
- Suggest fixes and workarounds
- Verify fixes work correctly

Be systematic and thorough in your investigation.`,
    defaultTools: ['read', 'grep', 'bash'],
    capabilities: {
      canModifyCode: true,
      canExecuteShell: true,
      canAccessExternal: false,
    },
  },
  tester: {
    type: 'tester',
    name: '@tester',
    description: 'Write and run tests to verify functionality',
    systemPrompt: `You are the @tester subagent - a testing specialist.

Your responsibilities:
- Write comprehensive tests for new features
- Run existing test suites
- Verify bug fixes with test cases
- Ensure code coverage is maintained
- Document test strategies

Focus on edge cases and failure scenarios.`,
    defaultTools: ['read', 'glob', 'bash'],
    capabilities: {
      canModifyCode: true,
      canExecuteShell: true,
      canAccessExternal: false,
    },
  },
};

class SubagentRegistryImpl {
  private subagents: Map<SubagentType, SubagentDefinition> = new Map();
  private customSubagents: Map<string, SubagentDefinition> = new Map();

  constructor() {
    for (const [type, definition] of Object.entries(SUBAGENT_DEFINITIONS)) {
      this.subagents.set(type as SubagentType, definition);
    }
  }

  get(type: SubagentType): SubagentDefinition | undefined {
    return this.subagents.get(type);
  }

  getAll(): SubagentDefinition[] {
    return Array.from(this.subagents.values());
  }

  getByName(name: string): SubagentDefinition | undefined {
    const normalized = name.toLowerCase().replace(/^@/, '') as SubagentType;
    return this.subagents.get(normalized);
  }

  has(type: SubagentType): boolean {
    return this.subagents.has(type);
  }

  listTypes(): SubagentType[] {
    return Array.from(this.subagents.keys());
  }

  registerCustom(definition: SubagentDefinition): void {
    this.customSubagents.set(definition.type, definition);
    this.subagents.set(definition.type, definition);
  }
}

export const SubagentRegistry = new SubagentRegistryImpl();
