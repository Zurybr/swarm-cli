/**
 * MCP Configuration Wizard - Issue #24.4
 * Interactive configuration for MCP servers
 */

import inquirer from 'inquirer';
import { MCPRegistryManager, MCPRegistryEntry, JSONSchema } from './registry';
import { MCPInstaller } from './installer';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { parse as parseYAML, stringify as stringifyYAML } from 'yaml';

/**
 * Configuration wizard for MCP servers
 */
export class MCPConfigWizard {
  constructor(
    private registry: MCPRegistryManager,
    private installer: MCPInstaller
  ) {}

  /**
   * Interactive setup for a server
   */
  async configure(serverName: string): Promise<void> {
    // 1. Get server info from registry
    const entry = await this.registry.get(serverName);
    
    if (!entry) {
      console.error(`❌ Server "${serverName}" not found in registry`);
      console.log('\n💡 Search for servers with: swarm-cli mcp search <query>');
      return;
    }

    console.log(`\n📦 Configuring ${entry.displayName}\n`);
    console.log(`   ${entry.description}\n`);

    // 2. Check if installed
    if (!entry.installed) {
      const { shouldInstall } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'shouldInstall',
          message: `${entry.displayName} is not installed. Install it now?`,
          default: true,
        },
      ]);

      if (shouldInstall) {
        await this.installer.install(serverName);
        console.log('');
      } else {
        console.log('Configuration cancelled.');
        return;
      }
    }

    // 3. Prompt for required config values
    const config: Record<string, unknown> = {};

    // Handle required environment variables
    if (entry.requiredEnv && entry.requiredEnv.length > 0) {
      console.log('This server requires:\n');
      entry.requiredEnv.forEach(envVar => {
        console.log(`  • ${envVar}`);
      });
      console.log('');

      for (const envVar of entry.requiredEnv) {
        const { value } = await inquirer.prompt([
          {
            type: 'password',
            name: 'value',
            message: `Enter ${envVar}:`,
            mask: '*',
            validate: (input: string) => input.length > 0 || 'This value is required',
          },
        ]);

        config[envVar] = value;
      }
    }

    // Handle config schema
    if (entry.configSchema) {
      const schemaConfig = await this.promptFromSchema(entry.configSchema);
      Object.assign(config, schemaConfig);
    }

    // 4. Save configuration
    await this.saveConfig(entry.name, config);

    console.log('\n✅ Configuration saved!');

    // 5. Test connection
    const { shouldTest } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'shouldTest',
        message: 'Test connection now?',
        default: true,
      },
    ]);

    if (shouldTest) {
      await this.testConnection(entry.name);
    }
  }

  /**
   * Prompt for values based on JSON schema
   */
  private async promptFromSchema(schema: JSONSchema): Promise<Record<string, unknown>> {
    const config: Record<string, unknown> = {};

    if (!schema.properties) {
      return config;
    }

    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      const isRequired = schema.required?.includes(propName);
      
      const promptConfig: any = {
        name: 'value',
        message: propSchema.description || `Enter ${propName}:`,
      };

      // Determine prompt type based on schema
      if (propSchema.type === 'boolean') {
        promptConfig.type = 'confirm';
        promptConfig.default = propSchema.default || false;
      } else if (propSchema.enum) {
        promptConfig.type = 'list';
        promptConfig.choices = propSchema.enum;
        promptConfig.default = propSchema.default;
      } else if (propSchema.type === 'number' || propSchema.type === 'integer') {
        promptConfig.type = 'number';
        promptConfig.default = propSchema.default;
      } else if (propSchema.type === 'array' && propSchema.items?.type === 'string') {
        promptConfig.type = 'input';
        promptConfig.message += ' (comma-separated)';
      } else {
        // Default to string
        promptConfig.type = 'input';
        promptConfig.default = propSchema.default;

        // Mask sensitive fields
        if (propName.toLowerCase().includes('token') || 
            propName.toLowerCase().includes('password') ||
            propName.toLowerCase().includes('secret')) {
          promptConfig.type = 'password';
          promptConfig.mask = '*';
        }
      }

      // Add validation for required fields
      if (isRequired) {
        const originalValidate = promptConfig.validate;
        promptConfig.validate = (input: any) => {
          if (!input || (typeof input === 'string' && input.trim().length === 0)) {
            return `${propName} is required`;
          }
          return originalValidate ? originalValidate(input) : true;
        };
      }

      const { value } = await inquirer.prompt([promptConfig]);

      // Process array input
      if (propSchema.type === 'array' && typeof value === 'string') {
        config[propName] = value.split(',').map((s: string) => s.trim()).filter(Boolean);
      } else {
        config[propName] = value;
      }
    }

    return config;
  }

  /**
   * Save configuration to file
   */
  private async saveConfig(serverName: string, config: Record<string, unknown>): Promise<void> {
    const configPath = this.getConfigPath();
    let fullConfig: any = { mcp: { servers: {} } };

    // Load existing config
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8');
      try {
        fullConfig = parseYAML(content);
      } catch {
        // If parsing fails, use default
      }
    }

    // Ensure structure exists
    if (!fullConfig.mcp) fullConfig.mcp = {};
    if (!fullConfig.mcp.servers) fullConfig.mcp.servers = {};

    // Update or create server config
    const existingConfig = fullConfig.mcp.servers[serverName] || {};
    
    // Merge environment variables
    if (!existingConfig.env) {
      existingConfig.env = {};
    }

    // Map config to env vars or args based on schema
    const entry = await this.registry.get(serverName);
    if (entry?.requiredEnv) {
      for (const envVar of entry.requiredEnv) {
        if (config[envVar] !== undefined) {
          existingConfig.env[envVar] = config[envVar];
        }
      }
    }

    // Add other config to args or env
    for (const [key, value] of Object.entries(config)) {
      if (entry?.requiredEnv?.includes(key)) {
        continue; // Already handled
      }
      
      // For now, add to env
      existingConfig.env[key] = value;
    }

    fullConfig.mcp.servers[serverName] = existingConfig;

    // Save to file
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(configPath, stringifyYAML(fullConfig), 'utf-8');
    console.log(`\n💾 Configuration saved to ${configPath}`);
  }

  /**
   * Get config file path
   */
  private getConfigPath(): string {
    return path.join(os.homedir(), '.config', 'swarm-cli', 'config.yaml');
  }

  /**
   * Test server connection
   */
  private async testConnection(serverName: string): Promise<void> {
    console.log('\n🔌 Testing connection...');
    
    const result = await this.installer.test(serverName);
    
    if (result.success) {
      console.log(`✅ ${result.message}`);
    } else {
      console.log(`❌ ${result.message}`);
    }
  }

  /**
   * Interactive search and install
   */
  async interactiveInstall(): Promise<void> {
    console.log('\n🔍 MCP Server Marketplace\n');

    // Show categories
    const tags = await this.registry.getTags();
    
    const { searchType } = await inquirer.prompt([
      {
        type: 'list',
        name: 'searchType',
        message: 'How would you like to find a server?',
        choices: [
          { name: '🔍 Search by name/description', value: 'search' },
          { name: '🏷️ Browse by category', value: 'category' },
          { name: '📋 List all servers', value: 'all' },
          { name: '⭐ Popular servers', value: 'popular' },
        ],
      },
    ]);

    let servers: MCPRegistryEntry[] = [];

    switch (searchType) {
      case 'search':
        const { query } = await inquirer.prompt([
          {
            type: 'input',
            name: 'query',
            message: 'Enter search query:',
          },
        ]);
        servers = await this.registry.search({ query });
        break;

      case 'category':
        const { category } = await inquirer.prompt([
          {
            type: 'list',
            name: 'category',
            message: 'Select a category:',
            choices: tags,
          },
        ]);
        servers = await this.registry.search({ tags: [category] });
        break;

      case 'all':
        servers = await this.registry.search({});
        break;

      case 'popular':
        // Show common servers
        servers = await this.registry.search({ 
          tags: ['filesystem', 'database', 'api', 'github'] 
        });
        break;
    }

    if (servers.length === 0) {
      console.log('\n❌ No servers found');
      return;
    }

    // Display servers
    console.log(`\n📋 Found ${servers.length} server(s):\n`);
    
    const choices = servers.map(server => ({
      name: `${server.displayName} ${server.installed ? '✓' : ''} - ${server.description}`,
      value: server.name,
      short: server.displayName,
    }));

    const { selectedServer } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedServer',
        message: 'Select a server to install/configure:',
        choices,
        pageSize: 10,
      },
    ]);

    // Configure selected server
    await this.configure(selectedServer);
  }

  /**
   * Show server details
   */
  async showInfo(serverName: string): Promise<void> {
    const entry = await this.registry.get(serverName);
    
    if (!entry) {
      console.error(`❌ Server "${serverName}" not found`);
      return;
    }

    console.log(`\n📦 ${entry.displayName}`);
    console.log('━'.repeat(50));
    console.log(`Name:        ${entry.name}`);
    console.log(`Version:     ${entry.version}`);
    console.log(`Author:      ${entry.author}`);
    console.log(`Runtime:     ${entry.runtime}`);
    console.log(`Package:     ${entry.package}`);
    console.log(`Installed:   ${entry.installed ? `Yes (v${entry.installedVersion})` : 'No'}`);
    console.log(`\nDescription:`);
    console.log(`  ${entry.description}`);
    
    if (entry.tags.length > 0) {
      console.log(`\nTags: ${entry.tags.join(', ')}`);
    }

    if (entry.requiredEnv && entry.requiredEnv.length > 0) {
      console.log(`\nRequired Environment Variables:`);
      entry.requiredEnv.forEach(envVar => {
        console.log(`  • ${envVar}`);
      });
    }

    if (entry.configSchema) {
      console.log(`\nConfiguration Options:`);
      if (entry.configSchema.properties) {
        for (const [propName, propSchema] of Object.entries(entry.configSchema.properties)) {
          const required = entry.configSchema.required?.includes(propName) ? ' (required)' : '';
          console.log(`  • ${propName}${required}: ${propSchema.description || propSchema.type}`);
        }
      }
    }

    console.log('');
  }
}
