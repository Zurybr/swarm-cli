/**
 * MCP Init Command - Issue #24.6
 * CLI command for creating new MCP server projects
 */

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../../utils/logger.js';

const logger = new Logger('MCPInit');

interface InitOptions {
  name?: string;
  description?: string;
  template?: string;
  force?: boolean;
}

/**
 * Create the mcp init command
 */
export function createMCPInitCommand(): Command {
  const cmd = new Command('init')
    .description('Create a new MCP server project')
    .argument('[name]', 'Project name')
    .option('-d, --description <desc>', 'Project description')
    .option('-t, --template <template>', 'Template to use', 'default')
    .option('-f, --force', 'Overwrite existing files')
    .action(async (projectName: string | undefined, options: InitOptions) => {
      try {
        await initProject(projectName, options);
      } catch (error) {
        logger.error(
          `Failed to create project: ${error instanceof Error ? error.message : String(error)}`
        );
        process.exit(1);
      }
    });

  return cmd;
}

/**
 * Initialize a new MCP server project
 */
async function initProject(
  projectName: string | undefined,
  options: InitOptions
): Promise<void> {
  const name = projectName || options.name || 'my-mcp-server';
  const description =
    options.description || 'A custom MCP server built with Swarm CLI SDK';
  const projectDir = path.resolve(process.cwd(), name);

  console.log(chalk.bold(`\n🚀 Creating MCP server project: ${name}\n`));

  // Check if directory exists
  if (fs.existsSync(projectDir)) {
    if (!options.force) {
      throw new Error(
        `Directory "${name}" already exists. Use --force to overwrite.`
      );
    }
    console.log(chalk.yellow(`Overwriting existing directory: ${name}`));
    fs.rmSync(projectDir, { recursive: true });
  }

  // Create project structure
  fs.mkdirSync(projectDir, { recursive: true });
  fs.mkdirSync(path.join(projectDir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(projectDir, 'tests'), { recursive: true });

  // Generate files
  generatePackageJson(projectDir, name, description);
  generateTsConfig(projectDir);
  generateReadme(projectDir, name, description);
  generateIndexTs(projectDir, name, description);
  generateTest(projectDir, name);
  generateGitignore(projectDir);

  console.log(chalk.green('\n✅ Project created successfully!\n'));
  console.log(chalk.bold('Next steps:\n'));
  console.log(`  cd ${name}`);
  console.log('  npm install');
  console.log('  npm run build');
  console.log('  npm start\n');
  console.log(chalk.gray('Or use dev mode:'));
  console.log('  npm run dev\n');
  console.log(chalk.gray('Test your server:'));
  console.log('  npm test\n');
}

/**
 * Generate package.json
 */
function generatePackageJson(
  projectDir: string,
  name: string,
  description: string
): void {
  const packageJson = {
    name,
    version: '1.0.0',
    description,
    type: 'module',
    main: 'dist/index.js',
    types: 'dist/index.d.ts',
    bin: {
      [name]: './dist/index.js',
    },
    scripts: {
      build: 'tsc',
      dev: 'tsc --watch',
      start: 'node dist/index.js',
      test: 'vitest run',
      'test:watch': 'vitest',
    },
    dependencies: {
      '@swarm-cli/mcp-sdk': '^0.1.0',
      '@modelcontextprotocol/sdk': '^1.0.0',
      zod: '^3.23.0',
    },
    devDependencies: {
      '@types/node': '^20.0.0',
      typescript: '^5.3.0',
      vitest: '^1.0.0',
    },
    engines: {
      node: '>=18.0.0',
    },
    keywords: ['mcp', 'model-context-protocol', 'ai', 'llm'],
    license: 'MIT',
  };

  fs.writeFileSync(
    path.join(projectDir, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );

  console.log(chalk.gray('  ✓ package.json'));
}

/**
 * Generate tsconfig.json
 */
function generateTsConfig(projectDir: string): void {
  const tsConfig = {
    compilerOptions: {
      target: 'ES2022',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      outDir: './dist',
      rootDir: './src',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      declaration: true,
      declarationMap: true,
      sourceMap: true,
    },
    include: ['src/**/*'],
    exclude: ['node_modules', 'dist', 'tests'],
  };

  fs.writeFileSync(
    path.join(projectDir, 'tsconfig.json'),
    JSON.stringify(tsConfig, null, 2)
  );

  console.log(chalk.gray('  ✓ tsconfig.json'));
}

/**
 * Generate README.md
 */
function generateReadme(
  projectDir: string,
  name: string,
  description: string
): void {
  const readme = `# ${name}

${description}

## Installation

\`\`\`bash
npm install
npm run build
\`\`\`

## Usage

\`\`\`bash
npm start
\`\`\`

## Development

\`\`\`bash
npm run dev
\`\`\`

## Testing

\`\`\`bash
npm test
\`\`\`

## Tools

This server provides the following tools:

- \`greet\` - Greet someone by name

## Configuration

Add to your Swarm CLI config (\`~/.config/swarm-cli/config.yaml\`):

\`\`\`yaml
mcp:
  servers:
    ${name}:
      command: node
      args: ["${name}/dist/index.js"]
\`\`\`

## License

MIT
`;

  fs.writeFileSync(path.join(projectDir, 'README.md'), readme);

  console.log(chalk.gray('  ✓ README.md'));
}

/**
 * Generate src/index.ts
 */
function generateIndexTs(
  projectDir: string,
  name: string,
  description: string
): void {
  const indexTs = `#!/usr/bin/env node

import { MCPServerBuilder, createTool } from '@swarm-cli/mcp-sdk';
import { z } from 'zod';

const server = new MCPServerBuilder({
  name: '${name}',
  version: '1.0.0',
  description: '${description}',
});

// Example tool: greet
server.addTool(
  createTool({
    name: 'greet',
    description: 'Greet someone by name',
    parameters: {
      name: z.string().describe('The name to greet'),
      formal: z.boolean().optional().describe('Use formal greeting'),
    },
    handler: async ({ name, formal }) => {
      const greeting = formal ? 'Good day' : 'Hello';
      return {
        content: [
          {
            type: 'text',
            text: \`\${greeting}, \${name}!\`,
          },
        ],
      };
    },
  })
);

// Add more tools here...

// Start the server
server.start().catch((error) => {
  console.error('Server failed:', error);
  process.exit(1);
});
`;

  fs.writeFileSync(path.join(projectDir, 'src', 'index.ts'), indexTs);

  console.log(chalk.gray('  ✓ src/index.ts'));
}

/**
 * Generate test file
 */
function generateTest(projectDir: string, name: string): void {
  const testFile = `import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MCPTestClient, testTool } from '@swarm-cli/mcp-sdk/testing';

describe('${name}', () => {
  const client = new MCPTestClient('./dist/index.js');

  beforeAll(async () => {
    await client.connect();
  });

  afterAll(async () => {
    await client.close();
  });

  it('should list tools', async () => {
    const tools = await client.listTools();
    expect(tools.length).toBeGreaterThan(0);
    expect(tools.find((t) => t.name === 'greet')).toBeDefined();
  });

  it('should greet by name', async () => {
    const result = await testTool(client, 'greet', { name: 'World' }, {
      containsText: 'Hello, World!',
    });
    expect(result.isError).toBeFalsy();
  });

  it('should use formal greeting', async () => {
    const result = await testTool(client, 'greet', { 
      name: 'World', 
      formal: true 
    }, {
      containsText: 'Good day',
    });
    expect(result.isError).toBeFalsy();
  });
});
`;

  fs.writeFileSync(path.join(projectDir, 'tests', 'index.test.ts'), testFile);

  console.log(chalk.gray('  ✓ tests/index.test.ts'));
}

/**
 * Generate .gitignore
 */
function generateGitignore(projectDir: string): void {
  const gitignore = `# Dependencies
node_modules/

# Build output
dist/

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*

# Environment
.env
.env.local
`;

  fs.writeFileSync(path.join(projectDir, '.gitignore'), gitignore);

  console.log(chalk.gray('  ✓ .gitignore'));
}

/**
 * Create init command for mcp command group
 */
export function registerMCPInitCommand(mcpCommand: Command): void {
  mcpCommand.addCommand(createMCPInitCommand());
}
