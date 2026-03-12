/**
 * Hook for Plan Execution state management
 * Provides reactive state and actions for plan execution
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Plan,
  Task,
  TaskStatus,
  PlanExecutionState,
  PlanExecutionActions,
  UsePlanExecutionReturn,
  formatDuration,
  calculateProgress,
  calculateETA,
} from '../types/plan';

/**
 * Initial state for plan execution
 */
const initialState: PlanExecutionState = {
  plan: null,
  isExecuting: false,
  isPaused: false,
  currentWave: 0,
  currentTask: null,
  lastUpdate: Date.now(),
  error: null,
};

/**
 * Hook for managing plan execution state
 * 
 * @param initialPlan - Optional initial plan to load
 * @returns Plan execution state and actions
 * 
 * @example
 * ```tsx
 * const { plan, isExecuting, start, pause, updateTaskStatus } = usePlanExecution();
 * 
 * // Set a plan
 * setPlan(myPlan);
 * 
 * // Start execution
 * start();
 * 
 * // Update task status
 * updateTaskStatus('task-1', 'completed', 135000);
 * ```
 */
export function usePlanExecution(initialPlan?: Plan): UsePlanExecutionReturn {
  const [state, setState] = useState<PlanExecutionState>({
    ...initialState,
    plan: initialPlan || null,
  });
  
  const startTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Update ETA and progress based on elapsed time
   */
  const updateTimers = useCallback(() => {
    setState(prev => {
      if (!prev.plan || !prev.isExecuting || prev.isPaused) {
        return prev;
      }

      const elapsed = startTimeRef.current 
        ? Date.now() - startTimeRef.current 
        : 0;

      const updatedPlan = {
        ...prev.plan,
        eta: calculateETA(
          prev.plan.completedTasks,
          prev.plan.totalTasks,
          elapsed
        ),
        etaFormatted: formatDuration(
          calculateETA(
            prev.plan.completedTasks,
            prev.plan.totalTasks,
            elapsed
          )
        ),
      };

      return {
        ...prev,
        plan: updatedPlan,
        lastUpdate: Date.now(),
      };
    });
  }, []);

  /**
   * Start plan execution
   */
  const start = useCallback(() => {
    setState(prev => {
      if (!prev.plan) {
        return { ...prev, error: 'No plan loaded' };
      }

      startTimeRef.current = Date.now();
      
      // Start interval for ETA updates
      intervalRef.current = setInterval(updateTimers, 1000);

      return {
        ...prev,
        isExecuting: true,
        isPaused: false,
        error: null,
        plan: {
          ...prev.plan,
          startTime: Date.now(),
        },
      };
    });
  }, [updateTimers]);

  /**
   * Pause execution
   */
  const pause = useCallback(() => {
    setState(prev => ({
      ...prev,
      isPaused: true,
    }));

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  /**
   * Resume execution
   */
  const resume = useCallback(() => {
    setState(prev => {
      if (!prev.isPaused) return prev;

      // Restart interval for ETA updates
      intervalRef.current = setInterval(updateTimers, 1000);

      return {
        ...prev,
        isPaused: false,
      };
    });
  }, [updateTimers]);

  /**
   * Cancel execution
   */
  const cancel = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    startTimeRef.current = null;

    setState(prev => ({
      ...prev,
      isExecuting: false,
      isPaused: false,
      currentTask: null,
    }));
  }, []);

  /**
   * Update task status
   */
  const updateTaskStatus = useCallback((
    taskId: string, 
    status: TaskStatus, 
    duration?: number
  ) => {
    setState(prev => {
      if (!prev.plan) return prev;

      let completedCount = 0;
      let updatedWaves = prev.plan.waves.map(wave => {
        const updatedTasks = wave.tasks.map(task => {
          if (task.id === taskId) {
            const updatedTask: Task = {
              ...task,
              status,
              duration: duration ?? task.duration,
              durationFormatted: duration 
                ? formatDuration(duration) 
                : task.durationFormatted,
            };

            // Update current task reference
            if (status === 'running') {
              return updatedTask;
            }

            return updatedTask;
          }
          return task;
        });

        // Count completed tasks
        completedCount += updatedTasks.filter(
          t => t.status === 'completed'
        ).length;

        return {
          ...wave,
          tasks: updatedTasks,
        };
      });

      // Find current running task
      let newCurrentTask: Task | null = null;
      for (const wave of updatedWaves) {
        for (const task of wave.tasks) {
          if (task.status === 'running') {
            newCurrentTask = task;
            break;
          }
        }
        if (newCurrentTask) break;
      }

      // Determine current wave
      let newCurrentWave = prev.currentWave;
      for (let i = 0; i < updatedWaves.length; i++) {
        const hasRunningOrPending = updatedWaves[i].tasks.some(
          t => t.status === 'running' || t.status === 'pending'
        );
        if (hasRunningOrPending) {
          newCurrentWave = i + 1;
          break;
        }
      }

      const updatedPlan: Plan = {
        ...prev.plan,
        waves: updatedWaves,
        completedTasks: completedCount,
        progress: calculateProgress(completedCount, prev.plan.totalTasks),
        endTime: completedCount === prev.plan.totalTasks 
          ? Date.now() 
          : undefined,
      };

      return {
        ...prev,
        plan: updatedPlan,
        currentTask: newCurrentTask,
        currentWave: newCurrentWave,
        lastUpdate: Date.now(),
      };
    });
  }, []);

  /**
   * Set the current plan
   */
  const setPlan = useCallback((plan: Plan) => {
    // Clear any existing execution
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    startTimeRef.current = null;

    // Format durations for all tasks
    const formattedPlan: Plan = {
      ...plan,
      waves: plan.waves.map(wave => ({
        ...wave,
        tasks: wave.tasks.map(task => ({
          ...task,
          durationFormatted: formatDuration(task.duration),
        })),
      })),
      etaFormatted: formatDuration(plan.eta),
    };

    setState({
      ...initialState,
      plan: formattedPlan,
    });
  }, []);

  /**
   * Reset execution state
   */
  const reset = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    startTimeRef.current = null;
    setState(initialState);
  }, []);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    ...state,
    start,
    pause,
    resume,
    cancel,
    updateTaskStatus,
    setPlan,
    reset,
  };
}

export default usePlanExecution;
