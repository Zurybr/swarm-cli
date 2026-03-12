/**
 * BudgetManager - Issue #22.6
 * Manage daily/monthly budgets with alerts
 */

import { getCostTracker, CostTracker } from './cost-tracker';

/**
 * Budget alert configuration
 */
export interface BudgetAlertConfig {
  at: string;  // e.g., "80%", "100%"
  action: 'notify' | 'block' | 'warn';
}

/**
 * Budget configuration
 */
export interface BudgetConfig {
  daily?: number;
  monthly?: number;
  alerts?: BudgetAlertConfig[];
}

/**
 * Budget status
 */
export interface BudgetStatus {
  dailyBudget?: number;
  monthlyBudget?: number;
  dailySpent: number;
  monthlySpent: number;
  dailyRemaining: number;
  monthlyRemaining: number;
  dailyPercentage: number;
  monthlyPercentage: number;
  isBlocked: boolean;
  alerts: BudgetAlert[];
}

/**
 * Budget alert
 */
export interface BudgetAlert {
  level: 'info' | 'warning' | 'critical';
  type: 'daily' | 'monthly';
  message: string;
  percentage: number;
  action: 'notify' | 'block' | 'warn';
}

/**
 * Budget progress
 */
export interface BudgetProgress {
  budget: number;
  spent: number;
  remaining: number;
  percentage: number;
}

/**
 * Result of checking budget for a request
 */
export interface BudgetCheckResult {
  allowed: boolean;
  alerts: BudgetAlert[];
  projectedDailyCost?: number;
  projectedMonthlyCost?: number;
}

/**
 * Alert handler function type
 */
export type AlertHandler = (alert: BudgetAlert) => void;

/**
 * Parse percentage string to number (e.g., "80%" -> 80)
 */
function parsePercentage(value: string): number {
  const match = value.match(/^(\d+(?:\.\d+)?)%?$/);
  if (!match) {
    return 0;
  }
  return parseFloat(match[1]);
}

/**
 * BudgetManager class
 * 
 * Manages budget limits and triggers alerts when thresholds are reached.
 * Integrates with CostTracker to monitor spending.
 */
export class BudgetManager {
  private config: BudgetConfig;
  private costTracker: CostTracker;
  private alertHandler?: AlertHandler;
  private dailyResetDate: Date;
  private monthlyResetDate: Date;

  constructor(config: BudgetConfig = {}) {
    this.config = {
      daily: config.daily,
      monthly: config.monthly,
      alerts: config.alerts || []
    };
    this.costTracker = getCostTracker();
    
    // Initialize reset dates
    const now = new Date();
    this.dailyResetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    this.monthlyResetDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  /**
   * Get current budget configuration
   */
  getConfig(): BudgetConfig {
    return { ...this.config };
  }

  /**
   * Update budget configuration
   */
  configure(config: Partial<BudgetConfig>): void {
    this.config = {
      ...this.config,
      ...config
    };
  }

  /**
   * Get current budget status
   */
  getStatus(): BudgetStatus {
    const todayCosts = this.costTracker.getTodayCosts();
    const monthCosts = this.costTracker.getThisMonthCosts();
    
    const dailySpent = todayCosts.totalCost;
    const monthlySpent = monthCosts.totalCost;
    
    const dailyRemaining = this.config.daily !== undefined 
      ? Math.max(0, this.config.daily - dailySpent) 
      : Infinity;
    const monthlyRemaining = this.config.monthly !== undefined 
      ? Math.max(0, this.config.monthly - monthlySpent) 
      : Infinity;
    
    const dailyPercentage = this.config.daily !== undefined 
      ? (dailySpent / this.config.daily) * 100 
      : 0;
    const monthlyPercentage = this.config.monthly !== undefined 
      ? (monthlySpent / this.config.monthly) * 100 
      : 0;

    const alerts = this.checkAlertThresholds(dailyPercentage, monthlyPercentage);
    const isBlocked = alerts.some(a => a.action === 'block');

    return {
      dailyBudget: this.config.daily,
      monthlyBudget: this.config.monthly,
      dailySpent,
      monthlySpent,
      dailyRemaining,
      monthlyRemaining,
      dailyPercentage,
      monthlyPercentage,
      isBlocked,
      alerts
    };
  }

  /**
   * Check if a request with estimated cost is allowed
   */
  checkBudget(estimatedCost: number): BudgetCheckResult {
    const status = this.getStatus();
    const alerts: BudgetAlert[] = [];
    
    // Calculate projected costs
    const projectedDailyCost = status.dailySpent + estimatedCost;
    const projectedMonthlyCost = status.monthlySpent + estimatedCost;
    
    let allowed = true;

    // Check daily budget
    if (this.config.daily !== undefined) {
      const projectedDailyPercentage = (projectedDailyCost / this.config.daily) * 100;
      
      const dailyAlerts = this.checkAlertThresholds(projectedDailyPercentage, status.monthlyPercentage, 'daily');
      alerts.push(...dailyAlerts);
      
      // Check if any alert action is 'block'
      if (dailyAlerts.some(a => a.action === 'block')) {
        allowed = false;
      }
    }

    // Check monthly budget
    if (this.config.monthly !== undefined && allowed) {
      const projectedMonthlyPercentage = (projectedMonthlyCost / this.config.monthly) * 100;
      
      const monthlyAlerts = this.checkAlertThresholds(status.dailyPercentage, projectedMonthlyPercentage, 'monthly');
      alerts.push(...monthlyAlerts);
      
      if (monthlyAlerts.some(a => a.action === 'block')) {
        allowed = false;
      }
    }

    // Trigger alert handler for new alerts
    if (this.alertHandler) {
      for (const alert of alerts) {
        this.alertHandler(alert);
      }
    }

    return {
      allowed,
      alerts,
      projectedDailyCost,
      projectedMonthlyCost
    };
  }

  /**
   * Set alert handler
   */
  setAlertHandler(handler: AlertHandler): void {
    this.alertHandler = handler;
  }

  /**
   * Get daily budget progress
   */
  getDailyProgress(): BudgetProgress {
    const status = this.getStatus();
    return {
      budget: this.config.daily || 0,
      spent: status.dailySpent,
      remaining: status.dailyRemaining,
      percentage: status.dailyPercentage
    };
  }

  /**
   * Get monthly budget progress
   */
  getMonthlyProgress(): BudgetProgress {
    const status = this.getStatus();
    return {
      budget: this.config.monthly || 0,
      spent: status.monthlySpent,
      remaining: status.monthlyRemaining,
      percentage: status.monthlyPercentage
    };
  }

  /**
   * Reset daily budget tracking (call at start of new day)
   * Clears all tracked records to reset spending calculations
   */
  resetDailyBudget(): void {
    const now = new Date();
    this.dailyResetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Clear all tracked records to reset spending
    this.costTracker.clearRecords();
  }

  /**
   * Reset monthly budget tracking (call at start of new month)
   * Clears all tracked records to reset spending calculations
   */
  resetMonthlyBudget(): void {
    const now = new Date();
    this.monthlyResetDate = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Clear all tracked records to reset spending
    this.costTracker.clearRecords();
  }

  /**
   * Check alert thresholds and return triggered alerts
   */
  private checkAlertThresholds(
    dailyPercentage: number, 
    monthlyPercentage: number,
    forceType?: 'daily' | 'monthly'
  ): BudgetAlert[] {
    const alerts: BudgetAlert[] = [];

    if (!this.config.alerts) {
      return alerts;
    }

    for (const alertConfig of this.config.alerts) {
      const threshold = parsePercentage(alertConfig.at);

      // Check daily threshold
      if ((forceType === undefined || forceType === 'daily') && this.config.daily !== undefined) {
        if (dailyPercentage >= threshold) {
          alerts.push({
            level: this.getAlertLevel(dailyPercentage),
            type: 'daily',
            message: `Daily budget ${threshold}% reached (${dailyPercentage.toFixed(1)}% used)`,
            percentage: dailyPercentage,
            action: alertConfig.action
          });
        }
      }

      // Check monthly threshold
      if ((forceType === undefined || forceType === 'monthly') && this.config.monthly !== undefined) {
        if (monthlyPercentage >= threshold) {
          alerts.push({
            level: this.getAlertLevel(monthlyPercentage),
            type: 'monthly',
            message: `Monthly budget ${threshold}% reached (${monthlyPercentage.toFixed(1)}% used)`,
            percentage: monthlyPercentage,
            action: alertConfig.action
          });
        }
      }
    }

    return alerts;
  }

  /**
   * Determine alert level based on actual percentage
   */
  private getAlertLevel(percentage: number): 'info' | 'warning' | 'critical' {
    if (percentage >= 100) {
      return 'critical';
    }
    if (percentage >= 80) {
      return 'warning';
    }
    return 'info';
  }
}

// Singleton instance
let managerInstance: BudgetManager | null = null;

/**
 * Get the singleton budget manager instance
 */
export function getBudgetManager(config?: BudgetConfig): BudgetManager {
  if (!managerInstance) {
    managerInstance = new BudgetManager(config);
  } else if (config) {
    managerInstance.configure(config);
  }
  return managerInstance;
}

/**
 * Reset the singleton (useful for testing)
 */
export function resetBudgetManager(): void {
  managerInstance = null;
}
