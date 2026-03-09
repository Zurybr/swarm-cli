/**
 * Skill Registry
 *
 * Main registry class that integrates SkillStore, SkillSearchIndex, and SkillVersionManager
 * to provide a unified API for skill registration, retrieval, and search.
 */

import sqlite3 from 'sqlite3';
import { SkillMetadata } from '../types/skill';
import { SkillStore } from './skill-store';
import { SkillSearchIndex } from './search-index';
import { SkillVersionManager } from './version-manager';
import { validateSkillMetadata } from '../schema/skill-metadata';

/**
 * SkillRegistry provides unified API for skill management
 */
export class SkillRegistry {
  private metadataIndex: Map<string, SkillMetadata>;
  private store: SkillStore;
  private searchIndex: SkillSearchIndex;
  private versionManager: SkillVersionManager;

  /**
   * Create a new SkillRegistry instance
   * @param db - SQLite database instance
   */
  constructor(db: sqlite3.Database) {
    this.metadataIndex = new Map();
    this.store = new SkillStore(db);
    this.searchIndex = new SkillSearchIndex(db);
    this.versionManager = new SkillVersionManager();
  }

  /**
   * Initialize the registry - creates tables and loads existing metadata
   */
  async initialize(): Promise<void> {
    await this.store.initialize();
    await this.searchIndex.initialize();
    await this.loadMetadataIndex();
  }

  /**
   * Register a new skill
   * @param metadata - Skill metadata to register
   * @throws Error if validation fails or skill already exists
   */
  async register(metadata: SkillMetadata): Promise<void> {
    // Validate metadata
    validateSkillMetadata(metadata);

    // Validate version format
    if (!this.versionManager.isValid(metadata.version)) {
      throw new Error(
        `Invalid version format: ${metadata.version}. Must be semver (e.g., 1.0.0)`
      );
    }

    // Check for duplicate
    const existing = await this.store.loadMetadataByVersion(
      metadata.name,
      metadata.version
    );
    if (existing) {
      throw new Error(
        `Skill ${metadata.name}@${metadata.version} already exists`
      );
    }

    // Save to store
    await this.store.save(metadata);

    // Update in-memory index
    const key = this.getMetadataKey(metadata.name, metadata.version);
    this.metadataIndex.set(key, metadata);
  }

  /**
   * Get metadata for a skill (returns latest version)
   * @param name - Skill name
   * @returns SkillMetadata or undefined if not found
   */
  getMetadata(name: string): SkillMetadata | undefined {
    // Find all versions of this skill
    const versions: string[] = [];
    const versionMap = new Map<string, SkillMetadata>();

    for (const [key, metadata] of this.metadataIndex.entries()) {
      if (metadata.name === name) {
        versions.push(metadata.version);
        versionMap.set(metadata.version, metadata);
      }
    }

    if (versions.length === 0) {
      return undefined;
    }

    // Return latest version
    const latest = this.versionManager.getLatest(versions);
    return latest ? versionMap.get(latest) : undefined;
  }

  /**
   * Get metadata for a specific skill version
   * @param name - Skill name
   * @param version - Specific version
   * @returns SkillMetadata or undefined if not found
   */
  getMetadataByVersion(
    name: string,
    version: string
  ): SkillMetadata | undefined {
    const key = this.getMetadataKey(name, version);
    return this.metadataIndex.get(key);
  }

  /**
   * Get all registered skill metadata
   * @returns Array of all skill metadata
   */
  getAllMetadata(): SkillMetadata[] {
    return Array.from(this.metadataIndex.values());
  }

  /**
   * Search for skills by query
   * @param query - Search query
   * @param limit - Maximum results (default 10)
   * @returns Array of matching skill metadata
   */
  async search(query: string, limit?: number): Promise<SkillMetadata[]> {
    const results = await this.searchIndex.search(query, limit);
    // Map search results back to full metadata
    return results
      .map((result) => this.getMetadataByVersion(result.name, result.version))
      .filter((metadata): metadata is SkillMetadata => metadata !== undefined);
  }

  /**
   * Search for skills by prefix (for autocomplete)
   * @param prefix - Search prefix
   * @param limit - Maximum results (default 5)
   * @returns Array of matching skill metadata
   */
  async searchPrefix(
    prefix: string,
    limit?: number
  ): Promise<SkillMetadata[]> {
    const results = await this.searchIndex.searchPrefix(prefix, limit);
    return results
      .map((result) => this.getMetadataByVersion(result.name, result.version))
      .filter((metadata): metadata is SkillMetadata => metadata !== undefined);
  }

  /**
   * Delete a specific skill version
   * @param name - Skill name
   * @param version - Version to delete
   */
  async delete(name: string, version: string): Promise<void> {
    await this.store.delete(name, version);

    const key = this.getMetadataKey(name, version);
    this.metadataIndex.delete(key);
  }

  /**
   * Check if a skill version satisfies a range
   * @param name - Skill name
   * @param range - Semver range (e.g., "^1.0.0")
   * @returns true if skill exists and satisfies range
   */
  satisfiesVersion(name: string, range: string): boolean {
    const metadata = this.getMetadata(name);
    if (!metadata) {
      return false;
    }
    return this.versionManager.satisfies(metadata.version, range);
  }

  /**
   * Check if an update is compatible
   * @param name - Skill name
   * @param currentVersion - Current version
   * @param candidateVersion - Candidate version to update to
   * @returns true if compatible update
   */
  isCompatibleUpdate(
    name: string,
    currentVersion: string,
    candidateVersion: string
  ): boolean {
    // Verify current version exists
    const current = this.getMetadataByVersion(name, currentVersion);
    if (!current) {
      return false;
    }

    return this.versionManager.isCompatibleUpdate(
      currentVersion,
      candidateVersion
    );
  }

  /**
   * Get all versions of a skill
   * @param name - Skill name
   * @returns Array of versions
   */
  getVersions(name: string): string[] {
    const versions: string[] = [];
    for (const metadata of this.metadataIndex.values()) {
      if (metadata.name === name) {
        versions.push(metadata.version);
      }
    }
    return versions.sort((a, b) => this.versionManager.compare(a, b));
  }

  /**
   * Load all metadata from store into memory index
   */
  private async loadMetadataIndex(): Promise<void> {
    const allMetadata = await this.store.loadAllMetadata();
    for (const metadata of allMetadata) {
      const key = this.getMetadataKey(metadata.name, metadata.version);
      this.metadataIndex.set(key, metadata);
    }
  }

  /**
   * Generate a unique key for metadata index
   */
  private getMetadataKey(name: string, version: string): string {
    return `${name}@${version}`;
  }
}
