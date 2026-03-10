/**
 * Tests for must-have validation
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  createMustHave,
  existenceMustHave,
  valueMustHave,
  structureMustHave,
  relationMustHave,
  validateMustHave,
  validateExistence,
  validateValue,
  validateStructure,
  validateRelation,
  applyOperator,
  filterByType,
  getRequiredMustHaves,
  getOptionalMustHaves,
  calculateWeightedSatisfaction,
  resetMustHaves,
  validateMustHaves,
} from '../must-have';
import type { MustHave, ValueOperator } from '../types';

describe('Must-Have Validation', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'verify-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Factory Functions', () => {
    it('should create must-have with createMustHave', () => {
      const mh = createMustHave({
        description: 'Test must-have',
        type: 'existence',
        target: 'test.txt',
        required: true,
        weight: 0.8,
      });

      expect(mh.description).toBe('Test must-have');
      expect(mh.type).toBe('existence');
      expect(mh.required).toBe(true);
      expect(mh.weight).toBe(0.8);
    });

    it('should create existence must-have', () => {
      const mh = existenceMustHave('src/index.ts', 'Entry point exists');

      expect(mh.type).toBe('existence');
      expect(mh.target).toBe('src/index.ts');
      expect(mh.required).toBe(true);
    });

    it('should create value must-have', () => {
      const mh = valueMustHave(
        'config.json',
        'Version is correct',
        '1.0.0',
        'equals'
      );

      expect(mh.type).toBe('value');
      expect(mh.expected).toBe('1.0.0');
      expect(mh.operator).toBe('equals');
    });

    it('should create structure must-have', () => {
      const mh = structureMustHave('package.json', 'Has required fields', [
        'name',
        'version',
      ]);

      expect(mh.type).toBe('structure');
      expect(mh.expected).toEqual(['name', 'version']);
    });

    it('should create relation must-have', () => {
      const mh = relationMustHave(
        'src/app.ts',
        'src/utils.ts',
        'depends_on',
        'App depends on utils'
      );

      expect(mh.type).toBe('relation');
      expect(mh.relatedTarget).toBe('src/utils.ts');
      expect(mh.relationType).toBe('depends_on');
    });
  });

  describe('applyOperator', () => {
    it('should handle equals operator', () => {
      expect(applyOperator('test', 'test', 'equals')).toBe(true);
      expect(applyOperator('test', 'other', 'equals')).toBe(false);
      expect(applyOperator(42, 42, 'equals')).toBe(true);
      expect(applyOperator({ a: 1 }, { a: 1 }, 'equals')).toBe(true);
    });

    it('should handle not_equals operator', () => {
      expect(applyOperator('test', 'other', 'not_equals')).toBe(true);
      expect(applyOperator('test', 'test', 'not_equals')).toBe(false);
    });

    it('should handle contains operator', () => {
      expect(applyOperator('hello world', 'world', 'contains')).toBe(true);
      expect(applyOperator('hello world', 'foo', 'contains')).toBe(false);
      expect(applyOperator(['a', 'b', 'c'], 'b', 'contains')).toBe(true);
      expect(applyOperator(['a', 'b', 'c'], 'd', 'contains')).toBe(false);
    });

    it('should handle starts_with operator', () => {
      expect(applyOperator('hello world', 'hello', 'starts_with')).toBe(true);
      expect(applyOperator('hello world', 'world', 'starts_with')).toBe(false);
    });

    it('should handle ends_with operator', () => {
      expect(applyOperator('hello world', 'world', 'ends_with')).toBe(true);
      expect(applyOperator('hello world', 'hello', 'ends_with')).toBe(false);
    });

    it('should handle matches_regex operator', () => {
      expect(applyOperator('hello123', '^[a-z]+\\d+$', 'matches_regex')).toBe(true);
      expect(applyOperator('hello', '^[a-z]+\\d+$', 'matches_regex')).toBe(false);
    });

    it('should handle greater_than operator', () => {
      expect(applyOperator(10, 5, 'greater_than')).toBe(true);
      expect(applyOperator(5, 10, 'greater_than')).toBe(false);
    });

    it('should handle less_than operator', () => {
      expect(applyOperator(5, 10, 'less_than')).toBe(true);
      expect(applyOperator(10, 5, 'less_than')).toBe(false);
    });

    it('should handle in_range operator', () => {
      expect(applyOperator(5, [1, 10], 'in_range')).toBe(true);
      expect(applyOperator(0, [1, 10], 'in_range')).toBe(false);
      expect(applyOperator(15, [1, 10], 'in_range')).toBe(false);
    });

    it('should handle one_of operator', () => {
      expect(applyOperator('b', ['a', 'b', 'c'], 'one_of')).toBe(true);
      expect(applyOperator('d', ['a', 'b', 'c'], 'one_of')).toBe(false);
    });
  });

  describe('validateExistence', () => {
    it('should pass when file exists', async () => {
      const testFile = path.join(tempDir, 'exists.txt');
      await fs.writeFile(testFile, 'content');

      const mh = existenceMustHave('exists.txt', 'File exists');
      const result = await validateExistence(mh, tempDir);

      expect(result.satisfied).toBe(true);
      expect(result.actual).toBe(testFile);
    });

    it('should fail when file does not exist', async () => {
      const mh = existenceMustHave('missing.txt', 'File exists');
      const result = await validateExistence(mh, tempDir);

      expect(result.satisfied).toBe(false);
      expect(result.actual).toBeNull();
      expect(result.message).toContain('does not exist');
    });

    it('should use custom error message', async () => {
      const mh = existenceMustHave('missing.txt', 'File exists', {
        errorMessage: 'Custom: file is missing!',
      });
      const result = await validateExistence(mh, tempDir);

      expect(result.message).toBe('Custom: file is missing!');
    });
  });

  describe('validateValue', () => {
    it('should pass when file value matches', async () => {
      const testFile = path.join(tempDir, 'config.json');
      await fs.writeFile(testFile, JSON.stringify({ version: '1.0.0' }));

      // Check the whole object matches
      const mh = valueMustHave('config.json', 'Version check', { version: '1.0.0' }, 'equals');
      const result = await validateValue(mh, tempDir);

      expect(result.satisfied).toBe(true);
    });

    it('should fail when file value does not match', async () => {
      const testFile = path.join(tempDir, 'config.json');
      await fs.writeFile(testFile, JSON.stringify({ version: '2.0.0' }));

      const mh = valueMustHave('config.json', 'Version check', { version: '1.0.0' }, 'equals');
      const result = await validateValue(mh, tempDir);

      expect(result.satisfied).toBe(false);
    });

    it('should handle string file content', async () => {
      const testFile = path.join(tempDir, 'version.txt');
      await fs.writeFile(testFile, '1.0.0');

      const mh = valueMustHave('version.txt', 'Version check', '1.0.0', 'equals');
      const result = await validateValue(mh, tempDir);

      expect(result.satisfied).toBe(true);
      expect(result.actual).toBe('1.0.0');
    });

    it('should use custom validator', async () => {
      const testFile = path.join(tempDir, 'number.txt');
      await fs.writeFile(testFile, '42');

      const mh = valueMustHave('number.txt', 'Number check', 10, 'greater_than');
      mh.validator = (actual) => typeof actual === 'number' && actual > 40;

      const result = await validateValue(mh, tempDir);

      expect(result.satisfied).toBe(true);
      expect(result.details?.customValidatorPassed).toBe(true);
    });
  });

  describe('validateStructure', () => {
    it('should pass when JSON has expected properties', async () => {
      const testFile = path.join(tempDir, 'package.json');
      await fs.writeFile(
        testFile,
        JSON.stringify({ name: 'test', version: '1.0.0' })
      );

      const mh = structureMustHave('package.json', 'Has fields', {
        name: 'string',
        version: 'string',
      });
      const result = await validateStructure(mh, tempDir);

      expect(result.satisfied).toBe(true);
    });

    it('should fail when JSON is missing expected properties', async () => {
      const testFile = path.join(tempDir, 'package.json');
      await fs.writeFile(testFile, JSON.stringify({ name: 'test' }));

      const mh = structureMustHave('package.json', 'Has fields', {
        name: 'string',
        version: 'string',
      });
      const result = await validateStructure(mh, tempDir);

      expect(result.satisfied).toBe(false);
      expect(result.details?.missingKeys).toContain('version');
    });

    it('should handle array type check', async () => {
      const testFile = path.join(tempDir, 'data.json');
      await fs.writeFile(testFile, JSON.stringify([1, 2, 3]));

      const mh = structureMustHave('data.json', 'Is array', 'array');
      const result = await validateStructure(mh, tempDir);

      expect(result.satisfied).toBe(true);
    });

    it('should handle object type check', async () => {
      const testFile = path.join(tempDir, 'data.json');
      await fs.writeFile(testFile, JSON.stringify({ key: 'value' }));

      const mh = structureMustHave('data.json', 'Is object', 'object');
      const result = await validateStructure(mh, tempDir);

      expect(result.satisfied).toBe(true);
    });

    it('should handle regex pattern check', async () => {
      const testFile = path.join(tempDir, 'data.txt');
      await fs.writeFile(testFile, 'hello123world');

      const mh = structureMustHave('data.txt', 'Matches pattern', '^[a-z]+\\d+[a-z]+$');
      const result = await validateStructure(mh, tempDir);

      expect(result.satisfied).toBe(true);
    });
  });

  describe('validateRelation', () => {
    it('should pass when depends_on relation exists', async () => {
      const appFile = path.join(tempDir, 'app.ts');
      const utilsFile = path.join(tempDir, 'utils.ts');

      await fs.writeFile(appFile, "import { helper } from './utils';");
      await fs.writeFile(utilsFile, 'export const helper = () => {};');

      const mh = relationMustHave(
        'app.ts',
        'utils.ts',
        'depends_on',
        'App depends on utils'
      );
      const result = await validateRelation(mh, tempDir);

      expect(result.satisfied).toBe(true);
    });

    it('should fail when target file does not exist', async () => {
      const utilsFile = path.join(tempDir, 'utils.ts');
      await fs.writeFile(utilsFile, 'export const helper = () => {};');

      const mh = relationMustHave(
        'missing.ts',
        'utils.ts',
        'depends_on',
        'Missing depends on utils'
      );
      const result = await validateRelation(mh, tempDir);

      expect(result.satisfied).toBe(false);
      expect(result.actual).toEqual({
        targetExists: false,
        relatedExists: true,
      });
    });

    it('should fail when relation is not found', async () => {
      const appFile = path.join(tempDir, 'app.ts');
      const utilsFile = path.join(tempDir, 'utils.ts');

      await fs.writeFile(appFile, '// No imports here');
      await fs.writeFile(utilsFile, 'export const helper = () => {};');

      const mh = relationMustHave(
        'app.ts',
        'utils.ts',
        'depends_on',
        'App depends on utils'
      );
      const result = await validateRelation(mh, tempDir);

      expect(result.satisfied).toBe(false);
    });

    it('should handle extends relation', async () => {
      const childFile = path.join(tempDir, 'child.ts');
      const parentFile = path.join(tempDir, 'parent.ts');

      // Note: basename of parent.ts is "parent" (lowercase), so we use lowercase in the extends
      await fs.writeFile(childFile, 'class Child extends parent {}');
      await fs.writeFile(parentFile, 'class parent {}');

      const mh = relationMustHave(
        'child.ts',
        'parent.ts',
        'extends',
        'Child extends parent'
      );
      const result = await validateRelation(mh, tempDir);

      expect(result.satisfied).toBe(true);
    });

    it('should fail when relatedTarget is not provided', async () => {
      const mh = createMustHave({
        description: 'Invalid relation',
        type: 'relation',
        target: 'app.ts',
      });

      const result = await validateRelation(mh, tempDir);

      expect(result.satisfied).toBe(false);
      expect(result.message).toContain('requires relatedTarget');
    });
  });

  describe('validateMustHave dispatcher', () => {
    it('should dispatch to correct validator by type', async () => {
      const testFile = path.join(tempDir, 'test.txt');
      await fs.writeFile(testFile, 'content');

      const mh = existenceMustHave('test.txt', 'File exists');
      const result = await validateMustHave(mh, tempDir);

      expect(result.satisfied).toBe(true);
      expect(mh.status).toBe('satisfied');
      expect(mh.lastCheckedAt).toBeInstanceOf(Date);
    });

    it('should update must-have status on failure', async () => {
      const mh = existenceMustHave('missing.txt', 'File exists');
      const result = await validateMustHave(mh, tempDir);

      expect(result.satisfied).toBe(false);
      expect(mh.status).toBe('failed');
    });

    it('should handle unknown types', async () => {
      const mh = createMustHave({
        description: 'Unknown',
        type: 'unknown' as any,
        target: 'test',
      });

      const result = await validateMustHave(mh, tempDir);

      expect(result.satisfied).toBe(false);
      expect(result.message).toContain('Unknown must-have type');
    });
  });

  describe('Batch Operations', () => {
    it('should validate multiple must-haves', async () => {
      const testFile = path.join(tempDir, 'exists.txt');
      await fs.writeFile(testFile, 'content');

      const mustHaves = [
        existenceMustHave('exists.txt', 'File exists'),
        existenceMustHave('missing.txt', 'File missing'),
      ];

      const results = await validateMustHaves(mustHaves, tempDir);

      expect(results).toHaveLength(2);
      expect(results[0].satisfied).toBe(true);
      expect(results[1].satisfied).toBe(false);
    });

    it('should filter must-haves by type', () => {
      const mustHaves: MustHave[] = [
        existenceMustHave('a.txt', 'Exists'),
        valueMustHave('b.txt', 'Value', 'test'),
        structureMustHave('c.txt', 'Structure', {}),
      ];

      const existence = filterByType(mustHaves, 'existence');
      expect(existence).toHaveLength(1);
      expect(existence[0].type).toBe('existence');
    });

    it('should get required must-haves', () => {
      const mustHaves: MustHave[] = [
        existenceMustHave('req.txt', 'Required'),
        existenceMustHave('opt.txt', 'Optional', { required: false }),
      ];

      const required = getRequiredMustHaves(mustHaves);
      expect(required).toHaveLength(1);
      expect(required[0].description).toBe('Required');
    });

    it('should get optional must-haves', () => {
      const mustHaves: MustHave[] = [
        existenceMustHave('req.txt', 'Required'),
        existenceMustHave('opt.txt', 'Optional', { required: false }),
      ];

      const optional = getOptionalMustHaves(mustHaves);
      expect(optional).toHaveLength(1);
      expect(optional[0].description).toBe('Optional');
    });

    it('should calculate weighted satisfaction', () => {
      const mustHaves: MustHave[] = [
        { ...existenceMustHave('a.txt', 'Heavy'), status: 'satisfied', weight: 0.8 },
        { ...existenceMustHave('b.txt', 'Light'), status: 'failed', weight: 0.2 },
      ];

      const result = calculateWeightedSatisfaction(mustHaves);

      expect(result.score).toBe(0.8);
      expect(result.total).toBe(1.0);
      expect(result.percentage).toBe(80);
    });

    it('should reset must-have statuses', () => {
      const mustHaves: MustHave[] = [
        { ...existenceMustHave('a.txt', 'Test'), status: 'satisfied' },
        { ...existenceMustHave('b.txt', 'Test'), status: 'failed' },
      ];

      resetMustHaves(mustHaves);

      expect(mustHaves[0].status).toBe('pending');
      expect(mustHaves[1].status).toBe('pending');
      expect(mustHaves[0].lastCheckedAt).toBeUndefined();
    });
  });
});
