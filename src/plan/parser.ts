/**
 * PLAN.md Parser
 *
 * Parses markdown PLAN.md files into structured Plan objects.
 * Handles YAML frontmatter, XML-style task blocks, and markdown sections.
 */

import type {
  Plan,
  PlanMetadata,
  PlanMustHaves,
  PlanTask,
  ArtifactDefinition,
  KeyLink,
  ParseResult,
  ParseError,
  ParseWarning,
} from './types.js';

// ============================================================================
// Parser Configuration
// ============================================================================

const FRONTMATTER_DELIMITER = '---';
const TASK_TAG_REGEX = /<task\s+([^>]*)>([\s\S]*?)<\/task>/gi;
const TASK_ATTR_REGEX = /(\w+)=["']([^"']+)["']/g;
const XML_TAG_REGEX = /<\/?[^>]+>/g;

// ============================================================================
// Main Parser
// ============================================================================

/**
 * Parse a PLAN.md file content into a structured Plan object
 */
export function parsePlan(content: string, sourcePath?: string): ParseResult {
  const errors: ParseError[] = [];
  const warnings: ParseWarning[] = [];

  try {
    // Parse frontmatter
    const frontmatterResult = parseFrontmatter(content);
    if (frontmatterResult.errors.length > 0) {
      errors.push(...frontmatterResult.errors);
    }

    // Parse sections
    const sections = parseSections(content);

    // Parse tasks
    const tasks = parseTasks(content, errors);

    // Build plan object
    const plan: Plan = {
      metadata: frontmatterResult.metadata,
      mustHaves: frontmatterResult.mustHaves,
      objective: sections.objective || '',
      executionContext: sections.executionContext,
      context: sections.context || [],
      tasks,
      verification: sections.verification || [],
      successCriteria: sections.successCriteria || '',
      output: sections.output,
    };

    // Validate minimum requirements
    if (!plan.objective && !sections.raw.includes('<objective>')) {
      warnings.push({
        code: 'MISSING_OBJECTIVE',
        message: 'Plan is missing an objective section',
      });
    }

    if (plan.tasks.length === 0) {
      warnings.push({
        code: 'NO_TASKS',
        message: 'Plan contains no tasks',
      });
    }

    return {
      success: errors.length === 0,
      plan: errors.length === 0 ? plan : undefined,
      errors,
      warnings,
    };
  } catch (error) {
    return {
      success: false,
      errors: [
        {
          code: 'PARSE_EXCEPTION',
          message: error instanceof Error ? error.message : 'Unknown parse error',
        },
      ],
      warnings,
    };
  }
}

// ============================================================================
// Frontmatter Parser
// ============================================================================

interface FrontmatterResult {
  metadata: PlanMetadata;
  mustHaves: PlanMustHaves;
  errors: ParseError[];
}

function parseFrontmatter(content: string): FrontmatterResult {
  const errors: ParseError[] = [];

  // Default values
  const metadata: PlanMetadata = {
    phase: '',
    plan: '',
    type: 'execute',
    wave: 1,
    depends_on: [],
    files_modified: [],
    autonomous: false,
    requirements: [],
  };

  const mustHaves: PlanMustHaves = {
    truths: [],
    artifacts: [],
    key_links: [],
  };

  // Check for frontmatter
  if (!content.startsWith(FRONTMATTER_DELIMITER)) {
    errors.push({
      code: 'MISSING_FRONTMATTER',
      message: 'Plan must start with YAML frontmatter (---)',
    });
    return { metadata, mustHaves, errors };
  }

  const endIndex = content.indexOf(FRONTMATTER_DELIMITER, FRONTMATTER_DELIMITER.length);
  if (endIndex === -1) {
    errors.push({
      code: 'UNTERMINATED_FRONTMATTER',
      message: 'Frontmatter delimiter (---) not closed',
    });
    return { metadata, mustHaves, errors };
  }

  const frontmatterContent = content.substring(FRONTMATTER_DELIMITER.length, endIndex).trim();

  // Parse YAML-like structure (simplified)
  parseYamlLike(frontmatterContent, metadata, mustHaves, errors);

  return { metadata, mustHaves, errors };
}

function parseYamlLike(
  content: string,
  metadata: PlanMetadata,
  mustHaves: PlanMustHaves,
  errors: ParseError[]
): void {
  const lines = content.split('\n');
  let currentSection: string | null = null;
  let currentSubSection: string | null = null;
  let indentLevel = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Calculate indent
    const leadingSpaces = line.length - line.trimStart().length;
    indentLevel = Math.floor(leadingSpaces / 2);

    // Top-level keys
    if (indentLevel === 0) {
      const colonIndex = trimmed.indexOf(':');
      if (colonIndex === -1) continue;

      const key = trimmed.substring(0, colonIndex).trim();
      const value = trimmed.substring(colonIndex + 1).trim();

      switch (key) {
        case 'phase':
          metadata.phase = value.replace(/['"]/g, '');
          break;
        case 'plan':
          metadata.plan = value.replace(/['"]/g, '');
          break;
        case 'type':
          if (['execute', 'research', 'design'].includes(value)) {
            metadata.type = value as 'execute' | 'research' | 'design';
          } else {
            (metadata.type as string) = value; // Preserve invalid value for validator to catch
          }
          break;
        case 'wave':
          const waveVal = parseInt(value, 10);
          metadata.wave = isNaN(waveVal) ? 1 : waveVal;
          break;
        case 'autonomous':
          metadata.autonomous = value === 'true';
          break;
        case 'depends_on':
        case 'files_modified':
        case 'requirements':
          currentSection = key;
          if (value === '[]') {
            metadata[key] = [];
          }
          break;
        case 'must_haves':
          currentSection = 'must_haves';
          break;
        default:
          currentSection = key;
      }
      continue;
    }

    // Array items (indent level 1)
    if (indentLevel === 1 && trimmed.startsWith('- ')) {
      const item = trimmed.substring(2).trim();

      if (currentSection === 'depends_on') {
        metadata.depends_on.push(item.replace(/['"]/g, ''));
      } else if (currentSection === 'files_modified') {
        metadata.files_modified.push(item.replace(/['"]/g, ''));
      } else if (currentSection === 'requirements') {
        metadata.requirements.push(item.replace(/['"]/g, ''));
      } else if (currentSection === 'must_haves') {
        // Handle must_haves subsections
        if (item.endsWith(':')) {
          currentSubSection = item.slice(0, -1);
        }
      }
      continue;
    }

    // Must-haves subsections
    if (currentSection === 'must_haves') {
      if (trimmed.startsWith('truths:')) {
        currentSubSection = 'truths';
      } else if (trimmed.startsWith('artifacts:')) {
        currentSubSection = 'artifacts';
      } else if (trimmed.startsWith('key_links:')) {
        currentSubSection = 'key_links';
      } else if (trimmed.startsWith('user_setup:')) {
        currentSubSection = 'user_setup';
      } else if (indentLevel >= 2 && trimmed.startsWith('- ')) {
        const item = trimmed.substring(2).trim();

        if (currentSubSection === 'truths') {
          mustHaves.truths.push(item.replace(/['"]/g, ''));
        } else if (currentSubSection === 'artifacts' && item.includes(':')) {
          // Nested artifact property (e.g., "path: src/foo.ts")
          const colonIdx = item.indexOf(':');
          const propKey = item.substring(0, colonIdx).trim();
          const propValue = item.substring(colonIdx + 1).trim().replace(/['"]/g, '');
          
          const currentArtifact = mustHaves.artifacts[mustHaves.artifacts.length - 1];
          if (currentArtifact) {
            if (propKey === 'path') currentArtifact.path = propValue;
            else if (propKey === 'provides') currentArtifact.provides = propValue;
            else if (propKey === 'exports') currentArtifact.exports = propValue.split(',').map(s => s.trim());
            else if (propKey === 'min_lines') currentArtifact.minLines = parseInt(propValue, 10);
            else if (propKey === 'contains') currentArtifact.contains = propValue;
          }
        } else if (currentSubSection === 'artifacts' && !item.includes(':')) {
          // New artifact entry
          mustHaves.artifacts.push({ path: item.replace(/['"]/g, ''), provides: '' });
        } else if (currentSubSection === 'key_links' && item.includes(':')) {
          // Nested key_link property
          const colonIdx = item.indexOf(':');
          const propKey = item.substring(0, colonIdx).trim();
          const propValue = item.substring(colonIdx + 1).trim().replace(/['"]/g, '');
          
          const currentLink = mustHaves.key_links[mustHaves.key_links.length - 1];
          if (currentLink) {
            if (propKey === 'from') currentLink.from = propValue;
            else if (propKey === 'to') currentLink.to = propValue;
            else if (propKey === 'via') currentLink.via = propValue;
            else if (propKey === 'pattern') currentLink.pattern = propValue;
          }
        } else if (currentSubSection === 'key_links' && !item.includes(':')) {
          // New key_link entry
          mustHaves.key_links.push({ from: '', to: '', via: '' });
        }
      }
    }
  }
}

// ============================================================================
// Section Parser
// ============================================================================

interface ParsedSections {
  objective: string;
  executionContext?: string;
  context: string[];
  verification: string[];
  successCriteria: string;
  output?: string;
  raw: string;
}

function parseSections(content: string): ParsedSections {
  const sections: ParsedSections = {
    objective: '',
    context: [],
    verification: [],
    successCriteria: '',
    raw: content,
  };

  // Extract content after frontmatter
  const frontmatterEnd = content.indexOf(FRONTMATTER_DELIMITER, FRONTMATTER_DELIMITER.length);
  const bodyContent = frontmatterEnd !== -1
    ? content.substring(frontmatterEnd + FRONTMATTER_DELIMITER.length)
    : content;

  // Parse objective
  const objectiveMatch = bodyContent.match(/<objective>([\s\S]*?)<\/objective>/i);
  if (objectiveMatch) {
    sections.objective = cleanXmlContent(objectiveMatch[1]);
  }

  // Parse execution context
  const contextMatch = bodyContent.match(/<execution_context>([\s\S]*?)<\/execution_context>/i);
  if (contextMatch) {
    sections.executionContext = cleanXmlContent(contextMatch[1]);
  }

  // Parse context references (from <context> tag or @ references)
  const contextSectionMatch = bodyContent.match(/<context>([\s\S]*?)<\/context>/i);
  if (contextSectionMatch) {
    const contextContent = contextSectionMatch[1];
    // Find @ references
    const refs = contextContent.match(/@[\w\/\-.]+/g);
    if (refs) {
      sections.context = refs.map(r => r.substring(1));
    }
  }

  // Parse verification checklist
  const verificationMatch = bodyContent.match(/<verification>([\s\S]*?)<\/verification>/i);
  if (verificationMatch) {
    const verifyContent = verificationMatch[1];
    // Extract checklist items
    const items = verifyContent.match(/^\s*-\s+\[.\]\s+.+$/gm);
    if (items) {
      sections.verification = items.map(item =>
        item.replace(/^\s*-\s+\[[ x]\]\s+/, '').trim()
      );
    }
  }

  // Parse success criteria
  const successMatch = bodyContent.match(/<success_criteria>([\s\S]*?)<\/success_criteria>/i);
  if (successMatch) {
    sections.successCriteria = cleanXmlContent(successMatch[1]);
  }

  // Parse output
  const outputMatch = bodyContent.match(/<output>([\s\S]*?)<\/output>/i);
  if (outputMatch) {
    sections.output = cleanXmlContent(outputMatch[1]);
  }

  return sections;
}

// ============================================================================
// Task Parser
// ============================================================================

function parseTasks(content: string, errors: ParseError[]): PlanTask[] {
  const tasks: PlanTask[] = [];
  let match;
  let taskIndex = 0;

  // Reset regex
  TASK_TAG_REGEX.lastIndex = 0;

  while ((match = TASK_TAG_REGEX.exec(content)) !== null) {
    taskIndex++;
    const attributes = match[1];
    const body = match[2];

    try {
      const task = parseTaskAttributes(attributes, body, taskIndex);
      tasks.push(task);
    } catch (error) {
      errors.push({
        code: 'TASK_PARSE_ERROR',
        message: error instanceof Error ? error.message : 'Failed to parse task',
        line: getLineNumber(content, match.index),
      });
    }
  }

  return tasks;
}

function parseTaskAttributes(attributes: string, body: string, index: number): PlanTask {
  const task: PlanTask = {
    id: `task-${index}`,
    type: 'auto',
    name: '',
    files: [],
    action: '',
    done: '',
  };

  // Parse attributes
  let attrMatch;
  while ((attrMatch = TASK_ATTR_REGEX.exec(attributes)) !== null) {
    const key = attrMatch[1];
    const value = attrMatch[2];

    switch (key) {
      case 'type':
        if (['auto', 'manual', 'decision'].includes(value) || value.startsWith('checkpoint:')) {
          task.type = value as PlanTask['type'];
        } else {
          (task.type as string) = value;
        }
        break;
      case 'tdd':
        task.tdd = value === 'true';
        break;
    }
  }

  // Parse body content
  parseTaskBody(body, task);

  // Generate name from first line of action if not set
  if (!task.name && task.action) {
    task.name = task.action.split('\n')[0].substring(0, 50);
  }

  return task;
}

function parseTaskBody(body: string, task: PlanTask): void {
  // Extract name from <name> tag
  const nameMatch = body.match(/<name>([\s\S]*?)<\/name>/i);
  if (nameMatch) {
    task.name = cleanXmlContent(nameMatch[1]);
  }

  // Extract files from <files> tag
  const filesMatch = body.match(/<files>([\s\S]*?)<\/files>/i);
  if (filesMatch) {
    const filesContent = cleanXmlContent(filesMatch[1]);
    task.files = filesContent
      .split(/[\n,]/)
      .map(f => f.trim())
      .filter(f => f.length > 0);
  }

  // Extract action from <action> tag
  const actionMatch = body.match(/<action>([\s\S]*?)<\/action>/i);
  if (actionMatch) {
    task.action = cleanXmlContent(actionMatch[1]);
  }

  // Extract verify from <verify> tag
  const verifyMatch = body.match(/<verify>([\s\S]*?)<\/verify>/i);
  if (verifyMatch) {
    task.verify = cleanXmlContent(verifyMatch[1]);
  }

  // Extract done from <done> tag
  const doneMatch = body.match(/<done>([\s\S]*?)<\/done>/i);
  if (doneMatch) {
    task.done = cleanXmlContent(doneMatch[1]);
  }

  // Extract behavior from <behavior> tag
  const behaviorMatch = body.match(/<behavior>([\s\S]*?)<\/behavior>/i);
  if (behaviorMatch) {
    const behaviorContent = cleanXmlContent(behaviorMatch[1]);
    task.behavior = behaviorContent
      .split('\n')
      .map(b => b.trim())
      .filter(b => b.startsWith('- '))
      .map(b => b.substring(2).trim());
  }

  // Parse checkpoint-specific data for checkpoint:* task types
  if (task.type.startsWith('checkpoint:')) {
    task.checkpointData = parseCheckpointData(body, task.type);
  }
}

function parseCheckpointData(body: string, taskType: string): PlanTask['checkpointData'] {
  const data: PlanTask['checkpointData'] = {};

  // Common checkpoint fields
  const whatBuiltMatch = body.match(/<what-built>([\s\S]*?)<\/what-built>/i);
  if (whatBuiltMatch) {
    data.whatBuilt = cleanXmlContent(whatBuiltMatch[1]);
  }

  const howToVerifyMatch = body.match(/<how-to-verify>([\s\S]*?)<\/how-to-verify>/i);
  if (howToVerifyMatch) {
    data.howToVerify = cleanXmlContent(howToVerifyMatch[1]);
  }

  const resumeSignalMatch = body.match(/<resume-signal>([\s\S]*?)<\/resume-signal>/i);
  if (resumeSignalMatch) {
    data.resumeSignal = cleanXmlContent(resumeSignalMatch[1]);
  }

  const gateMatch = body.match(/<gate>([\s\S]*?)<\/gate>/i);
  if (gateMatch) {
    data.gate = cleanXmlContent(gateMatch[1]);
  }

  // checkpoint:decision specific
  if (taskType === 'checkpoint:decision') {
    const decisionMatch = body.match(/<decision>([\s\S]*?)<\/decision>/i);
    if (decisionMatch) {
      data.decision = cleanXmlContent(decisionMatch[1]);
    }

    const contextMatch = body.match(/<context>([\s\S]*?)<\/context>/i);
    if (contextMatch) {
      data.context = cleanXmlContent(contextMatch[1]);
    }

    const optionsMatch = body.match(/<options>([\s\S]*?)<\/options>/i);
    if (optionsMatch) {
      const optionsContent = optionsMatch[1];
      const optionMatches = optionsContent.matchAll(/<option\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/option>/gi);
      data.options = Array.from(optionMatches).map(match => ({
        id: match[1],
        name: cleanXmlContent(match[2]),
      }));
    }
  }

  // checkpoint:human-action specific
  if (taskType === 'checkpoint:human-action') {
    const actionRequiredMatch = body.match(/<action-required>([\s\S]*?)<\/action-required>/i);
    if (actionRequiredMatch) {
      data.actionRequired = cleanXmlContent(actionRequiredMatch[1]);
    }

    const whyMatch = body.match(/<why>([\s\S]*?)<\/why>/i);
    if (whyMatch) {
      data.why = cleanXmlContent(whyMatch[1]);
    }

    const stepsMatch = body.match(/<steps>([\s\S]*?)<\/steps>/i);
    if (stepsMatch) {
      const stepsContent = cleanXmlContent(stepsMatch[1]);
      data.steps = stepsContent
        .split('\n')
        .map(s => s.trim())
        .filter(s => s.length > 0);
    }

    const provideSecretsMatch = body.match(/<provide-secrets>([\s\S]*?)<\/provide-secrets>/i);
    if (provideSecretsMatch) {
      const secretsContent = cleanXmlContent(provideSecretsMatch[1]);
      data.provideSecrets = secretsContent
        .split('\n')
        .map(s => s.trim())
        .filter(s => s.length > 0)
        .reduce((acc, secret) => {
          acc[secret] = '';
          return acc;
        }, {} as Record<string, string>);
    }
  }

  return data;
}

// ============================================================================
// Utility Functions
// ============================================================================

function cleanXmlContent(content: string): string {
  return content
    .replace(XML_TAG_REGEX, '')
    .trim();
}

function getLineNumber(content: string, index: number): number {
  const lines = content.substring(0, index).split('\n');
  return lines.length;
}

// ============================================================================
// @-Reference Resolution
// ============================================================================

const fileCache = new Map<string, string>();

export interface ResolveContextOptions {
  projectRoot: string;
  cache?: boolean;
}

export async function resolveContextReferences(
  context: string[],
  options: ResolveContextOptions
): Promise<Record<string, string>> {
  const resolved: Record<string, string> = {};
  const cache = options.cache !== false;

  for (const ref of context) {
    const resolvedPath = resolveRefPath(ref, options.projectRoot);
    
    if (resolvedPath) {
      try {
        let content: string | undefined;
        
        if (cache && fileCache.has(resolvedPath)) {
          content = fileCache.get(resolvedPath);
        } else {
          const fs = await import('fs/promises');
          content = await fs.readFile(resolvedPath, 'utf-8');
          if (cache) {
            fileCache.set(resolvedPath, content);
          }
        }
        
        if (content) {
          resolved[ref] = content;
        }
      } catch {
        resolved[ref] = `[File not found: ${resolvedPath}]`;
      }
    }
  }

  return resolved;
}

function resolveRefPath(ref: string, projectRoot: string): string | null {
  if (ref.startsWith('@.')) {
    const relativePath = ref.substring(2);
    return `${projectRoot}/${relativePath}`;
  } else if (ref.startsWith('@')) {
    const relativePath = ref.substring(1);
    return `${projectRoot}/${relativePath}`;
  } else if (ref.startsWith('/')) {
    return ref;
  }
  return `${projectRoot}/${ref}`;
}

export function clearContextCache(): void {
  fileCache.clear();
}

// ============================================================================
// Export Parser Class
// ============================================================================

/**
 * PLAN.md Parser class for programmatic use
 */
export class PlanParser {
  /**
   * Parse a PLAN.md file from string content
   */
  parse(content: string, sourcePath?: string): ParseResult {
    return parsePlan(content, sourcePath);
  }

  /**
   * Parse a PLAN.md file from a file path
   * (Node.js environment only)
   */
  async parseFile(filePath: string): Promise<ParseResult> {
    const fs = await import('fs/promises');
    const content = await fs.readFile(filePath, 'utf-8');
    return this.parse(content, filePath);
  }

  /**
   * Resolve @-references in context and populate contextResolved
   */
  async resolveContext(plan: Plan, projectRoot: string): Promise<Plan> {
    const resolved = await resolveContextReferences(plan.context, { projectRoot });
    return {
      ...plan,
      contextResolved: resolved,
    };
  }
}
