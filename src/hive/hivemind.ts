/**
 * Hivemind - Semantic Memory System - Issue #26
 * Sistema de memoria semántica con embeddings
 */

import * as sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { 
  EmbeddingBackend, 
  Learning, 
  LearningMetadata,
  LearningContext,
  SearchResult,
  SearchOptions,
  Pattern 
} from '../types';

export class Hivemind {
  private db: Database<sqlite3.Database, sqlite3.Statement> | null = null;
  private backend: EmbeddingBackend;
  private dbPath: string;
  
  constructor(backend: EmbeddingBackend, dbPath: string = './hivemind.db') {
    this.backend = backend;
    this.dbPath = dbPath;
  }
  
  /**
   * Inicializa la base de datos
   */
  async initialize(): Promise<void> {
    this.db = await open({
      filename: this.dbPath,
      driver: sqlite3.Database
    });
    
    await this.createTables();
  }
  
  /**
   * Crea las tablas necesarias
   */
  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
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
      
      CREATE INDEX IF NOT EXISTS idx_learnings_tags ON learnings(tags);
      CREATE INDEX IF NOT EXISTS idx_learnings_category ON learnings(category);
      CREATE INDEX IF NOT EXISTS idx_learnings_timestamp ON learnings(timestamp);
    `);
  }
  
  /**
   * Guarda un learning
   */
  async save(learning: Learning): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    // Generar embedding si no existe
    if (!learning.embedding || learning.embedding.length === 0) {
      learning.embedding = await this.backend.embed(learning.content);
    }
    
    await this.db.run(
      `INSERT OR REPLACE INTO learnings 
       (id, content, embedding, source, tags, category, codebase, files, task)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        learning.id,
        learning.content,
        Buffer.from(new Float32Array(learning.embedding).buffer),
        learning.metadata.source,
        JSON.stringify(learning.metadata.tags),
        learning.metadata.category,
        learning.context.codebase,
        JSON.stringify(learning.context.files),
        learning.context.task
      ]
    );
  }
  
  /**
   * Busca learnings similares
   */
  async findSimilar(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const queryEmbedding = await this.backend.embed(query);
    const threshold = options.threshold ?? 0.7;
    const limit = options.limit ?? 10;
    
    // Obtener todos los learnings
    const learnings = await this.getAllLearnings();
    
    // Calcular similitud y filtrar
    const results: SearchResult[] = learnings
      .map(learning => ({
        learning,
        similarity: this.backend.similarity(queryEmbedding, learning.embedding)
      }))
      .filter(result => result.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
    
    return results;
  }
  
  /**
   * Busca por tag
   */
  async findByTag(tag: string): Promise<Learning[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const rows = await this.db.all(
      `SELECT * FROM learnings WHERE tags LIKE ?`,
      [`%${tag}%`]
    );
    
    return rows.map(row => this.rowToLearning(row));
  }
  
  /**
   * Busca por categoría
   */
  async findByCategory(category: string): Promise<Learning[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const rows = await this.db.all(
      `SELECT * FROM learnings WHERE category = ?`,
      [category]
    );
    
    return rows.map(row => this.rowToLearning(row));
  }
  
  /**
   * Obtiene todos los learnings
   */
  async getAllLearnings(): Promise<Learning[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const rows = await this.db.all('SELECT * FROM learnings');
    return rows.map(row => this.rowToLearning(row));
  }
  
  /**
   * Obtiene un learning por ID
   */
  async getById(id: string): Promise<Learning | null> {
    if (!this.db) throw new Error('Database not initialized');
    
    const row = await this.db.get('SELECT * FROM learnings WHERE id = ?', [id]);
    return row ? this.rowToLearning(row) : null;
  }
  
  /**
   * Elimina un learning
   */
  async delete(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    await this.db.run('DELETE FROM learnings WHERE id = ?', [id]);
  }
  
  /**
   * Detecta patrones en los learnings
   */
  async detectPatterns(): Promise<Pattern[]> {
    const learnings = await this.getAllLearnings();
    const patterns: Pattern[] = [];
    
    // Agrupar por categoría
    const byCategory = new Map<string, Learning[]>();
    for (const learning of learnings) {
      const cat = learning.metadata.category;
      if (!byCategory.has(cat)) {
        byCategory.set(cat, []);
      }
      byCategory.get(cat)!.push(learning);
    }
    
    // Detectar patrones por similitud dentro de cada categoría
    for (const [category, catLearnings] of Array.from(byCategory.entries())) {
      if (catLearnings.length < 3) continue;
      
      // Clustering simple basado en similitud
      const clusters = this.clusterLearnings(catLearnings);
      
      for (const cluster of clusters) {
        if (cluster.length >= 3) {
          patterns.push({
            id: `pattern-${category}-${patterns.length}`,
            name: `${category} pattern ${patterns.length + 1}`,
            description: this.generatePatternDescription(cluster),
            examples: cluster,
            frequency: cluster.length,
            confidence: this.calculateConfidence(cluster)
          });
        }
      }
    }
    
    return patterns.sort((a, b) => b.confidence - a.confidence);
  }
  
  /**
   * Clustering simple de learnings
   */
  private clusterLearnings(learnings: Learning[]): Learning[][] {
    const clusters: Learning[][] = [];
    const threshold = 0.8;
    
    for (const learning of learnings) {
      let added = false;
      
      for (const cluster of clusters) {
        const representative = cluster[0];
        const similarity = this.backend.similarity(
          learning.embedding,
          representative.embedding
        );
        
        if (similarity >= threshold) {
          cluster.push(learning);
          added = true;
          break;
        }
      }
      
      if (!added) {
        clusters.push([learning]);
      }
    }
    
    return clusters;
  }
  
  /**
   * Genera descripción de un patrón
   */
  private generatePatternDescription(cluster: Learning[]): string {
    const commonWords = this.extractCommonWords(cluster.map(l => l.content));
    return `Pattern involving: ${commonWords.slice(0, 5).join(', ')}`;
  }
  
  /**
   * Extrae palabras comunes
   */
  private extractCommonWords(contents: string[]): string[] {
    const wordCounts = new Map<string, number>();
    
    for (const content of contents) {
      const words = content.toLowerCase().split(/\W+/).filter(w => w.length > 3);
      for (const word of words) {
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
      }
    }
    
    return Array.from(wordCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([word]) => word);
  }
  
  /**
   * Calcula confianza de un patrón
   */
  private calculateConfidence(cluster: Learning[]): number {
    if (cluster.length < 2) return 0;
    
    let totalSimilarity = 0;
    let count = 0;
    
    for (let i = 0; i < cluster.length; i++) {
      for (let j = i + 1; j < cluster.length; j++) {
        totalSimilarity += this.backend.similarity(
          cluster[i].embedding,
          cluster[j].embedding
        );
        count++;
      }
    }
    
    return count > 0 ? totalSimilarity / count : 0;
  }
  
  /**
   * Convierte una fila de DB a Learning
   */
  private rowToLearning(row: any): Learning {
    return {
      id: row.id,
      content: row.content,
      embedding: row.embedding 
        ? Array.from(new Float32Array(row.embedding.buffer))
        : [],
      metadata: {
        source: row.source,
        timestamp: new Date(row.timestamp),
        tags: JSON.parse(row.tags || '[]'),
        category: row.category
      },
      context: {
        codebase: row.codebase,
        files: JSON.parse(row.files || '[]'),
        task: row.task
      }
    };
  }
  
  /**
   * Cierra la conexión a la base de datos
   */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }
}
