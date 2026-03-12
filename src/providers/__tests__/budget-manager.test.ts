/**
 * Tests for BudgetManager - Issue #22.6
 * Cost Tracking and Budgets
 */

import { 
  BudgetManager, 
  BudgetConfig, 
  BudgetStatus, 
  BudgetAlert,
  getBudgetManager,
  resetBudgetManager 
} from '../budget-manager';
import { getCostTracker, resetCostTracker, CostRecord } from '../cost-tracker';

describe('BudgetManager', () => {
  let budgetManager: BudgetManager;
  let costTracker: ReturnType<typeof getCostTracker>;

  const defaultConfig: BudgetConfig = {
    daily: 10.00,
    monthly: 100.00,
    alerts: [
      { at: '80%', action: 'notify' },
      { at: '100%', action: 'block' }
    ]
  };

  beforeEach(() => {
    resetCostTracker();
    resetBudgetManager();
    costTracker = getCostTracker();
    budgetManager = new BudgetManager(defaultConfig);
  });

  describe('constructor', () => {
    it('should initialize with config', () => {
      expect(budgetManager.getConfig()).toEqual(defaultConfig);
    });

    it('should use default config if not provided', () => {
      const manager = new BudgetManager();
      const config = manager.getConfig();
      
      expect(config.daily).toBeUndefined();
      expect(config.monthly).toBeUndefined();
      expect(config.alerts).toEqual([]);
    });
  });

  describe('getStatus', () => {
    it('should return budget status with no spending', () => {
      const status = budgetManager.getStatus();
      
      expect(status.dailySpent).toBe(0);
      expect(status.monthlySpent).toBe(0);
      expect(status.dailyRemaining).toBe(defaultConfig.daily);
      expect(status.monthlyRemaining).toBe(defaultConfig.monthly);
      expect(status.dailyPercentage).toBe(0);
      expect(status.monthlyPercentage).toBe(0);
      expect(status.isBlocked).toBe(false);
    });

    it('should calculate spending based on tracked costs', () => {
      // Track some costs
      costTracker.trackRequest({
        provider: 'anthropic',
        model: 'claude-3-sonnet-20240229',
        usage: { input: 1000, output: 500, total: 1500 } // ~$0.018
      });

      const status = budgetManager.getStatus();
      
      expect(status.dailySpent).toBeGreaterThan(0);
      expect(status.monthlySpent).toBeGreaterThan(0);
    });
  });

  describe('checkBudget', () => {
    it('should return allowed when under budget', () => {
      const result = budgetManager.checkBudget(0.01);
      
      expect(result.allowed).toBe(true);
      expect(result.alerts).toHaveLength(0);
    });

    it('should trigger notify alert at 80%', () => {
      // Set daily budget to $0.10 for easier testing
      budgetManager.configure({ daily: 0.10 });
      
      // Track spending that puts us at ~85% (triggers 80% alert but not 100%)
      // Claude 3 Sonnet: $0.003/1K input, $0.015/1K output
      // For 0.085 cost: 10000 input + 3666 output ≈ 0.085 (85% of 0.10)
      costTracker.trackRequest({
        provider: 'anthropic',
        model: 'claude-3-sonnet-20240229',
        usage: { input: 10000, output: 3666, total: 13666 } // ~0.085 which is 85%
      });

      // Check with a small cost that keeps us under 100%
      const result = budgetManager.checkBudget(0.005); // 5% more = 90%
      
      expect(result.allowed).toBe(true);
      // We should have a warning level alert (>=80% but <100%)
      expect(result.alerts.some((a: BudgetAlert) => a.level === 'warning')).toBe(true);
    });

    it('should block at 100%', () => {
      budgetManager.configure({ daily: 0.01 }); // Very small budget
      
      // Check if a $1 request is allowed
      const result = budgetManager.checkBudget(1.00);
      
      expect(result.allowed).toBe(false);
      expect(result.alerts.some((a: BudgetAlert) => a.level === 'critical')).toBe(true);
    });
  });

  describe('configure', () => {
    it('should update budget configuration', () => {
      budgetManager.configure({ daily: 50.00, monthly: 500.00 });
      
      const config = budgetManager.getConfig();
      expect(config.daily).toBe(50.00);
      expect(config.monthly).toBe(500.00);
    });

    it('should merge with existing config', () => {
      budgetManager.configure({ daily: 50.00 });
      
      const config = budgetManager.getConfig();
      expect(config.daily).toBe(50.00);
      expect(config.monthly).toBe(defaultConfig.monthly);
    });
  });

  describe('setAlertHandler', () => {
    it('should call alert handler when alert is triggered', () => {
      const alertHandler = jest.fn();
      budgetManager.setAlertHandler(alertHandler);
      
      budgetManager.configure({ daily: 0.01 });
      budgetManager.checkBudget(1.00);
      
      expect(alertHandler).toHaveBeenCalled();
      const alert = alertHandler.mock.calls[0][0] as BudgetAlert;
      expect(alert.level).toBe('critical');
    });
  });

  describe('resetDailyBudget', () => {
    it('should reset daily spending tracking', () => {
      costTracker.trackRequest({
        provider: 'anthropic',
        model: 'claude-3-sonnet-20240229',
        usage: { input: 1000, output: 500, total: 1500 }
      });

      let status = budgetManager.getStatus();
      expect(status.dailySpent).toBeGreaterThan(0);

      budgetManager.resetDailyBudget();
      
      // After reset, daily spent should be 0 (but monthly should remain)
      status = budgetManager.getStatus();
      expect(status.dailySpent).toBe(0);
    });
  });

  describe('resetMonthlyBudget', () => {
    it('should reset monthly spending tracking', () => {
      costTracker.trackRequest({
        provider: 'anthropic',
        model: 'claude-3-sonnet-20240229',
        usage: { input: 1000, output: 500, total: 1500 }
      });

      let status = budgetManager.getStatus();
      expect(status.monthlySpent).toBeGreaterThan(0);

      budgetManager.resetMonthlyBudget();
      
      status = budgetManager.getStatus();
      expect(status.monthlySpent).toBe(0);
    });
  });

  describe('getDailyProgress', () => {
    it('should return daily budget progress', () => {
      budgetManager.configure({ daily: 10.00 });
      
      const progress = budgetManager.getDailyProgress();
      
      expect(progress.budget).toBe(10.00);
      expect(progress.spent).toBe(0);
      expect(progress.remaining).toBe(10.00);
      expect(progress.percentage).toBe(0);
    });
  });

  describe('getMonthlyProgress', () => {
    it('should return monthly budget progress', () => {
      budgetManager.configure({ monthly: 100.00 });
      
      const progress = budgetManager.getMonthlyProgress();
      
      expect(progress.budget).toBe(100.00);
      expect(progress.spent).toBe(0);
      expect(progress.remaining).toBe(100.00);
      expect(progress.percentage).toBe(0);
    });
  });

  describe('singleton', () => {
    it('should return the same instance', () => {
      resetBudgetManager();
      const instance1 = getBudgetManager();
      const instance2 = getBudgetManager();
      
      expect(instance1).toBe(instance2);
      
      resetBudgetManager();
    });

    it('should initialize with config', () => {
      resetBudgetManager();
      const manager = getBudgetManager(defaultConfig);
      
      expect(manager.getConfig()).toEqual(defaultConfig);
      
      resetBudgetManager();
    });
  });
});
