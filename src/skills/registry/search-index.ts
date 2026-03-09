/**
 * Skill Search Index - FTS5 implementation
 *
 * Provides full-text search capabilities for skill discovery using SQLite FTS5.
 */

import sqlite3 from 'sqlite3';

/**
 * Search result interface for skill queries
 */
export interface SkillSearchResult {
  /** Skill name */
  name: string;
  /** Skill description */
  description: string;
  /** Skill version */
  version: string;
  /** Skill category */
  category?: string;
  /** Skill tags */
  tags?: string[];
  /** Skill author */
  author?: string;
  /** FTS5 relevance rank (lower is better) */
  rank: number;
}

/**
 * SkillSearchIndex provides FTS5 full-text search for skills
 */
export class SkillSearchIndex {
  constructor(private db: sqlite3.Database) {}

  /**
   * Initialize the FTS5 virtual table and triggers
   */
  async initialize(): Promise<void> {
    const schema = `
      -- Create FTS5 virtual table for full-text search
      CREATE VIRTUAL TABLE IF NOT EXISTS skills_fts USING fts5(
        name,
        description,
        content='skills',
        content_rowid='rowid'
      );

      -- Trigger to insert into FTS index when skill is added
      CREATE TRIGGER IF NOT EXISTS skills_fts_insert
      AFTER INSERT ON skills
      BEGIN
        INSERT INTO skills_fts(rowid, name, description)
        VALUES (new.rowid, new.name, new.description);
      END;

      -- Trigger to update FTS index when skill is modified
      CREATE TRIGGER IF NOT EXISTS skills_fts_update
      AFTER UPDATE ON skills
      BEGIN
        UPDATE skills_fts SET
          name = new.name,
          description = new.description
        WHERE rowid = old.rowid;
      END;

      -- Trigger to delete from FTS index when skill is removed
      CREATE TRIGGER IF NOT EXISTS skills_fts_delete
      AFTER DELETE ON skills
      BEGIN
        DELETE FROM skills_fts WHERE rowid = old.rowid;
      END;
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
   * Sanitize search query to prevent FTS5 syntax errors
   * Escapes double quotes by doubling them
   */
  private sanitizeQuery(query: string): string {
    return query.replace(/"/g, '""');
  }

  /**
   * Search skills by query string
   * @param query - Search query
   * @param limit - Maximum results (default 10)
   * @returns Array of search results ranked by relevance
   */
  async search(query: string, limit: number = 10): Promise<SkillSearchResult[]> {
    if (!query.trim()) {
      return [];
    }

    const sanitizedQuery = this.sanitizeQuery(query);
    const sql = `
      SELECT
        s.name,
        s.description,
        s.version,
        s.category,
        s.tags,
        s.author,
        fts.rank
      FROM skills_fts fts
      JOIN skills s ON s.rowid = fts.rowid
      WHERE skills_fts MATCH ?
      ORDER BY fts.rank
      LIMIT ?
    `;

    return new Promise((resolve, reject) => {
      this.db.all(sql, [sanitizedQuery, limit], (err, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }

        const results = rows.map((row) => ({
          name: row.name,
          description: row.description,
          version: row.version,
          category: row.category || undefined,
          tags: row.tags ? JSON.parse(row.tags) : undefined,
          author: row.author || undefined,
          rank: row.rank,
        }));

        resolve(results);
      });
    });
  }

  /**
   * Search skills by prefix (for autocomplete)
   * @param prefix - Search prefix
   * @param limit - Maximum results (default 5)
   * @returns Array of search results
   */
  async searchPrefix(prefix: string, limit: number = 5): Promise<SkillSearchResult[]> {
    if (!prefix.trim()) {
      return [];
    }

    const sanitizedPrefix = this.sanitizeQuery(prefix);
    // Use FTS5 prefix search with * wildcard
    const prefixQuery = `${sanitizedPrefix}*`;

    const sql = `
      SELECT
        s.name,
        s.description,
        s.version,
        s.category,
        s.tags,
        s.author,
        fts.rank
      FROM skills_fts fts
      JOIN skills s ON s.rowid = fts.rowid
      WHERE skills_fts MATCH ?
      ORDER BY fts.rank
      LIMIT ?
    `;

    return new Promise((resolve, reject) => {
      this.db.all(sql, [prefixQuery, limit], (err, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }

        const results = rows.map((row) => ({
          name: row.name,
          description: row.description,
          version: row.version,
          category: row.category || undefined,
          tags: row.tags ? JSON.parse(row.tags) : undefined,
          author: row.author || undefined,
          rank: row.rank,
        }));

        resolve(results);
      });
    });
  }
}
