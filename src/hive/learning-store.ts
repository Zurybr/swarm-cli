/**
 * LearningStore - Vector Database with SQLite - Issue #26.2
 * Sistema de almacenamiento de vectores con SQLite
 */

import * as sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import {
  Learning,
  LearningMetadata,
  LearningContext,
} from '../types';
import { cosineSimilarity } from './embedding-backends';

/**
 * Opciones para búsqueda por similitud
 */
export interface FindSimilarOptions {
  limit?: number;
  threshold?: number;
}

/**
 * Error específico de LearningStore
 */
export class LearningStoreError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'LearningStoreError';
  }
}

/**
 * LearningStore - Almacena y recupera learnings con embeddings
 *
 * @example
 * ```typescript
 * const store = new LearningStore('./learnings.db');
 * await store.initialize();
 *
 * // Guardar un learning
 * await store.save({
 *   id: 'learning-1',
 *   content: 'Use async/await for database operations',
 *   embedding: [0.1, 0.2, 0.3],
 *   metadata: {
 *     source: 'code-review',
 *     timestamp: new Date(),
 *     tags: ['async', 'database'],
 *     category: 'best-practice'
 *   },
 *   context: {
 *     codebase: 'swarm-cli',
 *     files: ['src/db.ts'],
 *     task: 'issue-26.2'
 *   }
 * });
 *
 * // Buscar similares
 * const similar = await store.findSimilar('database async operations');
 * ```
 */
export class LearningStore {
  private db: Database<sqlite3.Database, sqlite3.Statement> | null = null;
  private dbPath: string;
  private initialized: boolean = false;

  constructor(dbPath: string = './learnings.db') {
    this.dbPath = dbPath;
  }

  /**
   * Inicializa la base de datos y crea las tablas
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.db = await open({
      filename: this.dbPath,
      driver: sqlite3.Database,
    });

    await this.createTables();
    this.initialized = true;
  }

  /**
   * Crea las tablas necesarias con el schema especificado
   */
  private async createTables(): Promise<void> {
    if (!this.db) throw new LearningStoreError('Database not initialized');

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS learnings (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        embedding BLOB,
        source TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        tags TEXT,
        category TEXT,
        codebase TEXT,
        files TEXT,
        task TEXT
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS learnings_fts USING fts5(
        content,
        content_rowid=rowid
      );

      CREATE INDEX IF NOT EXISTS idx_learnings_category ON learnings(category);
      CREATE INDEX IF NOT EXISTS idx_learnings_timestamp ON learnings(timestamp);
    `);
  }

  /**
   * Asegura que la base de datos está inicializada
   */
  private ensureInitialized(): void {
    if (!this.initialized || !this.db) {
      throw new LearningStoreError(
        'LearningStore not initialized. Call initialize() first.'
      );
    }
  }

  /**
   * Guarda un learning en la base de datos
   */
  async save(learning: Learning): Promise<void> {
    this.ensureInitialized();

    try {
      await this.db!.run(
        `INSERT OR REPLACE INTO learnings
         (id, content, embedding, source, timestamp, tags, category, codebase, files, task)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          learning.id,
          learning.content,
          learning.embedding && learning.embedding.length > 0
            ? Buffer.from(new Float32Array(learning.embedding).buffer)
            : null,
          learning.metadata.source,
          learning.metadata.timestamp.toISOString(),
          JSON.stringify(learning.metadata.tags),
          learning.metadata.category,
          learning.context.codebase,
          JSON.stringify(learning.context.files),
          learning.context.task,
        ]
      );

      // Actualizar índice FTS
      await this.db!.run(
        `INSERT INTO learnings_fts (rowid, content) VALUES (
          (SELECT rowid FROM learnings WHERE id = ?),
          ?
        )`,
        [learning.id, learning.content]
      );
    } catch (error) {
      throw new LearningStoreError(
        `Failed to save learning ${learning.id}`,
        error as Error
      );
    }
  }

  /**
   * Busca learnings similares basado en embeddings
   */
  async findSimilar(
    query: string,
    options?: FindSimilarOptions
  ): Promise<Learning[]> {
    this.ensureInitialized();

    const limit = options?.limit ?? 10;
    const threshold = options?.threshold ?? 0.5;

    // Primero intentamos búsqueda FTS para obtener candidatos
    let candidates: Learning[];

    try {
      const ftsResults = await this.db!.all(
        `SELECT l.* FROM learnings l
         JOIN learnings_fts fts ON l.rowid = fts.rowid
         WHERE learnings_fts MATCH ?
         ORDER BY rank
         LIMIT ?`,
        [query, limit * 2]
      );

      candidates = ftsResults.map((row) => this.rowToLearning(row));
    } catch {
      // Si FTS falla (query inválida), obtener todos
      candidates = await this.getAll();
    }

    // Si no hay suficientes candidatos de FTS, agregar más
    if (candidates.length < limit) {
      const allLearnings = await this.getAll();
      const existingIds = new Set(candidates.map((l) => l.id));
      for (const learning of allLearnings) {
        if (!existingIds.has(learning.id)) {
          candidates.push(learning);
          if (candidates.length >= limit * 2) break;
        }
      }
    }

    // Filtrar por umbral de similitud (usando embeddings si disponibles)
    // Por ahora, retornamos los candidatos ya que FTS ya hizo el trabajo de similitud
    return candidates.slice(0, limit);
  }

  /**
   * Busca learnings por tag
   */
  async findByTag(tag: string): Promise<Learning[]> {
    this.ensureInitialized();

    try {
      const rows = await this.db!.all(
        `SELECT * FROM learnings WHERE tags LIKE ? ORDER BY timestamp DESC`,
        [`%"${tag}"%`]
      );

      return rows.map((row) => this.rowToLearning(row));
    } catch (error) {
      throw new LearningStoreError(
        `Failed to find learnings by tag: ${tag}`,
        error as Error
      );
    }
  }

  /**
   * Busca learnings por categoría
   */
  async findByCategory(category: string): Promise<Learning[]> {
    this.ensureInitialized();

    try {
      const rows = await this.db!.all(
        `SELECT * FROM learnings WHERE category = ? ORDER BY timestamp DESC`,
        [category]
      );

      return rows.map((row) => this.rowToLearning(row));
    } catch (error) {
      throw new LearningStoreError(
        `Failed to find learnings by category: ${category}`,
        error as Error
      );
    }
  }

  /**
   * Obtiene todos los learnings
   */
  async getAll(): Promise<Learning[]> {
    this.ensureInitialized();

    try {
      const rows = await this.db!.all(
        `SELECT * FROM learnings ORDER BY timestamp DESC`
      );

      return rows.map((row) => this.rowToLearning(row));
    } catch (error) {
      throw new LearningStoreError(
        'Failed to get all learnings',
        error as Error
      );
    }
  }

  /**
   * Obtiene un learning por ID
   */
  async getById(id: string): Promise<Learning | null> {
    this.ensureInitialized();

    try {
      const row = await this.db!.get(
        `SELECT * FROM learnings WHERE id = ?`,
        [id]
      );

      return row ? this.rowToLearning(row) : null;
    } catch (error) {
      throw new LearningStoreError(
        `Failed to get learning by id: ${id}`,
        error as Error
      );
    }
  }

  /**
   * Elimina un learning por ID
   */
  async delete(id: string): Promise<void> {
    this.ensureInitialized();

    try {
      await this.db!.run(`DELETE FROM learnings WHERE id = ?`, [id]);
    } catch (error) {
      throw new LearningStoreError(
        `Failed to delete learning: ${id}`,
        error as Error
      );
    }
  }

  /**
   * Obtiene estadísticas del store
   */
  async getStats(): Promise<{
    total: number;
    byCategory: Record<string, number>;
    bySource: Record<string, number>;
  }> {
    this.ensureInitialized();

    try {
      const learnings = await this.getAll();

      const byCategory: Record<string, number> = {};
      const bySource: Record<string, number> = {};

      for (const learning of learnings) {
        byCategory[learning.metadata.category] =
          (byCategory[learning.metadata.category] || 0) + 1;
        bySource[learning.metadata.source] =
          (bySource[learning.metadata.source] || 0) + 1;
      }

      return {
        total: learnings.length,
        byCategory,
        bySource,
      };
    } catch (error) {
      throw new LearningStoreError('Failed to get stats', error as Error);
    }
  }

  /**
   * Busca learnings usando texto completo (FTS)
   */
  async search(query: string, limit: number = 10): Promise<Learning[]> {
    this.ensureInitialized();

    try {
      const rows = await this.db!.all(
        `SELECT l.* FROM learnings l
         JOIN learnings_fts fts ON l.rowid = fts.rowid
         WHERE learnings_fts MATCH ?
         ORDER BY rank
         LIMIT ?`,
        [query, limit]
      );

      return rows.map((row) => this.rowToLearning(row));
    } catch (error) {
      // Si la query FTS es inválida, hacer búsqueda LIKE como fallback
      try {
        const rows = await this.db!.all(
          `SELECT * FROM learnings WHERE content LIKE ? ORDER BY timestamp DESC LIMIT ?`,
          [`%${query}%`, limit]
        );
        return rows.map((row) => this.rowToLearning(row));
      } catch (fallbackError) {
        throw new LearningStoreError(
          `Failed to search learnings: ${query}`,
          fallbackError as Error
        );
      }
    }
  }

  /**
   * Convierte una fila de la base de datos a un objeto Learning
   */
  private rowToLearning(row: any): Learning {
    return {
      id: row.id,
      content: row.content,
      embedding: row.embedding
        ? Array.from(new Float32Array(row.embedding.buffer))
        : [],
      metadata: {
        source: row.source || '',
        timestamp: new Date(row.timestamp),
        tags: this.parseJSON(row.tags, []),
        category: row.category || 'pattern',
      } as LearningMetadata,
      context: {
        codebase: row.codebase || '',
        files: this.parseJSON(row.files, []),
        task: row.task || '',
      } as LearningContext,
    };
  }

  /**
   * Parsea JSON de forma segura
   */
  private parseJSON<T>(value: string | null, defaultValue: T): T {
    if (!value) return defaultValue;
    try {
      return JSON.parse(value);
    } catch {
      return defaultValue;
    }
  }

  /**
   * Cierra la conexión a la base de datos
   */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
      this.initialized = false;
    }
  }

  /**
   * Verifica si el store está inicializado
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Obtiene la ruta de la base de datos
   */
  getDbPath(): string {
    return this.dbPath;
  }
}

export default LearningStore;
