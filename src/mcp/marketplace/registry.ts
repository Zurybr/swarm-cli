/**
 * MCP Registry System - Issue #24.4
 * Manages MCP server registry for discovering and installing servers
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as https from 'https';
import Fuse from 'fuse.js';
import { parse as parseYAML, stringify as stringifyYAML } from 'yaml';

/**
 * JSON Schema for server configuration
 */
export interface JSONSchema {
  type: string;
  properties?: Record<string, {
    type: string;
    description?: string;
    enum?: string[];
    default?: unknown;
    items?: { type: string };
    required?: string[];
  }>;
  required?: string[];
  [key: string]: unknown;
}

/**
 * Registry entry for an MCP server
 */
export interface MCPRegistryEntry {
  /** Unique identifier (e.g., 'filesystem', 'github') */
  name: string;
  /** Human-readable name */
  displayName: string;
  /** What it does */
  description: string;
  /** Current version */
  version: string;
  /** Author/organization */
  author: string;
  /** npm package name or URL */
  package: string;
  /** Categories: database, filesystem, etc. */
  tags: string[];
  /** Runtime type */
  runtime: 'node' | 'python' | 'binary';
  /** Configuration schema */
  configSchema?: JSONSchema;
  /** Required environment variables */
  requiredEnv?: string[];
  /** Is it installed? */
  installed?: boolean;
  /** Installed version */
  installedVersion?: string;
  /** Homepage URL */
  homepage?: string;
  /** Repository URL */
  repository?: string;
}

/**
 * Registry structure
 */
export interface MCPRegistry {
  servers: MCPRegistryEntry[];
  version: string;
  lastUpdated: Date;
}

/**
 * Search options for finding servers
 */
export interface SearchOptions {
  /** Search query */
  query?: string;
  /** Filter by tags */
  tags?: string[];
  /** Filter by runtime */
  runtime?: 'node' | 'python' | 'binary';
  /** Only show installed servers */
  installed?: boolean;
  /** Limit results */
  limit?: number;
}

/**
 * Default registry URL (can be configured)
 */
const DEFAULT_REGISTRY_URL = 'https://raw.githubusercontent.com/modelcontextprotocol/servers/main/registry.json';

/**
 * MCP Registry Manager
 * Handles loading, searching, and managing the server registry
 */
export class MCPRegistryManager {
  private registry: MCPRegistry | null = null;
  private fuse: Fuse<MCPRegistryEntry> | null = null;

  constructor(
    private registryPath: string = MCPRegistryManager.getDefaultRegistryPath()
  ) {}

  /**
   * Get default registry file path
   */
  static getDefaultRegistryPath(): string {
    return path.join(os.homedir(), '.config', 'swarm-cli', 'mcp-registry.json');
  }

  /**
   * Load registry from file or fetch from remote
   */
  async load(): Promise<MCPRegistry> {
    // Try to load from local cache
    if (fs.existsSync(this.registryPath)) {
      try {
        const content = fs.readFileSync(this.registryPath, 'utf-8');
        const data = JSON.parse(content);
        const loadedRegistry: MCPRegistry = {
          ...data,
          lastUpdated: new Date(data.lastUpdated),
        };
        
        this.registry = loadedRegistry;
        
        // Initialize fuzzy search
        this.initializeFuse();
        
        return loadedRegistry;
      } catch (error) {
        console.warn('Failed to load local registry, fetching from remote...');
      }
    }

    // Fetch from remote or load built-in
    await this.update();
    
    if (!this.registry) {
      throw new Error('Failed to load registry');
    }
    
    return this.registry;
  }

  /**
   * Initialize Fuse.js for fuzzy search
   */
  private initializeFuse(): void {
    if (!this.registry) return;

    this.fuse = new Fuse(this.registry.servers, {
      keys: [
        { name: 'name', weight: 0.4 },
        { name: 'displayName', weight: 0.3 },
        { name: 'description', weight: 0.2 },
        { name: 'tags', weight: 0.1 },
      ],
      threshold: 0.4,
      includeScore: true,
    });
  }

  /**
   * Search servers by name, tag, or description
   */
  async search(options: SearchOptions = {}): Promise<MCPRegistryEntry[]> {
    if (!this.registry) {
      await this.load();
    }

    if (!this.registry) {
      return [];
    }

    let results = [...this.registry.servers];

    // Filter by tags
    if (options.tags && options.tags.length > 0) {
      results = results.filter(server =>
        options.tags!.some(tag => 
          server.tags.some(serverTag => 
            serverTag.toLowerCase() === tag.toLowerCase()
          )
        )
      );
    }

    // Filter by runtime
    if (options.runtime) {
      results = results.filter(server => server.runtime === options.runtime);
    }

    // Filter by installed status
    if (options.installed !== undefined) {
      results = results.filter(server => server.installed === options.installed);
    }

    // Fuzzy search by query
    if (options.query && this.fuse) {
      const searchResults = this.fuse.search(options.query);
      const searchServerNames = new Set(searchResults.map(r => r.item.name));
      
      // Combine filtered results with search results
      results = results.filter(server => searchServerNames.has(server.name));
    }

    // Apply limit
    if (options.limit !== undefined) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  /**
   * Get server by name
   */
  async get(name: string): Promise<MCPRegistryEntry | null> {
    if (!this.registry) {
      await this.load();
    }

    if (!this.registry) {
      return null;
    }

    return this.registry.servers.find(
      server => server.name.toLowerCase() === name.toLowerCase()
    ) || null;
  }

  /**
   * Add custom server to local registry
   */
  async add(entry: MCPRegistryEntry): Promise<void> {
    if (!this.registry) {
      await this.load();
    }

    if (!this.registry) {
      this.registry = {
        servers: [],
        version: '1.0.0',
        lastUpdated: new Date(),
      };
    }

    // Check if server already exists
    const existingIndex = this.registry.servers.findIndex(
      s => s.name.toLowerCase() === entry.name.toLowerCase()
    );

    if (existingIndex >= 0) {
      // Update existing entry
      this.registry.servers[existingIndex] = entry;
    } else {
      // Add new entry
      this.registry.servers.push(entry);
    }

    this.registry.lastUpdated = new Date();
    
    // Save to disk
    await this.save();
    
    // Reinitialize search
    this.initializeFuse();
  }

  /**
   * Remove server from local registry
   */
  async remove(name: string): Promise<boolean> {
    if (!this.registry) {
      await this.load();
    }

    if (!this.registry) {
      return false;
    }

    const index = this.registry.servers.findIndex(
      s => s.name.toLowerCase() === name.toLowerCase()
    );

    if (index < 0) {
      return false;
    }

    this.registry.servers.splice(index, 1);
    this.registry.lastUpdated = new Date();
    
    await this.save();
    this.initializeFuse();
    
    return true;
  }

  /**
   * Update registry from remote
   */
  async update(): Promise<void> {
    try {
      // Try to fetch from remote
      const remoteRegistry = await this.fetchRemoteRegistry();
      
      if (remoteRegistry) {
        this.registry = remoteRegistry;
        await this.save();
        this.initializeFuse();
        return;
      }
    } catch (error) {
      console.warn('Failed to fetch remote registry, using built-in');
    }

    // Fall back to built-in registry
    const builtInRegistry = this.loadBuiltInRegistry();
    if (builtInRegistry) {
      this.registry = builtInRegistry;
      await this.save();
      this.initializeFuse();
    } else {
      // Ensure we always have a registry
      throw new Error('Failed to load any registry');
    }
  }

  /**
   * Fetch registry from remote URL
   */
  private async fetchRemoteRegistry(): Promise<MCPRegistry | null> {
    return new Promise((resolve) => {
      https.get(DEFAULT_REGISTRY_URL, (res) => {
        let data = '';
        
        res.on('data', chunk => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve({
              ...parsed,
              lastUpdated: new Date(parsed.lastUpdated),
            });
          } catch {
            resolve(null);
          }
        });
      }).on('error', () => {
        resolve(null);
      });
    });
  }

  /**
   * Load built-in registry from resources directory
   */
  private loadBuiltInRegistry(): MCPRegistry | null {
    const builtInPath = path.join(__dirname, '..', '..', '..', '..', 'resources', 'mcp-registry.json');
    
    if (fs.existsSync(builtInPath)) {
      try {
        const content = fs.readFileSync(builtInPath, 'utf-8');
        const data = JSON.parse(content);
        return {
          ...data,
          lastUpdated: new Date(data.lastUpdated),
        };
      } catch (error) {
        console.error('Failed to load built-in registry:', error);
      }
    }

    // Return minimal built-in registry
    return {
      version: '1.0.0',
      lastUpdated: new Date(),
      servers: [
        {
          name: 'filesystem',
          displayName: 'Filesystem Access',
          description: 'Read and write files on the local filesystem',
          version: '1.0.0',
          author: 'Model Context Protocol',
          package: '@modelcontextprotocol/server-filesystem',
          tags: ['filesystem', 'utility'],
          runtime: 'node',
          configSchema: {
            type: 'object',
            properties: {
              allowedPaths: {
                type: 'array',
                items: { type: 'string' },
                description: 'Paths the server can access',
              },
            },
          },
        },
        {
          name: 'github',
          displayName: 'GitHub Integration',
          description: 'Interact with GitHub repositories, issues, and PRs',
          version: '1.0.0',
          author: 'Model Context Protocol',
          package: '@modelcontextprotocol/server-github',
          tags: ['github', 'api', 'integration'],
          runtime: 'node',
          requiredEnv: ['GITHUB_PERSONAL_ACCESS_TOKEN'],
        },
        {
          name: 'postgres',
          displayName: 'PostgreSQL Database',
          description: 'Query PostgreSQL databases',
          version: '1.0.0',
          author: 'Model Context Protocol',
          package: '@modelcontextprotocol/server-postgres',
          tags: ['database', 'postgres', 'sql'],
          runtime: 'node',
          configSchema: {
            type: 'object',
            properties: {
              connectionString: {
                type: 'string',
                description: 'PostgreSQL connection string',
              },
            },
            required: ['connectionString'],
          },
        },
      ],
    };
  }

  /**
   * Save registry to disk
   */
  private async save(): Promise<void> {
    if (!this.registry) return;

    const dir = path.dirname(this.registryPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const content = JSON.stringify(this.registry, null, 2);
    fs.writeFileSync(this.registryPath, content, 'utf-8');
  }

  /**
   * Mark a server as installed
   */
  async markInstalled(name: string, version?: string): Promise<void> {
    const entry = await this.get(name);
    if (entry) {
      entry.installed = true;
      entry.installedVersion = version || entry.version;
      await this.save();
    }
  }

  /**
   * Mark a server as uninstalled
   */
  async markUninstalled(name: string): Promise<void> {
    const entry = await this.get(name);
    if (entry) {
      entry.installed = false;
      entry.installedVersion = undefined;
      await this.save();
    }
  }

  /**
   * Get all available tags
   */
  async getTags(): Promise<string[]> {
    if (!this.registry) {
      await this.load();
    }

    if (!this.registry) {
      return [];
    }

    const tagSet = new Set<string>();
    this.registry.servers.forEach(server => {
      server.tags.forEach(tag => tagSet.add(tag));
    });

    return Array.from(tagSet).sort();
  }

  /**
   * Get registry statistics
   */
  async getStats(): Promise<{
    totalServers: number;
    installedServers: number;
    byRuntime: Record<string, number>;
    byTag: Record<string, number>;
  }> {
    if (!this.registry) {
      await this.load();
    }

    if (!this.registry) {
      return {
        totalServers: 0,
        installedServers: 0,
        byRuntime: {},
        byTag: {},
      };
    }

    const stats = {
      totalServers: this.registry.servers.length,
      installedServers: 0,
      byRuntime: {} as Record<string, number>,
      byTag: {} as Record<string, number>,
    };

    this.registry.servers.forEach(server => {
      if (server.installed) {
        stats.installedServers++;
      }

      stats.byRuntime[server.runtime] = (stats.byRuntime[server.runtime] || 0) + 1;

      server.tags.forEach(tag => {
        stats.byTag[tag] = (stats.byTag[tag] || 0) + 1;
      });
    });

    return stats;
  }
}
