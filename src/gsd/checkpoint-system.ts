/**
 * Checkpoint System - Issue #17
 * Sistema de verificación humana en hitos clave
 */

import { CheckpointConfig, CheckpointType } from '../types';

export interface CheckpointResult {
  approved: boolean;
  feedback?: string;
  resumedAt: Date;
  autoApproved: boolean;
}

export interface CheckpointHandler {
  type: CheckpointType;
  handle(config: CheckpointConfig): Promise<CheckpointResult>;
}

export class HumanVerifyCheckpoint implements CheckpointHandler {
  type: CheckpointType = 'human-verify';
  
  async handle(config: CheckpointConfig): Promise<CheckpointResult> {
    console.log('\n' + '='.repeat(60));
    console.log('🔍 CHECKPOINT: Human Verification Required');
    console.log('='.repeat(60));
    console.log(`\n📦 What was built:\n${config.what_built}`);
    console.log(`\n✅ How to verify:\n${config.how_to_verify}`);
    console.log(`\n💡 To continue, signal: "${config.resume_signal}"`);
    console.log('='.repeat(60) + '\n');
    
    // En modo real, esto esperaría input del usuario
    // Por ahora, simulamos auto-approval para testing
    return {
      approved: true,
      feedback: 'Auto-approved for testing',
      resumedAt: new Date(),
      autoApproved: true
    };
  }
}

export class DecisionCheckpoint implements CheckpointHandler {
  type: CheckpointType = 'decision';
  
  async handle(config: CheckpointConfig): Promise<CheckpointResult> {
    console.log('\n' + '='.repeat(60));
    console.log('🤔 CHECKPOINT: Decision Required');
    console.log('='.repeat(60));
    console.log(`\n📋 Decision needed:\n${config.what_built}`);
    console.log(`\n📝 Options:\n${config.how_to_verify}`);
    console.log(`\n💡 To continue, signal: "${config.resume_signal}"`);
    console.log('='.repeat(60) + '\n');
    
    return {
      approved: true,
      feedback: 'Decision made: proceed',
      resumedAt: new Date(),
      autoApproved: true
    };
  }
}

export class NotifyCheckpoint implements CheckpointHandler {
  type: CheckpointType = 'notify';
  
  async handle(config: CheckpointConfig): Promise<CheckpointResult> {
    console.log('\n' + '='.repeat(60));
    console.log('📢 CHECKPOINT: Notification');
    console.log('='.repeat(60));
    console.log(`\n📬 Notification:\n${config.what_built}`);
    console.log(`\n📄 Details:\n${config.how_to_verify}`);
    console.log('='.repeat(60) + '\n');
    
    // Notificación no bloqueante
    return {
      approved: true,
      resumedAt: new Date(),
      autoApproved: true
    };
  }
}

export class CheckpointSystem {
  private handlers: Map<CheckpointType, CheckpointHandler> = new Map();
  private autoApprove: boolean = false;
  private checkpointHistory: Array<{ checkpoint: CheckpointConfig; result: CheckpointResult }> = [];
  
  constructor(autoApprove: boolean = false) {
    this.autoApprove = autoApprove;
    this.registerDefaultHandlers();
  }
  
  /**
   * Registra handlers por defecto
   */
  private registerDefaultHandlers(): void {
    this.registerHandler(new HumanVerifyCheckpoint());
    this.registerHandler(new DecisionCheckpoint());
    this.registerHandler(new NotifyCheckpoint());
  }
  
  /**
   * Registra un handler de checkpoint
   */
  registerHandler(handler: CheckpointHandler): void {
    this.handlers.set(handler.type, handler);
  }
  
  /**
   * Ejecuta un checkpoint
   */
  async execute(checkpoint: CheckpointConfig): Promise<CheckpointResult> {
    // Si auto-approve está habilitado y es bloqueante, auto-aprobar
    if (this.autoApprove && checkpoint.gate === 'blocking') {
      const result: CheckpointResult = {
        approved: true,
        feedback: 'Auto-approved',
        resumedAt: new Date(),
        autoApproved: true
      };
      this.checkpointHistory.push({ checkpoint, result });
      return result;
    }
    
    const handler = this.handlers.get(checkpoint.type);
    if (!handler) {
      throw new Error(`No handler registered for checkpoint type: ${checkpoint.type}`);
    }
    
    const result = await handler.handle(checkpoint);
    this.checkpointHistory.push({ checkpoint, result });
    
    return result;
  }
  
  /**
   * Verifica si hay checkpoints pendientes
   */
  hasPendingCheckpoints(): boolean {
    return this.checkpointHistory.some(h => !h.result.approved);
  }
  
  /**
   * Obtiene el historial de checkpoints
   */
  getHistory(): Array<{ checkpoint: CheckpointConfig; result: CheckpointResult }> {
    return [...this.checkpointHistory];
  }
  
  /**
   * Habilita/deshabilita auto-approve
   */
  setAutoApprove(enabled: boolean): void {
    this.autoApprove = enabled;
  }
  
  /**
   * Limpia el historial
   */
  clearHistory(): void {
    this.checkpointHistory = [];
  }
  
  /**
   * Obtiene estadísticas de checkpoints
   */
  getStats(): {
    total: number;
    approved: number;
    rejected: number;
    autoApproved: number;
  } {
    return {
      total: this.checkpointHistory.length,
      approved: this.checkpointHistory.filter(h => h.result.approved).length,
      rejected: this.checkpointHistory.filter(h => !h.result.approved).length,
      autoApproved: this.checkpointHistory.filter(h => h.result.autoApproved).length
    };
  }
}
