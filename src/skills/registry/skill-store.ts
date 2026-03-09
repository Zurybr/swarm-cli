/**
 * Skill Store - SQLite persistence layer
 *
 * Provides CRUD operations for skill metadata storage and retrieval.
 */

import sqlite3 from 'sqlite3';
import { SkillMetadata } from '../types/skill';

/**
 * SkillStore class for persisting skill metadata to SQLite
 */
export class SkillStore {
  constructor(private db: sqlite3.Database) {}

  /**
   * Initialize the skills table in the database
   */
  async initialize(): Promise<void> {
    const schema = `
      CREATE TABLE IF NOT EXISTS skills (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        version TEXT NOT NULL,
        category TEXT,
        tags TEXT,
        schema TEXT,
        author TEXT,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_skills_name ON skills(name);
      CREATE INDEX IF NOT EXISTS idx_skills_category ON skills(category);
    `;

    return new Promise((resolve, reject) => {
      this.db.exec(schema, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Generate a unique ID from name and version
   */
  private generateId(name: string, version: string): string {
    return `${name}@${version}`;
  }

  /**
   * Parse a date from various formats (ISO string, timestamp, or Date)
   */
  private parseDate(value: unknown): Date {
    if (value instanceof Date) {
      return value;
    }
    if (typeof value === 'string') {
      return new Date(value);
    }
    if (typeof value === 'number') {
      return new Date(value);
    }
    return new Date();
  }

  /**
   * Save skill metadata to the database
   * Uses INSERT OR REPLACE to handle updates
   */
  async save(metadata: SkillMetadata): Promise<void> {
    const id = this.generateId(metadata.name, metadata.version);
    const tagsJson = metadata.tags ? JSON.stringify(metadata.tags) : null;
    const schemaJson = metadata.schema ? JSON.stringify(metadata.schema) : null;

    const sql = `
      INSERT OR REPLACE INTO skills
      (id, name, description, version, category, tags, schema, author, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    return new Promise((resolve, reject) => {
      this.db.run(
        sql,
        [
          id,
          metadata.name,
          metadata.description,
          metadata.version,
          metadata.category || null,
          tagsJson,
          schemaJson,
          metadata.author || null,
          metadata.createdAt.toISOString(),
          metadata.updatedAt.toISOString(),
        ],
        function (err) {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  /**
   * Load all skill metadata from the database
   */
  async loadAllMetadata(): Promise<SkillMetadata[]> {
    const sql = `SELECT * FROM skills ORDER BY name, version`;

    return new Promise((resolve, reject) => {
      this.db.all(sql, [], (err, rows: unknown[]) => {
        if (err) {
          reject(err);
          return;
        }

        const metadata = rows.map((row: any) => this.rowToMetadata(row));
        resolve(metadata);
      });
    });
  }

  /**
   * Load metadata for a specific skill by name
   * Returns the latest version if multiple exist
   */
  async loadMetadata(name: string): Promise<SkillMetadata | undefined> {
    const sql = `SELECT * FROM skills WHERE name = ? ORDER BY version DESC LIMIT 1`;

    return new Promise((resolve, reject) => {
      this.db.get(sql, [name], (err, row: any) => {
        if (err) {
          reject(err);
          return;
        }

        if (!row) {
          resolve(undefined);
          return;
        }

        resolve(this.rowToMetadata(row));
      });
    });
  }

  /**
   * Load metadata for a specific skill by name and version
   */
  async loadMetadataByVersion(
    name: string,
    version: string
  ): Promise<SkillMetadata | undefined> {
    const id = this.generateId(name, version);
    const sql = `SELECT * FROM skills WHERE id = ?`;

    return new Promise((resolve, reject) => {
      this.db.get(sql, [id], (err, row: any) => {
        if (err) {
          reject(err);
          return;
        }

        if (!row) {
          resolve(undefined);
          return;
        }

        resolve(this.rowToMetadata(row));
      });
    });
  }

  /**
   * Delete a specific skill version
   */
  async delete(name: string, version: string): Promise<boolean> {
    const id = this.generateId(name, version);
    const sql = `DELETE FROM skills WHERE id = ?`;

    return new Promise((resolve, reject) => {
      this.db.run(sql, [id], function (err) {
        if (err) {
          reject(err);
        } else {
          resolve((this as any).changes > 0);
        }
      });
    });
  }

  /**
   * Delete all versions of a skill by name
   */
  async deleteAllVersions(name: string): Promise<number> {
    const sql = `DELETE FROM skills WHERE name = ?`;

    return new Promise((resolve, reject) => {
      this.db.run(sql, [name], function (err) {
        if (err) {
          reject(err);
        } else {
          resolve((this as any).changes);
        }
      });
    });
  }

  /**
   * Convert a database row to SkillMetadata
   */
  private rowToMetadata(row: any): SkillMetadata {
    return {
      name: row.name,
      description: row.description,
      version: row.version,
      category: row.category,
      tags: row.tags ? JSON.parse(row.tags) : undefined,
      schema: row.schema ? JSON.parse(row.schema) : undefined,
      author: row.author,
      createdAt: this.parseDate(row.created_at),
      updatedAt: this.parseDate(row.updated_at),
    };
  }
}
