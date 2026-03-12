import { SubagentType } from './registry';

export interface ParsedMention {
  subagent: SubagentType;
  query: string;
  raw: string;
  startIndex: number;
  endIndex: number;
}

export interface ParseResult {
  mentions: ParsedMention[];
  cleanedMessage: string;
  hasMentions: boolean;
}

const SUBAGENT_PATTERN = /@(\w+)\s+(.+?)(?=(?:@\w+|$))/gs;

export function parseMentions(message: string): ParseResult {
  const mentions: ParsedMention[] = [];
  let cleanedMessage = message;
  let match: RegExpExecArray | null;

  const regex = /@(\w+)\s+(.+?)(?=(?:@\w+)|$)/g;
  
  while ((match = regex.exec(message)) !== null) {
    const subagentName = match[1].toLowerCase();
    const query = match[2].trim();
    const validSubagents: SubagentType[] = ['general', 'explore', 'researcher', 'debugger', 'tester'];
    
    if (validSubagents.includes(subagentName as SubagentType)) {
      mentions.push({
        subagent: subagentName as SubagentType,
        query,
        raw: match[0],
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      });
    }
  }

  cleanedMessage = message.replace(SUBAGENT_PATTERN, '').trim();

  return {
    mentions,
    cleanedMessage,
    hasMentions: mentions.length > 0,
  };
}

export function extractFirstMention(message: string): ParsedMention | null {
  const result = parseMentions(message);
  return result.mentions[0] || null;
}

export function removeMentions(message: string): string {
  return message.replace(SUBAGENT_PATTERN, '').trim();
}

export function getMentionedSubagents(message: string): SubagentType[] {
  const result = parseMentions(message);
  return result.mentions.map(m => m.subagent);
}

export function buildSubagentPrompt(
  subagentType: SubagentType,
  query: string,
  context?: string
): string {
  const subagentPrompts: Record<SubagentType, string> = {
    general: `As @general, ${query}`,
    explore: `Explore the codebase to answer: ${query}`,
    researcher: `Research and find information about: ${query}`,
    debugger: `Debug and find the root cause of: ${query}`,
    tester: `Test and verify: ${query}`,
  };

  let prompt = subagentPrompts[subagentType];

  if (context) {
    prompt += `\n\nContext:\n${context}`;
  }

  return prompt;
}
