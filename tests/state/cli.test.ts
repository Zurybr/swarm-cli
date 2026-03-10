/**
 * Tests for state/cli.ts
 */

// Mock chalk before importing the CLI
jest.mock('chalk', () => ({
  __esModule: true,
  default: {
    green: (text: string) => text,
    red: (text: string) => text,
    yellow: (text: string) => text,
    blue: (text: string) => text,
    gray: (text: string) => text,
    bold: (text: string) => text,
  },
}));

import { createStateCommand } from '../../src/state/cli';
import { Command } from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('State CLI', () => {
  let tempDir: string;
  let stateFilePath: string;
  let program: Command;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'state-cli-test-'));
    stateFilePath = path.join(tempDir, 'STATE.md');
    program = createStateCommand();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('command structure', () => {
    it('should have all required commands', () => {
      const commands = program.commands.map(c => c.name());

      expect(commands).toContain('init');
      expect(commands).toContain('show');
      expect(commands).toContain('list');
      expect(commands).toContain('add');
      expect(commands).toContain('update');
      expect(commands).toContain('remove');
      expect(commands).toContain('move');
      expect(commands).toContain('sync');
      expect(commands).toContain('validate');
      expect(commands).toContain('stats');
      expect(commands).toContain('export');
      expect(commands).toContain('archive');
    });

    it('should have file option', () => {
      const options = program.options.map(o => o.long);
      expect(options).toContain('--file');
    });
  });

  describe('init command', () => {
    it('should be registered', () => {
      const initCmd = program.commands.find(c => c.name() === 'init');
      expect(initCmd).toBeDefined();
    });

    it('should accept project name argument', () => {
      const initCmd = program.commands.find(c => c.name() === 'init');
      expect(initCmd?.registeredArguments).toHaveLength(1);
    });

    it('should have --from-hive option', () => {
      const initCmd = program.commands.find(c => c.name() === 'init');
      const options = initCmd?.options.map(o => o.long);
      expect(options).toContain('--from-hive');
    });
  });

  describe('show command', () => {
    it('should be registered', () => {
      const showCmd = program.commands.find(c => c.name() === 'show');
      expect(showCmd).toBeDefined();
    });

    it('should have section filter option', () => {
      const showCmd = program.commands.find(c => c.name() === 'show');
      const options = showCmd?.options.map(o => o.long);
      expect(options).toContain('--section');
    });

    it('should have item filter option', () => {
      const showCmd = program.commands.find(c => c.name() === 'show');
      const options = showCmd?.options.map(o => o.long);
      expect(options).toContain('--item');
    });

    it('should have json output option', () => {
      const showCmd = program.commands.find(c => c.name() === 'show');
      const options = showCmd?.options.map(o => o.long);
      expect(options).toContain('--json');
    });
  });

  describe('list command', () => {
    it('should be registered', () => {
      const listCmd = program.commands.find(c => c.name() === 'list');
      expect(listCmd).toBeDefined();
    });

    it('should have filter options', () => {
      const listCmd = program.commands.find(c => c.name() === 'list');
      const options = listCmd?.options.map(o => o.long);
      expect(options).toContain('--status');
      expect(options).toContain('--type');
      expect(options).toContain('--owner');
    });
  });

  describe('add command', () => {
    it('should be registered', () => {
      const addCmd = program.commands.find(c => c.name() === 'add');
      expect(addCmd).toBeDefined();
    });

    it('should require title argument', () => {
      const addCmd = program.commands.find(c => c.name() === 'add');
      expect(addCmd?.registeredArguments).toHaveLength(1);
    });

    it('should have metadata options', () => {
      const addCmd = program.commands.find(c => c.name() === 'add');
      const options = addCmd?.options.map(o => o.long);
      expect(options).toContain('--status');
      expect(options).toContain('--type');
      expect(options).toContain('--priority');
      expect(options).toContain('--owner');
    });
  });

  describe('update command', () => {
    it('should be registered', () => {
      const updateCmd = program.commands.find(c => c.name() === 'update');
      expect(updateCmd).toBeDefined();
    });

    it('should require ID argument', () => {
      const updateCmd = program.commands.find(c => c.name() === 'update');
      expect(updateCmd?.registeredArguments).toHaveLength(1);
    });
  });

  describe('remove command', () => {
    it('should be registered', () => {
      const removeCmd = program.commands.find(c => c.name() === 'remove');
      expect(removeCmd).toBeDefined();
    });

    it('should have rm alias', () => {
      const removeCmd = program.commands.find(c => c.name() === 'remove');
      expect(removeCmd?.aliases()).toContain('rm');
    });

    it('should have force option', () => {
      const removeCmd = program.commands.find(c => c.name() === 'remove');
      const options = removeCmd?.options.map(o => o.long);
      expect(options).toContain('--force');
    });
  });

  describe('move command', () => {
    it('should be registered', () => {
      const moveCmd = program.commands.find(c => c.name() === 'move');
      expect(moveCmd).toBeDefined();
    });

    it('should require ID and section arguments', () => {
      const moveCmd = program.commands.find(c => c.name() === 'move');
      expect(moveCmd?.registeredArguments).toHaveLength(2);
    });
  });

  describe('sync command', () => {
    it('should be registered', () => {
      const syncCmd = program.commands.find(c => c.name() === 'sync');
      expect(syncCmd).toBeDefined();
    });

    it('should have direction option', () => {
      const syncCmd = program.commands.find(c => c.name() === 'sync');
      const options = syncCmd?.options.map(o => o.long);
      expect(options).toContain('--direction');
    });

    it('should have conflict resolution option', () => {
      const syncCmd = program.commands.find(c => c.name() === 'sync');
      const options = syncCmd?.options.map(o => o.long);
      expect(options).toContain('--resolve');
    });

    it('should have dry-run option', () => {
      const syncCmd = program.commands.find(c => c.name() === 'sync');
      const options = syncCmd?.options.map(o => o.long);
      expect(options).toContain('--dry-run');
    });
  });

  describe('validate command', () => {
    it('should be registered', () => {
      const validateCmd = program.commands.find(c => c.name() === 'validate');
      expect(validateCmd).toBeDefined();
    });

    it('should have strict option', () => {
      const validateCmd = program.commands.find(c => c.name() === 'validate');
      const options = validateCmd?.options.map(o => o.long);
      expect(options).toContain('--strict');
    });
  });

  describe('stats command', () => {
    it('should be registered', () => {
      const statsCmd = program.commands.find(c => c.name() === 'stats');
      expect(statsCmd).toBeDefined();
    });

    it('should have json output option', () => {
      const statsCmd = program.commands.find(c => c.name() === 'stats');
      const options = statsCmd?.options.map(o => o.long);
      expect(options).toContain('--json');
    });
  });

  describe('export command', () => {
    it('should be registered', () => {
      const exportCmd = program.commands.find(c => c.name() === 'export');
      expect(exportCmd).toBeDefined();
    });

    it('should require format argument', () => {
      const exportCmd = program.commands.find(c => c.name() === 'export');
      expect(exportCmd?.registeredArguments).toHaveLength(1);
    });

    it('should have output option', () => {
      const exportCmd = program.commands.find(c => c.name() === 'export');
      const options = exportCmd?.options.map(o => o.long);
      expect(options).toContain('--output');
    });
  });

  describe('archive command', () => {
    it('should be registered', () => {
      const archiveCmd = program.commands.find(c => c.name() === 'archive');
      expect(archiveCmd).toBeDefined();
    });

    it('should have before date option', () => {
      const archiveCmd = program.commands.find(c => c.name() === 'archive');
      const options = archiveCmd?.options.map(o => o.long);
      expect(options).toContain('--before');
    });
  });
});
