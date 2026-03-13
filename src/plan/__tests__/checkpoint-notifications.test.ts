import { describe, it, expect, beforeEach } from '@jest/globals';
import { 
  CheckpointNotifier, 
  CLINotificationChannel,
  type CheckpointNotification,
  type CheckpointInstance
} from '../checkpoint-notifications.js';
import type { PlanTask } from '../types.js';

describe('CheckpointNotifier', () => {
  let notifier: CheckpointNotifier;
  let mockChannel: {
    send: jest.Mock<Promise<void>, [CheckpointNotification]>;
  };

  beforeEach(() => {
    notifier = new CheckpointNotifier();
    mockChannel = {
      send: jest.fn().mockResolvedValue(undefined),
    };
    notifier.addChannel(mockChannel);
  });

  it('should create a checkpoint', async () => {
    const task: PlanTask = {
      id: 'task-1',
      type: 'checkpoint:human-verify',
      name: 'Test checkpoint',
      files: [],
      action: 'Test action',
      done: 'Done',
      checkpointData: {
        gate: 'blocking',
        whatBuilt: 'Test feature',
        howToVerify: 'Check it works',
        resumeSignal: 'approved',
      },
    };

    const checkpoint = await notifier.createCheckpoint(task);
    
    expect(checkpoint.taskId).toBe('task-1');
    expect(checkpoint.state).toBe('pending');
  });

  it('should parse approve resume signal', () => {
    const result = notifier.parseResumeSignal('approved');
    expect(result.action).toBe('approve');
  });

  it('should parse decision resume signal', () => {
    const result = notifier.parseResumeSignal('select: supabase-auth');
    expect(result.action).toBe('decision');
    expect(result.value).toBe('supabase-auth');
  });

  it('should parse reject signal', () => {
    const result = notifier.parseResumeSignal('issues: layout broken');
    expect(result.action).toBe('reject');
    expect(result.issues).toBe('layout broken');
  });

  it('should parse secrets signal', () => {
    const result = notifier.parseResumeSignal('secrets: STRIPE_KEY=sk_xxx');
    expect(result.action).toBe('secrets');
    expect(result.value).toBe('STRIPE_KEY=sk_xxx');
  });

  it('should parse yes/done as approve', () => {
    expect(notifier.parseResumeSignal('yes').action).toBe('approve');
    expect(notifier.parseResumeSignal('done').action).toBe('approve');
    expect(notifier.parseResumeSignal('y').action).toBe('approve');
  });

  it('should parse no/rejected as reject', () => {
    expect(notifier.parseResumeSignal('no').action).toBe('reject');
    expect(notifier.parseResumeSignal('rejected').action).toBe('reject');
  });

  it('should get checkpoint by id', async () => {
    const task: PlanTask = {
      id: 'task-1',
      type: 'checkpoint:human-verify',
      name: 'Test checkpoint',
      files: [],
      action: 'Test action',
      done: 'Done',
    };

    const checkpoint = await notifier.createCheckpoint(task);
    const found = notifier.getCheckpoint('task-1');
    
    expect(found).toBeDefined();
    expect(found?.taskId).toBe(checkpoint.taskId);
  });

  it('should get checkpoints by state', async () => {
    const task1: PlanTask = {
      id: 'task-1',
      type: 'checkpoint:human-verify',
      name: 'Test 1',
      files: [],
      action: 'Action 1',
      done: 'Done',
    };
    const task2: PlanTask = {
      id: 'task-2',
      type: 'checkpoint:decision',
      name: 'Test 2',
      files: [],
      action: 'Action 2',
      done: 'Done',
    };

    await notifier.createCheckpoint(task1);
    await notifier.createCheckpoint(task2);

    const pending = notifier.getCheckpointsByState('pending');
    expect(pending).toHaveLength(2);
  });
});

describe('CLINotificationChannel', () => {
  let channel: CLINotificationChannel;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    channel = new CLINotificationChannel();
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should send human-verify notification', async () => {
    const notification: CheckpointNotification = {
      type: 'human-verify',
      title: 'Verify Dashboard',
      body: 'Check the dashboard layout',
      actions: [
        { id: 'approve', label: '✅ Approve' },
        { id: 'reject', label: '❌ Reject' },
      ],
    };

    await channel.send(notification);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('CHECKPOINT: HUMAN-VERIFY')
    );
  });

  it('should send decision notification with options', async () => {
    const notification: CheckpointNotification = {
      type: 'decision',
      title: 'Choose Auth Provider',
      body: 'Which provider to use?',
      options: [
        { id: 'supabase', label: 'Supabase' },
        { id: 'auth0', label: 'Auth0' },
      ],
    };

    await channel.send(notification);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Options:')
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('supabase')
    );
  });

  it('should send human-action notification', async () => {
    const notification: CheckpointNotification = {
      type: 'human-action',
      title: 'Create Stripe Account',
      body: 'Complete Stripe setup',
      actions: [
        { id: 'done', label: '✅ Done' },
      ],
    };

    await channel.send(notification);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('CHECKPOINT: HUMAN-ACTION')
    );
  });
});
