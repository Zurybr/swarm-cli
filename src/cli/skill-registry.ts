/**
 * Skill Registry Singleton
 *
 * Provides lazy initialization of the SkillRegistry for CLI commands.
 * Ensures consistent database connection handling across commands.
 */

import sqlite3 from 'sqlite3';
import { SkillRegistry } from '../skills';
import { Logger } from '../utils/logger';

const logger = new Logger('SkillRegistry');

// Singleton instance
let skillRegistry: SkillRegistry | null = null;
let database: sqlite3.Database | null = null;

/**
 * Get or create the SkillRegistry singleton
 * @returns Promise resolving to SkillRegistry instance
 */
export async function getSkillRegistry(): Promise<SkillRegistry> {
  if (!skillRegistry) {
    const dbPath = process.env.SWARM_DB_PATH || './swarm.db';
    database = new sqlite3.Database(dbPath);
    skillRegistry = new SkillRegistry(database);
    await skillRegistry.initialize();

    // Handle cleanup
    process.on('exit', () => {
      if (database) {
        database.close((err) => {
          if (err) logger.error('Error closing database', err);
        });
      }
    });

    process.on('SIGINT', () => {
      if (database) {
        database.close((err) => {
          if (err) logger.error('Error closing database', err);
          process.exit(0);
        });
      }
    });
  }

  return skillRegistry;
}

/**
 * Reset the SkillRegistry singleton (useful for testing)
 */
export function resetSkillRegistry(): void {
  if (database) {
    database.close((err) => {
      if (err) logger.error('Error closing database during reset', err);
    });
  }
  skillRegistry = null;
  database = null;
}
