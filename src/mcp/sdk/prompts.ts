/**
 * MCP Prompt Helpers - Issue #24.6
 * Helper functions for creating MCP prompts
 */

import {
  MCPPromptHandler,
  MCPPromptResult,
  MCPPromptMessage,
  MCPPromptArgument,
  MCPContent,
} from './types.js';

/**
 * Create a simple static prompt
 * 
 * @example
 * ```typescript
 * const greetingPrompt = createStaticPrompt(
 *   'greeting',
 *   'Generate a greeting',
 *   'Generate a friendly greeting message.'
 * );
 * ```
 */
export function createStaticPrompt(
  name: string,
  description: string,
  content: string,
  role: 'user' | 'assistant' = 'user'
): MCPPromptHandler {
  return {
    name,
    description,
    handler: async (): Promise<MCPPromptResult> => ({
      messages: [{ role, content: { type: 'text', text: content } }],
    }),
  };
}

/**
 * Create a parameterized prompt
 * 
 * @example
 * ```typescript
 * const codeReviewPrompt = createPrompt(
 *   'code-review',
 *   'Review code for issues',
 *   [
 *     { name: 'code', description: 'Code to review', required: true },
 *     { name: 'language', description: 'Programming language' },
 *   ],
 *   async ({ code, language }) => ({
 *     messages: [
 *       {
 *         role: 'user',
 *         content: { type: 'text', text: `Review this ${language || ''} code:\n\n${code}` },
 *       },
 *     ],
 *   })
 * );
 * ```
 */
export function createPrompt(
  name: string,
  description: string,
  arguments_: MCPPromptArgument[],
  handler: (args?: Record<string, unknown>) => Promise<MCPPromptResult>
): MCPPromptHandler {
  return {
    name,
    description,
    arguments: arguments_,
    handler,
  };
}

/**
 * Create a multi-turn conversation prompt
 * 
 * @example
 * ```typescript
 * const conversationPrompt = createConversationPrompt(
 *   'explain-code',
 *   'Explain code step by step',
 *   [{ name: 'code', description: 'Code to explain', required: true }],
 *   async ({ code }) => [
 *     { role: 'user', content: { type: 'text', text: `Explain this code:\n${code}` } },
 *     { role: 'assistant', content: { type: 'text', text: 'I will explain this code step by step...' } },
 *     { role: 'user', content: { type: 'text', text: 'Please provide examples for each concept.' } },
 *   ]
 * );
 * ```
 */
export function createConversationPrompt(
  name: string,
  description: string,
  arguments_: MCPPromptArgument[],
  handler: (args?: Record<string, unknown>) => Promise<MCPPromptMessage[]>
): MCPPromptHandler {
  return {
    name,
    description,
    arguments: arguments_,
    handler: async (args?: Record<string, unknown>): Promise<MCPPromptResult> => {
      const messages = await handler(args);
      return { messages };
    },
  };
}

/**
 * Create a system instruction prompt
 */
export function createSystemPrompt(
  name: string,
  instructions: string,
  variables?: MCPPromptArgument[]
): MCPPromptHandler {
  return {
    name,
    description: `System instructions: ${name}`,
    arguments: variables,
    handler: async (args?: Record<string, unknown>): Promise<MCPPromptResult> => {
      let text = instructions;

      // Replace variables
      if (args) {
        Object.entries(args).forEach(([key, value]) => {
          text = text.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
        });
      }

      return {
        messages: [
          {
            role: 'user',
            content: { type: 'text', text },
          },
        ],
      };
    },
  };
}

/**
 * Create a template-based prompt
 */
export function createTemplatePrompt(
  name: string,
  description: string,
  template: string,
  variables: MCPPromptArgument[]
): MCPPromptHandler {
  return {
    name,
    description,
    arguments: variables,
    handler: async (args?: Record<string, unknown>): Promise<MCPPromptResult> => {
      let text = template;

      if (args) {
        Object.entries(args).forEach(([key, value]) => {
          text = text.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
        });
      }

      return {
        messages: [
          {
            role: 'user',
            content: { type: 'text', text },
          },
        ],
      };
    },
  };
}

// ============================================================================
// Common Prompt Templates
// ============================================================================

/**
 * Create a code analysis prompt
 */
export function createCodeAnalysisPrompt(): MCPPromptHandler {
  return createPrompt(
    'analyze-code',
    'Analyze code for quality, security, and performance issues',
    [
      { name: 'code', description: 'Code to analyze', required: true },
      { name: 'language', description: 'Programming language' },
      { name: 'focus', description: 'Focus area: quality, security, performance, or all' },
    ],
    async (args) => {
      const { code, language, focus = 'all' } = args || {};
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Analyze the following ${language || ''} code for ${focus === 'all' ? 'quality, security, and performance' : focus} issues:

\`\`\`${language || ''}
${code}
\`\`\`

Please provide:
1. Summary of findings
2. Specific issues found
3. Recommendations for improvement`,
            },
          },
        ],
      };
    }
  );
}

/**
 * Create a documentation generation prompt
 */
export function createDocGenerationPrompt(): MCPPromptHandler {
  return createPrompt(
    'generate-docs',
    'Generate documentation for code',
    [
      { name: 'code', description: 'Code to document', required: true },
      { name: 'language', description: 'Programming language' },
      { name: 'style', description: 'Documentation style: jsdoc, pydoc, rustdoc, etc.' },
    ],
    async (args) => {
      const { code, language, style = 'jsdoc' } = args || {};
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Generate ${style} documentation for the following ${language || ''} code:

\`\`\`${language || ''}
${code}
\`\`\`

Include:
- Function/method descriptions
- Parameter descriptions with types
- Return value descriptions
- Usage examples where appropriate`,
            },
          },
        ],
      };
    }
  );
}

/**
 * Create a code review prompt
 */
export function createCodeReviewPrompt(): MCPPromptHandler {
  return createPrompt(
    'review-code',
    'Perform a thorough code review',
    [
      { name: 'code', description: 'Code to review', required: true },
      { name: 'context', description: 'Additional context about the changes' },
      { name: 'focus', description: 'Areas to focus on' },
    ],
    async (args) => {
      const { code, context, focus } = args || {};
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Please review the following code:

\`\`\`
${code}
\`\`\`

${context ? `Context: ${context}\n\n` : ''}${focus ? `Focus areas: ${focus}\n\n` : ''}
Review checklist:
1. Code correctness and logic
2. Error handling
3. Code style and readability
4. Performance considerations
5. Security concerns
6. Test coverage suggestions
7. Potential refactoring opportunities`,
            },
          },
        ],
      };
    }
  );
}

/**
 * Helper to create user message
 */
export function userMessage(text: string): MCPPromptMessage {
  return { role: 'user', content: { type: 'text', text } };
}

/**
 * Helper to create assistant message
 */
export function assistantMessage(text: string): MCPPromptMessage {
  return { role: 'assistant', content: { type: 'text', text } };
}
