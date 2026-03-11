/**
 * MCP Version Management - Issue #24.4
 * Handles version checking, updates, and changelogs
 */

import { execSync } from 'child_process';
import * as https from 'https';
import { MCPRegistryManager, MCPRegistryEntry } from './registry';
import { MCPInstaller } from './installer';
import { compare, gt, valid, coerce } from 'semver';

/**
 * Version update info
 */
export interface VersionUpdateInfo {
  /** Server name */
  server: string;
  /** Current installed version */
  current: string;
  /** Latest available version */
  latest: string;
  /** Whether an update is available */
  hasUpdate: boolean;
}

/**
 * Version manager for MCP servers
 */
export class MCPVersionManager {
  constructor(
    private registry: MCPRegistryManager,
    private installer: MCPInstaller
  ) {}

  /**
   * Check for updates across all installed servers
   */
  async checkUpdates(): Promise<VersionUpdateInfo[]> {
    const installed = await this.installer.list();
    const updates: VersionUpdateInfo[] = [];

    for (const server of installed) {
      const current = server.installedVersion || server.version;
      const latest = await this.getLatestVersion(server.package);

      if (latest) {
        updates.push({
          server: server.name,
          current,
          latest,
          hasUpdate: gt(latest, current),
        });
      }
    }

    return updates;
  }

  /**
   * Get latest version of a package
   */
  async getLatestVersion(packageName: string): Promise<string | null> {
    try {
      // Try npm view
      const output = execSync(`npm view ${packageName} version`, {
        encoding: 'utf-8',
      }).trim();
      
      return output || null;
    } catch {
      // Try to fetch from npm registry API
      try {
        const version = await this.fetchLatestFromNpm(packageName);
        return version;
      } catch {
        return null;
      }
    }
  }

  /**
   * Fetch latest version from npm registry
   */
  private async fetchLatestFromNpm(packageName: string): Promise<string | null> {
    return new Promise((resolve) => {
      const url = `https://registry.npmjs.org/${packageName}/latest`;
      
      https.get(url, (res) => {
        let data = '';
        
        res.on('data', chunk => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed.version || null);
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
   * Show changelog for a server
   */
  async changelog(server: string): Promise<string> {
    const entry = await this.registry.get(server);
    
    if (!entry) {
      throw new Error(`Server "${server}" not found`);
    }

    // Try to fetch changelog from npm
    try {
      const changelogUrl = await this.getChangelogUrl(entry.package);
      if (changelogUrl) {
        const changelog = await this.fetchUrl(changelogUrl);
        return changelog || 'No changelog available';
      }
    } catch {
      // Fall through
    }

    // Try GitHub releases
    if (entry.repository) {
      try {
        const releases = await this.fetchGitHubReleases(entry.repository);
        if (releases) {
          return releases;
        }
      } catch {
        // Fall through
      }
    }

    return 'No changelog available';
  }

  /**
   * Get changelog URL from package
   */
  private async getChangelogUrl(packageName: string): Promise<string | null> {
    try {
      const output = execSync(`npm view ${packageName} repository.url`, {
        encoding: 'utf-8',
      }).trim();

      // Convert git URL to HTTPS
      if (output.startsWith('git+')) {
        return output
          .replace('git+', '')
          .replace('.git', '')
          .replace('github.com:', 'github.com/') + '/blob/main/CHANGELOG.md';
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Fetch content from URL
   */
  private async fetchUrl(url: string): Promise<string | null> {
    return new Promise((resolve) => {
      https.get(url, (res) => {
        let data = '';
        
        res.on('data', chunk => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve(data);
          } else {
            resolve(null);
          }
        });
      }).on('error', () => {
        resolve(null);
      });
    });
  }

  /**
   * Fetch GitHub releases
   */
  private async fetchGitHubReleases(repositoryUrl: string): Promise<string | null> {
    // Extract owner/repo from URL
    const match = repositoryUrl.match(/github\.com[\/:]([^\/]+)\/([^\/\?]+)/);
    if (!match) {
      return null;
    }

    const [, owner, repo] = match;
    const cleanRepo = repo.replace('.git', '');

    return new Promise((resolve) => {
      const url = `https://api.github.com/repos/${owner}/${cleanRepo}/releases`;
      
      const req = https.get(url, {
        headers: {
          'User-Agent': 'swarm-cli',
        },
      }, (res) => {
        let data = '';
        
        res.on('data', chunk => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const releases = JSON.parse(data);
            if (Array.isArray(releases) && releases.length > 0) {
              // Format last 5 releases
              const formatted = releases.slice(0, 5).map((release: any) => {
                return `## ${release.tag_name} (${new Date(release.published_at).toLocaleDateString()})\n${release.body || 'No description'}`;
              }).join('\n\n---\n\n');
              
              resolve(formatted);
            } else {
              resolve(null);
            }
          } catch {
            resolve(null);
          }
        });
      });

      req.on('error', () => {
        resolve(null);
      });
    });
  }

  /**
   * Pin a server to a specific version
   */
  async pin(server: string, version: string): Promise<void> {
    const entry = await this.registry.get(server);
    
    if (!entry) {
      throw new Error(`Server "${server}" not found`);
    }

    // Validate version
    if (!valid(version)) {
      const coercedVersion = coerce(version);
      if (!coercedVersion) {
        throw new Error(`Invalid version: ${version}`);
      }
      version = coercedVersion.version;
    }

    // Check if version exists
    const exists = await this.versionExists(entry.package, version);
    if (!exists) {
      throw new Error(`Version ${version} not found for ${entry.package}`);
    }

    // Reinstall with specific version
    await this.installer.install(server, { version });
    
    console.log(`📌 Pinned ${server} to version ${version}`);
  }

  /**
   * Unpin a server (allow updates)
   */
  async unpin(server: string): Promise<void> {
    const entry = await this.registry.get(server);
    
    if (!entry) {
      throw new Error(`Server "${server}" not found`);
    }

    // Update to latest version
    await this.installer.update(server);
    
    console.log(`📍 Unpinned ${server}, now on latest version`);
  }

  /**
   * Check if a specific version exists
   */
  private async versionExists(packageName: string, version: string): Promise<boolean> {
    try {
      execSync(`npm view ${packageName}@${version}`, { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get version history for a package
   */
  async getVersionHistory(server: string, limit: number = 10): Promise<string[]> {
    const entry = await this.registry.get(server);
    
    if (!entry) {
      throw new Error(`Server "${server}" not found`);
    }

    try {
      const output = execSync(`npm view ${entry.package} versions --json`, {
        encoding: 'utf-8',
      });
      
      const versions: string[] = JSON.parse(output);
      
      // Sort by semver and return last N versions
      return versions
        .filter(v => valid(v))
        .sort((a, b) => compare(b, a))
        .slice(0, limit);
    } catch {
      return [];
    }
  }

  /**
   * Show update summary
   */
  async showUpdateSummary(): Promise<void> {
    const updates = await this.checkUpdates();
    
    if (updates.length === 0) {
      console.log('No servers installed');
      return;
    }

    const hasUpdates = updates.filter(u => u.hasUpdate);
    
    if (hasUpdates.length === 0) {
      console.log('✅ All servers are up to date');
      return;
    }

    console.log(`\n📦 ${hasUpdates.length} update(s) available:\n`);
    
    hasUpdates.forEach(update => {
      console.log(`  ${update.server}: ${update.current} → ${update.latest}`);
    });
    
    console.log('\n💡 Run `swarm-cli mcp update --all` to update all servers');
  }
}
