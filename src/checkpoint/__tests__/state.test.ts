/**
 * Checkpoint System - State Capture Tests
 */

import { StateCapture } from '../state';
import { CheckpointStorageConfig, DEFAULT_CHECKPOINT_STORAGE_CONFIG } from '../types';
import { Hive } from '../../hive';
import { SwarmMail } from '../../swarm-mail';
import * as fs from 'fs';
import * as path from 'path';

describe('StateCapture', () => {
  let stateCapture: StateCapture;
  let testDir: string;
  let hive: Hive;
  let swarmMail: SwarmMail;

  beforeEach(async () => {
    testDir = path.join(__dirname, '.test-checkpoints');
    await fs.promises.mkdir(testDir, { recursive: true });

    const config: CheckpointStorageConfig = {
      ...DEFAULT_CHECKPOINT_STORAGE_CONFIG,
      baseDir: testDir,
    };

    hive = new Hive({ baseDir: path.join(testDir, 'hive') });
    await hive.init();

    swarmMail = new SwarmMail({
      agentName: 'test-agent',
      storagePath: path.join(testDir, 'swarm-mail'),
    });

    stateCapture = new StateCapture(config, hive, swarmMail);
    await stateCapture.init();
  });

  afterEach(async () => {
    await hive.close();
    await fs.promises.rm(testDir, { recursive: true, force: true });
  });

  describe('initialization', () => {
    it('should initialize and create directories', async () => {
      const snapshotsDir = path.join(testDir, 'snapshots');
      expect(fs.existsSync(snapshotsDir)).toBe(true);
    });
  });

  describe('capture', () => {
    it('should capture environment state', async () => {
      const env = await stateCapture.captureEnvironment();

      expect(env.workingDirectory).toBe(process.cwd());
      expect(env.timestamp).toBeGreaterThan(0);
      expect(env.envVars).toBeDefined();
    });

    it('should capture agent state', async () => {
      const agents = await stateCapture.captureAgents(['test-agent']);

      expect(agents).toHaveLength(1);
      expect(agents[0].agentName).toBe('test-agent');
      expect(agents[0].progressPercent).toBe(0);
    });

    it('should capture mail state', async () => {
      const mail = await stateCapture.captureMail();

      expect(mail.messages).toEqual([]);
      expect(mail.reservations).toEqual([]);
      expect(mail.activeThreads).toEqual([]);
    });

    it('should capture task state from hive', async () => {
      // Create a test cell
      const cell = await hive.createCell({
        title: 'Test Task',
        type: 'task',
        status: 'in_progress',
      });

      const tasks = await stateCapture.captureTasks();

      expect(tasks).toHaveLength(1);
      expect(tasks[0].cellId).toBe(cell.id);
      expect(tasks[0].cellData.title).toBe('Test Task');
    });

    it('should create full snapshot', async () => {
      const snapshot = await stateCapture.createSnapshot('manual', 'Test snapshot');

      expect(snapshot.version).toBe('1.0.0');
      expect(snapshot.id).toBeDefined();
      expect(snapshot.trigger).toBe('manual');
      expect(snapshot.description).toBe('Test snapshot');
      expect(snapshot.environment).toBeDefined();
      expect(snapshot.agents).toBeDefined();
      expect(snapshot.tasks).toBeDefined();
      expect(snapshot.mail).toBeDefined();
      expect(snapshot.createdAt).toBeGreaterThan(0);
    });

    it('should save and load snapshot', async () => {
      const snapshot = await stateCapture.createSnapshot('manual', 'Test snapshot');
      const saved = await stateCapture.saveSnapshot(snapshot);

      expect(saved).toBe(true);

      const loaded = await stateCapture.loadSnapshot(snapshot.id);
      expect(loaded).not.toBeNull();
      expect(loaded!.id).toBe(snapshot.id);
      expect(loaded!.description).toBe('Test snapshot');
    });

    it('should return null for non-existent snapshot', async () => {
      const loaded = await stateCapture.loadSnapshot('non-existent');
      expect(loaded).toBeNull();
    });

    it('should delete snapshot', async () => {
      const snapshot = await stateCapture.createSnapshot('manual', 'To be deleted');
      await stateCapture.saveSnapshot(snapshot);

      const deleted = await stateCapture.deleteSnapshot(snapshot.id);
      expect(deleted).toBe(true);

      const loaded = await stateCapture.loadSnapshot(snapshot.id);
      expect(loaded).toBeNull();
    });

    it('should list all snapshots', async () => {
      await stateCapture.saveSnapshot(await stateCapture.createSnapshot('manual', 'First'));
      await stateCapture.saveSnapshot(await stateCapture.createSnapshot('manual', 'Second'));

      const snapshots = await stateCapture.listSnapshots();
      expect(snapshots).toHaveLength(2);
    });
  });

  describe('restore', () => {
    it('should validate snapshot integrity', async () => {
      const snapshot = await stateCapture.createSnapshot('manual', 'Test');
      const valid = await stateCapture.validateSnapshot(snapshot);
      expect(valid).toBe(true);
    });

    it('should detect invalid snapshot', async () => {
      const invalidSnapshot = { id: 'test', version: 'invalid' } as any;
      const valid = await stateCapture.validateSnapshot(invalidSnapshot);
      expect(valid).toBe(false);
    });
  });
});
