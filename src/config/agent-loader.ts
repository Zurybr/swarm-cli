import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';

export interface AgentMarkdownFile {
  filename: string;
  filepath: string;
  frontmatter: Record<string, unknown>;
  content: string;
}

export function loadAgentMarkdownFiles(agentsDir: string): AgentMarkdownFile[] {
  if (!fs.existsSync(agentsDir)) {
    return [];
  }

  const files = fs.readdirSync(agentsDir).filter((f) => f.endsWith('.md'));

  return files.map((filename) => {
    const filepath = path.join(agentsDir, filename);
    const fileContent = fs.readFileSync(filepath, 'utf-8');
    const { frontmatter, body } = parseMarkdownWithFrontmatter(fileContent);

    return {
      filename,
      filepath,
      frontmatter,
      content: body,
    };
  });
}

export function parseMarkdownWithFrontmatter(
  content: string
): { frontmatter: Record<string, unknown>; body: string } {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { frontmatter: {}, body: content };
  }

  const [, frontmatterStr, body] = match;
  const frontmatter = yaml.parse(frontmatterStr) || {};

  return { frontmatter, body };
}

export function loadSingleAgentMarkdown(filepath: string): AgentMarkdownFile | null {
  if (!fs.existsSync(filepath)) {
    return null;
  }

  const filename = path.basename(filepath);
  const fileContent = fs.readFileSync(filepath, 'utf-8');
  const { frontmatter, body } = parseMarkdownWithFrontmatter(fileContent);

  return {
    filename,
    filepath,
    frontmatter,
    content: body,
  };
}
