/**
 * Prompt Optimizer
 *
 * Optimizes prompts for clarity, token efficiency, and effectiveness.
 * Supports multiple optimization strategies for different scenarios.
 */

import type {
  OptimizationStrategy,
  OptimizationResult,
  PromptTemplate,
  AgentType,
  AgentCapability,
} from './types';

/**
 * Options for prompt optimization
 */
export interface OptimizerOptions {
  /** Target token count (approximate) */
  targetTokens?: number;
  /** Optimization strategy to apply */
  strategy?: OptimizationStrategy;
  /** Agent capability profile for customization */
  agentCapability?: AgentCapability;
  /** Whether to preserve code blocks */
  preserveCodeBlocks?: boolean;
  /** Minimum clarity score (0-1) */
  minClarityScore?: number;
}

/**
 * Default optimizer options
 */
const DEFAULT_OPTIONS: OptimizerOptions = {
  targetTokens: 2000,
  strategy: 'token_reduction',
  preserveCodeBlocks: true,
  minClarityScore: 0.7,
};

/**
 * Clarity scoring weights
 */
const CLARITY_WEIGHTS = {
  sentenceLength: 0.2,
  structure: 0.3,
  redundancy: 0.25,
  specificity: 0.25,
};

/**
 * Optimizes a prompt using the specified strategy
 */
export function optimizePrompt(
  prompt: string,
  options: OptimizerOptions = {},
): OptimizationResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const originalTokens = estimateTokens(prompt);

  let optimized: string;
  let changes: string[] = [];

  switch (opts.strategy) {
    case 'token_reduction':
      ({ result: optimized, changes } = optimizeTokenReduction(prompt, opts));
      break;
    case 'clarity_enhancement':
      ({ result: optimized, changes } = optimizeClarity(prompt, opts));
      break;
    case 'context_compression':
      ({ result: optimized, changes } = optimizeContextCompression(prompt, opts));
      break;
    case 'focus_narrowing':
      ({ result: optimized, changes } = optimizeFocusNarrowing(prompt, opts));
      break;
    case 'example_addition':
      ({ result: optimized, changes } = optimizeExampleAddition(prompt, opts));
      break;
    case 'constraint_tightening':
      ({ result: optimized, changes } = optimizeConstraintTightening(prompt, opts));
      break;
    default:
      optimized = prompt;
      changes = ['No optimization applied - unknown strategy'];
  }

  const optimizedTokens = estimateTokens(optimized);
  const clarityScore = calculateClarityScore(optimized);

  return {
    original: prompt,
    optimized,
    strategy: opts.strategy || 'token_reduction',
    metrics: {
      originalTokens,
      optimizedTokens,
      tokenReduction: (originalTokens - optimizedTokens) / originalTokens,
      clarityScore,
    },
    changes,
  };
}

/**
 * Token reduction optimization
 * Removes redundancy and compresses without losing meaning
 */
function optimizeTokenReduction(
  prompt: string,
  options: OptimizerOptions,
): { result: string; changes: string[] } {
  const changes: string[] = [];
  let result = prompt;

  // Remove redundant whitespace
  const originalLength = result.length;
  result = result.replace(/\n{3,}/g, '\n\n');
  if (result.length !== originalLength) {
    changes.push('Collapsed multiple consecutive blank lines');
  }

  // Remove filler words and phrases
  const fillers = [
    /\b(please|kindly)\s+/gi,
    /\b(it is important to note that|it should be noted that)\s+/gi,
    /\b(in order to|so as to)\s+/gi,
    /\b(at this point in time)\s+/gi,
    /\b(due to the fact that)\s+/gi,
    /\b(in the event that)\s+/gi,
  ];

  for (const filler of fillers) {
    const before = result;
    result = result.replace(filler, '');
    if (result !== before) {
      changes.push(`Removed filler phrase matching: ${filler.source}`);
    }
  }

  // Simplify verbose phrases
  const simplifications: [RegExp, string][] = [
    [/\butilize\b/gi, 'use'],
    [/\bleverage\b/gi, 'use'],
    [/\bimplement\b/gi, 'add'],
    [/\bfunctionality\b/gi, 'feature'],
    [/\bapproximately\b/gi, 'about'],
    [/\bsubsequently\b/gi, 'then'],
    [/\bnevertheless\b/gi, 'but'],
  ];

  for (const [pattern, replacement] of simplifications) {
    const before = result;
    result = result.replace(pattern, replacement);
    if (result !== before) {
      changes.push(`Simplified "${pattern.source.replace(/\\b/g, '')}" to "${replacement}"`);
    }
  }

  // Remove duplicate sentences
  const sentences = result.split(/(?<=[.!?])\s+/);
  const seen = new Set<string>();
  const unique = sentences.filter((s) => {
    const normalized = s.toLowerCase().trim();
    if (seen.has(normalized)) {
      return false;
    }
    seen.add(normalized);
    return true;
  });

  if (unique.length !== sentences.length) {
    result = unique.join(' ');
    changes.push(`Removed ${sentences.length - unique.length} duplicate sentences`);
  }

  // Truncate if still over target
  if (options.targetTokens && estimateTokens(result) > options.targetTokens) {
    const maxChars = options.targetTokens * 4;
    if (result.length > maxChars) {
      result = smartTruncate(result, maxChars, options.preserveCodeBlocks ?? true);
      changes.push(`Truncated to approximately ${options.targetTokens} tokens`);
    }
  }

  return { result, changes };
}

/**
 * Clarity enhancement optimization
 * Improves structure and readability
 */
function optimizeClarity(
  prompt: string,
  _options: OptimizerOptions,
): { result: string; changes: string[] } {
  const changes: string[] = [];
  let result = prompt;

  // Ensure consistent heading format
  result = result.replace(/^(#{1,6})\s*(\w)/gm, (match, hashes, firstChar) => {
    return `${hashes} ${firstChar.toUpperCase()}`;
  });
  changes.push('Standardized heading capitalization');

  // Add structure if missing
  if (!result.includes('##') && result.length > 500) {
    // Try to identify sections and add headers
    const lines = result.split('\n');
    const structured: string[] = [];
    let inList = false;

    for (const line of lines) {
      // Detect list sections
      if (line.match(/^\d+\./) && !inList) {
        structured.push('## Steps');
        inList = true;
      }
      structured.push(line);
    }

    if (inList) {
      result = structured.join('\n');
      changes.push('Added structural headers for clarity');
    }
  }

  // Break up very long sentences
  const longSentencePattern = /[^.!?]{200,}[.!?]/g;
  let match;
  while ((match = longSentencePattern.exec(result)) !== null) {
    changes.push('Identified very long sentences that could be split');
    break; // Just flag, don't auto-split to preserve meaning
  }

  return { result, changes };
}

/**
 * Context compression optimization
 * Summarizes or removes less relevant context
 */
function optimizeContextCompression(
  prompt: string,
  options: OptimizerOptions,
): { result: string; changes: string[] } {
  const changes: string[] = [];
  let result = prompt;

  // Identify and summarize long code blocks
  if (options.preserveCodeBlocks) {
    // Compress code blocks by removing comments and excess whitespace
    result = result.replace(
      /```(\w+)?\n([\s\S]*?)```/g,
      (match, lang, code) => {
        const lines = code.split('\n');
        if (lines.length > 50) {
          const compressed = compressCode(code);
          changes.push(`Compressed ${lang || 'code'} block from ${lines.length} to ~${compressed.split('\n').length} lines`);
          return '```' + (lang || '') + '\n' + compressed + '\n```';
        }
        return match;
      },
    );
  }

  // Remove low-relevance context sections
  const contextPatterns = [
    /## Context[\s\S]*?(?=\n##|$)/i,
    /## Background[\s\S]*?(?=\n##|$)/i,
    /## History[\s\S]*?(?=\n##|$)/i,
  ];

  for (const pattern of contextPatterns) {
    const before = result;
    result = result.replace(pattern, (match) => {
      // Keep first paragraph, summarize the rest
      const lines = match.split('\n');
      if (lines.length > 10) {
        const firstParagraph = lines.slice(0, 3).join('\n');
        changes.push('Compressed lengthy context section');
        return firstParagraph + '\n\n[Additional context available if needed]';
      }
      return match;
    });
  }

  return { result, changes };
}

/**
 * Focus narrowing optimization
 * Removes tangential information to focus on core task
 */
function optimizeFocusNarrowing(
  prompt: string,
  _options: OptimizerOptions,
): { result: string; changes: string[] } {
  const changes: string[] = [];
  let result = prompt;

  // Identify and flag tangential sections
  const tangentialPatterns = [
    /## (Note|Notes|Disclaimer|Warning)[\s\S]*?(?=\n##|$)/gi,
    /## (Additional|Extra|Supplementary) [\s\S]*?(?=\n##|$)/gi,
  ];

  for (const pattern of tangentialPatterns) {
    result = result.replace(pattern, (match) => {
      changes.push(`Moved tangential section to appendix: ${match.split('\n')[0]}`);
      return '\n[See appendix for: ' + match.split('\n')[0].replace('## ', '') + ']';
    });
  }

  // Focus on action items
  if (!result.includes('## Task') && result.includes('##')) {
    const taskMatch = result.match(/\b(task|objective|goal|purpose)\b/gi);
    if (taskMatch) {
      changes.push('Consider adding explicit "## Task" section for focus');
    }
  }

  return { result, changes };
}

/**
 * Example addition optimization
 * Adds relevant examples to improve understanding
 */
function optimizeExampleAddition(
  prompt: string,
  _options: OptimizerOptions,
): { result: string; changes: string[] } {
  const changes: string[] = [];
  let result = prompt;

  // Check if examples are already present
  const hasExamples =
    /## Example/i.test(result) ||
    /for example:/i.test(result) ||
    /e\.g\.,/i.test(result);

  if (!hasExamples && result.includes('## Output Format')) {
    // Suggest adding examples after output format
    changes.push('Consider adding examples to illustrate expected output');
  }

  // Ensure examples are concrete
  const vagueExamplePattern = /example:.*\b(something|etc|various|some)\b/gi;
  if (vagueExamplePattern.test(result)) {
    changes.push('Replace vague examples with concrete ones');
  }

  return { result, changes };
}

/**
 * Constraint tightening optimization
 * Makes constraints more specific and actionable
 */
function optimizeConstraintTightening(
  prompt: string,
  _options: OptimizerOptions,
): { result: string; changes: string[] } {
  const changes: string[] = [];
  let result = prompt;

  // Make vague constraints specific
  const vagueConstraints: [RegExp, string][] = [
    [/\b(make it|keep it) (fast|efficient|optimized)\b/gi, 'optimize for $2 (define specific metrics)'],
    [/\b(as soon as possible|quickly)\b/gi, 'by [specific deadline]'],
    [/\b(high|good|better) quality\b/gi, 'meets [specific quality criteria]'],
    [/\b(if possible|if you can)\b/gi, ''],
  ];

  for (const [pattern, replacement] of vagueConstraints) {
    const before = result;
    result = result.replace(pattern, replacement);
    if (result !== before) {
      changes.push(`Tightened vague constraint: "${pattern.source}"`);
    }
  }

  // Add measurable criteria
  if (result.includes('## Constraints') && !result.includes('%') && !result.includes('within')) {
    changes.push('Consider adding measurable constraints (percentages, time limits, etc.)');
  }

  return { result, changes };
}

/**
 * Smart truncate that preserves structure
 */
function smartTruncate(
  content: string,
  maxChars: number,
  preserveCodeBlocks: boolean,
): string {
  if (content.length <= maxChars) {
    return content;
  }

  // If preserving code blocks, try to keep them intact
  if (preserveCodeBlocks) {
    const codeBlockPattern = /```[\s\S]*?```/g;
    const codeBlocks: { start: number; end: number; content: string }[] = [];
    let match;

    while ((match = codeBlockPattern.exec(content)) !== null) {
      codeBlocks.push({
        start: match.index,
        end: match.index + match[0].length,
        content: match[0],
      });
    }

    // Build truncated content preserving code blocks
    let result = '';
    let currentPos = 0;
    const truncationMarker = '\n\n[... content truncated ...]\n\n';
    const availableChars = maxChars - truncationMarker.length;

    for (const block of codeBlocks) {
      // Add text before block
      const textBefore = content.slice(currentPos, block.start);
      if (result.length + textBefore.length > availableChars * 0.6) {
        result += textBefore.slice(0, Math.max(0, availableChars * 0.6 - result.length));
        result += truncationMarker;
        // Add last code block
        result += '\n' + block.content;
        return result;
      }
      result += textBefore + block.content;
      currentPos = block.end;
    }
  }

  // Simple truncation with marker
  const headChars = Math.floor(maxChars * 0.7);
  const tailChars = Math.floor(maxChars * 0.3);
  return (
    content.slice(0, headChars) +
    '\n\n[... content truncated ...]\n\n' +
    content.slice(-tailChars)
  );
}

/**
 * Compress code by removing comments and excess whitespace
 */
function compressCode(code: string): string {
  return (
    code
      // Remove single-line comments (but not in strings)
      .replace(/^(\s*)\/\/.*$/gm, '$1')
      // Remove multi-line comments
      .replace(/\/\*[\s\S]*?\*\//g, '')
      // Collapse multiple blank lines
      .replace(/\n{3,}/g, '\n\n')
      // Remove trailing whitespace
      .replace(/[ \t]+$/gm, '')
      .trim()
  );
}

/**
 * Estimates token count
 */
function estimateTokens(content: string, avgCharsPerToken = 4): number {
  return Math.ceil(content.length / avgCharsPerToken);
}

/**
 * Calculates a clarity score for a prompt
 */
function calculateClarityScore(prompt: string): number {
  const scores: Record<string, number> = {};

  // Sentence length score (shorter is generally clearer)
  const sentences = prompt.split(/[.!?]+/).filter((s) => s.trim());
  const avgSentenceLength =
    sentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0) / sentences.length || 0;
  scores.sentenceLength = Math.max(0, 1 - avgSentenceLength / 30);

  // Structure score (presence of headers, lists)
  const hasHeaders = /^#{1,6}\s/m.test(prompt);
  const hasLists = /^[\s]*[-*\d]\./m.test(prompt);
  scores.structure = (hasHeaders ? 0.5 : 0) + (hasLists ? 0.5 : 0);

  // Redundancy score (lower repetition is better)
  const words = prompt.toLowerCase().split(/\s+/);
  const uniqueWords = new Set(words);
  scores.redundancy = uniqueWords.size / words.length || 1;

  // Specificity score (concrete terms vs vague terms)
  const vagueTerms = /\b(something|thing|stuff|various|somehow|maybe|probably)\b/gi;
  const vagueCount = (prompt.match(vagueTerms) || []).length;
  scores.specificity = Math.max(0, 1 - vagueCount / (words.length / 50));

  // Calculate weighted average
  let totalScore = 0;
  let totalWeight = 0;
  for (const [key, weight] of Object.entries(CLARITY_WEIGHTS)) {
    totalScore += scores[key] * weight;
    totalWeight += weight;
  }

  return Math.round((totalScore / totalWeight) * 100) / 100;
}

/**
 * Optimizes a template for a specific agent type
 */
export function optimizeForAgent(
  template: PromptTemplate,
  agentType: AgentType,
  options: OptimizerOptions = {},
): OptimizationResult {
  // Get agent-specific optimization strategy
  const agentStrategy = getAgentOptimizationStrategy(agentType);
  const opts = { ...options, strategy: options.strategy || agentStrategy };

  return optimizePrompt(template.content, opts);
}

/**
 * Gets the recommended optimization strategy for an agent type
 */
function getAgentOptimizationStrategy(agentType: AgentType): OptimizationStrategy {
  const strategies: Record<AgentType, OptimizationStrategy> = {
    coordinator: 'focus_narrowing',
    researcher: 'context_compression',
    planner: 'clarity_enhancement',
    executor: 'constraint_tightening',
    reviewer: 'example_addition',
    tester: 'example_addition',
    debugger: 'context_compression',
    optimizer: 'token_reduction',
    documenter: 'clarity_enhancement',
    validator: 'constraint_tightening',
    migrator: 'clarity_enhancement',
    analyzer: 'focus_narrowing',
  };

  return strategies[agentType] || 'token_reduction';
}

/**
 * Batch optimize multiple prompts
 */
export function batchOptimize(
  prompts: string[],
  options: OptimizerOptions = {},
): OptimizationResult[] {
  return prompts.map((prompt) => optimizePrompt(prompt, options));
}

/**
 * Suggests optimization strategies based on prompt characteristics
 */
export function suggestStrategies(prompt: string): OptimizationStrategy[] {
  const suggestions: OptimizationStrategy[] = [];
  const tokens = estimateTokens(prompt);

  if (tokens > 3000) {
    suggestions.push('token_reduction');
  }

  if (tokens > 2000 && prompt.includes('## Context')) {
    suggestions.push('context_compression');
  }

  const avgSentenceLength =
    prompt.split(/[.!?]+/).reduce((sum, s) => sum + s.split(/\s+/).length, 0) /
    (prompt.match(/[.!?]+/g) || []).length || 20;

  if (avgSentenceLength > 25) {
    suggestions.push('clarity_enhancement');
  }

  if (!prompt.includes('## Example') && !prompt.includes('e.g.,')) {
    suggestions.push('example_addition');
  }

  const vagueTerms = /\b(if possible|maybe|try to|should be good)\b/gi;
  if (vagueTerms.test(prompt)) {
    suggestions.push('constraint_tightening');
  }

  if (prompt.split('##').length > 6) {
    suggestions.push('focus_narrowing');
  }

  return suggestions.length > 0 ? suggestions : ['token_reduction'];
}

/**
 * Creates an optimized prompt from a template with context
 */
export function createOptimizedPrompt(
  template: PromptTemplate,
  variables: Record<string, unknown>,
  options: OptimizerOptions = {},
): OptimizationResult {
  // First, render the template with variables
  const rendered = renderTemplateWithVariables(template.content, variables);

  // Then optimize
  return optimizePrompt(rendered, options);
}

/**
 * Simple template rendering for optimization
 */
function renderTemplateWithVariables(
  template: string,
  variables: Record<string, unknown>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    const value = variables[varName];
    return value !== undefined ? String(value) : match;
  });
}

/**
 * Compares two optimization results
 */
export function compareOptimizations(
  a: OptimizationResult,
  b: OptimizationResult,
): 'a' | 'b' | 'equal' {
  const scoreA =
    a.metrics.clarityScore * 0.4 +
    (1 - a.metrics.tokenReduction) * 0.3 +
    (a.metrics.optimizedTokens < 2000 ? 0.3 : 0.1);

  const scoreB =
    b.metrics.clarityScore * 0.4 +
    (1 - b.metrics.tokenReduction) * 0.3 +
    (b.metrics.optimizedTokens < 2000 ? 0.3 : 0.1);

  const diff = Math.abs(scoreA - scoreB);
  if (diff < 0.05) return 'equal';
  return scoreA > scoreB ? 'a' : 'b';
}
