/**
 * TDD Red-Green-Refactor Cycle Management
 *
 * Manages the state machine for TDD cycles, tracking phase transitions
 * and enforcing TDD discipline.
 */

import type {
  TDDCycle,
  TDDCyclePhase,
  TDDCycleStatus,
  PhaseTimestamps,
  PhaseDurations,
  TDDEvent,
  TDDEventHandler,
  TestExecutionResult,
  CycleStatistics,
} from './types.js';

// ============================================================================
// Cycle State Machine
// ============================================================================

/**
 * Valid phase transitions in TDD
 */
const VALID_PHASE_TRANSITIONS: Record<TDDCyclePhase, TDDCyclePhase[]> = {
  red: ['green'],
  green: ['refactor'],
  refactor: ['red'], // Complete cycle, start new one
};

/**
 * Check if a phase transition is valid
 */
export function isValidPhaseTransition(
  from: TDDCyclePhase,
  to: TDDCyclePhase
): boolean {
  if (from === to) return true; // Same phase is always valid
  return VALID_PHASE_TRANSITIONS[from].includes(to);
}

/**
 * Get the next expected phase in the TDD cycle
 */
export function getNextPhase(current: TDDCyclePhase): TDDCyclePhase | null {
  switch (current) {
    case 'red':
      return 'green';
    case 'green':
      return 'refactor';
    case 'refactor':
      return null; // Cycle complete
  }
}

// ============================================================================
// Cycle Manager Class
// ============================================================================

export class TDDCycleManager {
  private cycles: Map<string, TDDCycle> = new Map();
  private eventHandlers: TDDEventHandler[] = [];
  private currentCycleId?: string;

  /**
   * Register an event handler
   */
  onEvent(handler: TDDEventHandler): void {
    this.eventHandlers.push(handler);
  }

  /**
   * Remove an event handler
   */
  offEvent(handler: TDDEventHandler): void {
    const index = this.eventHandlers.indexOf(handler);
    if (index > -1) {
      this.eventHandlers.splice(index, 1);
    }
  }

  /**
   * Emit an event to all handlers
   */
  private async emitEvent(event: TDDEvent): Promise<void> {
    for (const handler of this.eventHandlers) {
      try {
        await handler(event);
      } catch (error) {
        console.error('Error in TDD event handler:', error);
      }
    }
  }

  /**
   * Register a new cycle
   */
  registerCycle(cycle: TDDCycle): void {
    this.cycles.set(cycle.id, cycle);
  }

  /**
   * Get a cycle by ID
   */
  getCycle(id: string): TDDCycle | undefined {
    return this.cycles.get(id);
  }

  /**
   * Get the current active cycle
   */
  getCurrentCycle(): TDDCycle | undefined {
    if (this.currentCycleId) {
      return this.cycles.get(this.currentCycleId);
    }
    return undefined;
  }

  /**
   * Set the current active cycle
   */
  setCurrentCycle(cycleId: string): boolean {
    if (!this.cycles.has(cycleId)) {
      return false;
    }
    this.currentCycleId = cycleId;
    return true;
  }

  /**
   * Start a cycle (transition from pending to in_progress)
   */
  async startCycle(cycleId: string, planId: string): Promise<TDDCycle> {
    const cycle = this.cycles.get(cycleId);
    if (!cycle) {
      throw new Error(`Cycle ${cycleId} not found`);
    }

    if (cycle.status !== 'pending') {
      throw new Error(`Cannot start cycle in ${cycle.status} status`);
    }

    cycle.status = 'in_progress';
    cycle.phaseTimestamps.red = new Date();
    this.currentCycleId = cycleId;

    await this.emitEvent({
      type: 'cycle-started',
      planId,
      cycleId,
      timestamp: new Date(),
      data: { phase: 'red' },
    });

    return cycle;
  }

  /**
   * Transition to a new phase
   */
  async transitionPhase(
    cycleId: string,
    newPhase: TDDCyclePhase,
    planId: string
  ): Promise<TDDCycle> {
    const cycle = this.cycles.get(cycleId);
    if (!cycle) {
      throw new Error(`Cycle ${cycleId} not found`);
    }

    if (!isValidPhaseTransition(cycle.phase, newPhase)) {
      throw new Error(
        `Invalid phase transition from ${cycle.phase} to ${newPhase}`
      );
    }

    // Record duration for current phase
    const now = new Date();
    const currentPhaseStart = cycle.phaseTimestamps[cycle.phase];
    if (currentPhaseStart) {
      const duration = now.getTime() - currentPhaseStart.getTime();
      cycle.phaseDurations[cycle.phase] = duration;
    }

    // Update phase
    const oldPhase = cycle.phase;
    cycle.phase = newPhase;
    cycle.phaseTimestamps[newPhase] = now;

    await this.emitEvent({
      type: 'phase-changed',
      planId,
      cycleId,
      timestamp: now,
      data: { from: oldPhase, to: newPhase },
    });

    return cycle;
  }

  /**
   * Complete the current cycle
   */
  async completeCycle(cycleId: string, planId: string): Promise<TDDCycle> {
    const cycle = this.cycles.get(cycleId);
    if (!cycle) {
      throw new Error(`Cycle ${cycleId} not found`);
    }

    if (cycle.phase !== 'refactor') {
      throw new Error('Can only complete cycle from refactor phase');
    }

    const now = new Date();

    // Record final phase duration
    const refactorStart = cycle.phaseTimestamps.refactor;
    if (refactorStart) {
      cycle.phaseDurations.refactor = now.getTime() - refactorStart.getTime();
    }

    // Calculate total duration
    const redStart = cycle.phaseTimestamps.red;
    if (redStart) {
      cycle.phaseDurations.total = now.getTime() - redStart.getTime();
    }

    cycle.status = 'completed';
    cycle.phaseTimestamps.completed = now;

    await this.emitEvent({
      type: 'cycle-completed',
      planId,
      cycleId,
      timestamp: now,
      data: { durations: cycle.phaseDurations },
    });

    return cycle;
  }

  /**
   * Fail a cycle
   */
  async failCycle(
    cycleId: string,
    planId: string,
    error: string
  ): Promise<TDDCycle> {
    const cycle = this.cycles.get(cycleId);
    if (!cycle) {
      throw new Error(`Cycle ${cycleId} not found`);
    }

    cycle.status = 'failed';
    cycle.error = error;

    await this.emitEvent({
      type: 'plan-failed',
      planId,
      cycleId,
      timestamp: new Date(),
      data: { error },
    });

    return cycle;
  }

  /**
   * Update test results for the current cycle
   */
  async updateTestResults(
    cycleId: string,
    planId: string,
    results: TestExecutionResult[]
  ): Promise<TDDCycle> {
    const cycle = this.cycles.get(cycleId);
    if (!cycle) {
      throw new Error(`Cycle ${cycleId} not found`);
    }

    const allPassed = results.every(r => r.passed);
    cycle.testsPassing = allPassed;

    // Emit appropriate events
    for (const result of results) {
      await this.emitEvent({
        type: result.passed ? 'test-completed' : 'test-failed',
        planId,
        cycleId,
        testId: result.testId,
        timestamp: result.timestamp,
        data: { duration: result.duration, output: result.output },
      });
    }

    return cycle;
  }

  /**
   * Get all cycles
   */
  getAllCycles(): TDDCycle[] {
    return Array.from(this.cycles.values());
  }

  /**
   * Get cycles by status
   */
  getCyclesByStatus(status: TDDCycleStatus): TDDCycle[] {
    return this.getAllCycles().filter(c => c.status === status);
  }

  /**
   * Get cycle statistics
   */
  getCycleStatistics(): CycleStatistics {
    const cycles = this.getAllCycles().filter(c => c.status === 'completed');

    if (cycles.length === 0) {
      return {
        totalCycles: 0,
        averageDuration: 0,
        totalRedTime: 0,
        totalGreenTime: 0,
        totalRefactorTime: 0,
        fastestCycle: 0,
        slowestCycle: 0,
        averageRedTime: 0,
        averageGreenTime: 0,
        averageRefactorTime: 0,
      };
    }

    const durations = cycles.map(c => c.phaseDurations.total);
    const redTimes = cycles.map(c => c.phaseDurations.red);
    const greenTimes = cycles.map(c => c.phaseDurations.green);
    const refactorTimes = cycles.map(c => c.phaseDurations.refactor);

    return {
      totalCycles: cycles.length,
      averageDuration: average(durations),
      totalRedTime: sum(redTimes),
      totalGreenTime: sum(greenTimes),
      totalRefactorTime: sum(refactorTimes),
      fastestCycle: Math.min(...durations),
      slowestCycle: Math.max(...durations),
      averageRedTime: average(redTimes),
      averageGreenTime: average(greenTimes),
      averageRefactorTime: average(refactorTimes),
    };
  }

  /**
   * Clear all cycles
   */
  clear(): void {
    this.cycles.clear();
    this.currentCycleId = undefined;
  }
}

// ============================================================================
// Re-export CycleStatistics from types
// ============================================================================

export { CycleStatistics } from './types';

// ============================================================================
// Helper Functions
// ============================================================================

function sum(numbers: number[]): number {
  return numbers.reduce((a, b) => a + b, 0);
}

function average(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return sum(numbers) / numbers.length;
}

// ============================================================================
// Cycle Validation
// ============================================================================

/**
 * Validate that a cycle can transition to a new phase
 */
export function validatePhaseTransition(
  cycle: TDDCycle,
  newPhase: TDDCyclePhase
): { valid: boolean; error?: string } {
  if (cycle.status !== 'in_progress') {
    return {
      valid: false,
      error: `Cannot transition phase: cycle is ${cycle.status}`,
    };
  }

  if (!isValidPhaseTransition(cycle.phase, newPhase)) {
    return {
      valid: false,
      error: `Invalid transition from ${cycle.phase} to ${newPhase}`,
    };
  }

  return { valid: true };
}

/**
 * Check if cycle is in a valid state
 */
export function validateCycle(cycle: TDDCycle): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!cycle.id) {
    errors.push('Cycle must have an ID');
  }

  if (cycle.number < 1) {
    errors.push('Cycle number must be >= 1');
  }

  if (!cycle.description) {
    errors.push('Cycle must have a description');
  }

  if (cycle.status === 'completed') {
    if (!cycle.phaseTimestamps.completed) {
      errors.push('Completed cycle must have completion timestamp');
    }
    if (cycle.phaseDurations.total <= 0) {
      errors.push('Completed cycle must have total duration > 0');
    }
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================================
// Cycle Factory Functions
// ============================================================================

/**
 * Create a new cycle with proper defaults
 */
export function createCycle(
  number: number,
  description: string,
  testCaseIds: string[] = []
): TDDCycle {
  const now = new Date();

  return {
    id: `cycle-${Date.now()}-${number}`,
    number,
    phase: 'red',
    status: 'pending',
    testCases: testCaseIds,
    description,
    phaseTimestamps: {},
    phaseDurations: { red: 0, green: 0, refactor: 0, total: 0 },
    testsPassing: false,
  };
}

/**
 * Clone a cycle (useful for restarting or branching)
 */
export function cloneCycle(cycle: TDDCycle, newNumber: number): TDDCycle {
  return {
    ...cycle,
    id: `cycle-${Date.now()}-${newNumber}`,
    number: newNumber,
    phase: 'red',
    status: 'pending',
    phaseTimestamps: {},
    phaseDurations: { red: 0, green: 0, refactor: 0, total: 0 },
    testsPassing: false,
    error: undefined,
  };
}
