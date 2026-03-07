import sqlite3 from 'sqlite3';
import { Logger } from '../../utils/logger';

const logger = new Logger('SQLite');

export class SQLiteConnection {
  private db: sqlite3.Database | null = null;

  constructor(private dbPath: string) {}

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          logger.error(`Failed to connect to SQLite at ${this.dbPath}`, err);
          reject(err);
        } else {
          logger.info(`Connected to SQLite at ${this.dbPath}`);
          this.initializeSchema().then(resolve).catch(reject);
        }
      });
    });
  }

  async initializeSchema(): Promise<void> {
    const schema = `
      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        spec TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL,
        dependencies TEXT,
        agent_id TEXT,
        execution_mode TEXT,
        max_retries INTEGER DEFAULT 5,
        retry_count INTEGER DEFAULT 0,
        github_issue_id INTEGER,
        worktree_path TEXT,
        FOREIGN KEY (run_id) REFERENCES runs(id)
      );

      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        role TEXT NOT NULL,
        model TEXT NOT NULL,
        api_url TEXT NOT NULL,
        status TEXT NOT NULL,
        current_task_id TEXT,
        tools TEXT,
        FOREIGN KEY (run_id) REFERENCES runs(id)
      );
    `;
    
    return new Promise((resolve, reject) => {
      this.db?.exec(schema, (err) => {
        if (err) {
          logger.error('Failed to initialize schema', err);
          reject(err);
        } else {
          logger.info('Schema initialized');
          resolve();
        }
      });
    });
  }

  getDb(): sqlite3.Database {
    if (!this.db) throw new Error('Database not connected');
    return this.db;
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db?.close((err) => {
        if (err) reject(err);
        else {
          logger.info('Database connection closed');
          resolve();
        }
      });
    });
  }
}
