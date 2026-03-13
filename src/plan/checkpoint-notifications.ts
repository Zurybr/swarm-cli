import type { PlanTask } from './types.js';

export type CheckpointState = 
  | 'pending' 
  | 'notified' 
  | 'waiting' 
  | 'resolved' 
  | 'resumed'
  | 'timeout'
  | 'escalated';

export interface CheckpointInstance {
  taskId: string;
  state: CheckpointState;
  task: PlanTask;
  createdAt: Date;
  notifiedAt?: Date;
  resolvedAt?: Date;
  resumeSignal?: string;
}

export interface NotificationChannel {
  send(message: CheckpointNotification): Promise<void>;
}

export interface CheckpointNotification {
  type: 'human-verify' | 'decision' | 'human-action';
  title: string;
  body: string;
  options?: { id: string; label: string }[];
  actions?: { id: string; label: string }[];
}

export class CheckpointNotifier {
  private checkpoints: Map<string, CheckpointInstance> = new Map();
  private channels: NotificationChannel[] = [];

  addChannel(channel: NotificationChannel): void {
    this.channels.push(channel);
  }

  async createCheckpoint(task: PlanTask): Promise<CheckpointInstance> {
    const checkpoint: CheckpointInstance = {
      taskId: task.id,
      state: 'pending',
      task,
      createdAt: new Date(),
    };
    
    this.checkpoints.set(task.id, checkpoint);
    return checkpoint;
  }

  async notify(checkpointId: string): Promise<void> {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) throw new Error(`Checkpoint ${checkpointId} not found`);

    checkpoint.state = 'notified';
    checkpoint.notifiedAt = new Date();

    const notification = this.buildNotification(checkpoint);
    
    for (const channel of this.channels) {
      await channel.send(notification);
    }
  }

  private buildNotification(checkpoint: CheckpointInstance): CheckpointNotification {
    const task = checkpoint.task;
    const data = task.checkpointData;
    
    switch (task.type) {
      case 'checkpoint:human-verify':
        return {
          type: 'human-verify',
          title: `Verify: ${task.name}`,
          body: `${data?.whatBuilt || task.action}\n\nHow to verify:\n${data?.howToVerify || task.done}`,
          actions: [
            { id: 'approve', label: '✅ Approve' },
            { id: 'reject', label: '❌ Reject' },
          ],
        };
      
      case 'checkpoint:decision':
        const options = data?.options?.map(opt => ({ 
          id: opt.id, 
          label: opt.name 
        })) || [];
        return {
          type: 'decision',
          title: `Decision: ${data?.decision || task.name}`,
          body: data?.context || task.action,
          options,
        };
      
      case 'checkpoint:human-action':
        return {
          type: 'human-action',
          title: `Action Required: ${task.name}`,
          body: `${data?.why || ''}\n\nSteps:\n${data?.steps?.join('\n') || ''}`,
          actions: [
            { id: 'done', label: '✅ Done' },
          ],
        };
      
      default:
        throw new Error(`Unknown checkpoint type: ${task.type}`);
    }
  }

  async resolveCheckpoint(
    checkpointId: string, 
    signal: string
  ): Promise<void> {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) throw new Error(`Checkpoint ${checkpointId} not found`);

    checkpoint.resumeSignal = signal;
    checkpoint.state = 'resolved';
    checkpoint.resolvedAt = new Date();
  }

  parseResumeSignal(signal: string): {
    action: 'approve' | 'reject' | 'decision' | 'secrets';
    value?: string;
    issues?: string;
  } {
    const trimmed = signal.trim().toLowerCase();
    
    if (['approved', 'yes', 'done', 'y'].includes(trimmed)) {
      return { action: 'approve' };
    }
    
    if (['rejected', 'no'].includes(trimmed)) {
      return { action: 'reject' };
    }
    
    if (trimmed.startsWith('select:')) {
      return { 
        action: 'decision', 
        value: trimmed.substring(7).trim() 
      };
    }
    
    if (trimmed.startsWith('secrets:')) {
      return { 
        action: 'secrets', 
        value: trimmed.substring(8).trim() 
      };
    }
    
    if (trimmed.startsWith('issues:')) {
      return { 
        action: 'reject', 
        issues: trimmed.substring(7).trim() 
      };
    }
    
    return { action: 'approve' };
  }

  getCheckpoint(checkpointId: string): CheckpointInstance | undefined {
    return this.checkpoints.get(checkpointId);
  }

  getCheckpointsByState(state: CheckpointState): CheckpointInstance[] {
    return Array.from(this.checkpoints.values()).filter(
      c => c.state === state
    );
  }
}

export class CLINotificationChannel implements NotificationChannel {
  async send(notification: CheckpointNotification): Promise<void> {
    console.log('\n═══════════════════════════════════════');
    console.log(`🔔 CHECKPOINT: ${notification.type.toUpperCase()}`);
    console.log('═══════════════════════════════════════');
    console.log(`\n${notification.title}\n`);
    console.log(notification.body);
    
    if (notification.actions?.length) {
      console.log('\nActions:');
      notification.actions.forEach((action, i) => {
        console.log(`  ${i + 1}. ${action.label}`);
      });
    }
    
    if (notification.options?.length) {
      console.log('\nOptions:');
      notification.options.forEach(opt => {
        console.log(`  - ${opt.id}: ${opt.label}`);
      });
    }
    
    console.log('\n═══════════════════════════════════════\n');
  }
}
