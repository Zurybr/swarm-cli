/**
 * Tests for CostTracker - Issue #22.6
 * Cost Tracking and Budgets
 */

import { CostTracker, CostRecord, CostSummary, getCostTracker, resetCostTracker } from '../cost-tracker';
import { TokenUsage, ProviderName } from '../../types';

describe('CostTracker', () => {
  let tracker: CostTracker;

  beforeEach(() => {
    tracker = new CostTracker();
  });

  describe('trackRequest', () => {
    it('should track a single request with token usage', () => {
      const usage: TokenUsage = { input: 1000, output: 500, total: 1500 };
      
      const record = tracker.trackRequest({
        provider: 'anthropic',
        model: 'claude-3-sonnet-20240229',
        usage,
        agentId: 'test-agent'
      });

      expect(record.provider).toBe('anthropic');
      expect(record.model).toBe('claude-3-sonnet-20240229');
      expect(record.usage).toEqual(usage);
      expect(record.agentId).toBe('test-agent');
      expect(record.cost).toBeGreaterThan(0);
      expect(record.timestamp).toBeInstanceOf(Date);
    });

    it('should calculate cost based on model pricing', () => {
      // Claude 3 Sonnet: $0.003/1K input, $0.015/1K output
      const usage: TokenUsage = { input: 1000, output: 1000, total: 2000 };
      
      const record = tracker.trackRequest({
        provider: 'anthropic',
        model: 'claude-3-sonnet-20240229',
        usage
      });

      // Expected: (1000/1000 * 0.003) + (1000/1000 * 0.015) = 0.003 + 0.015 = 0.018
      expect(record.cost).toBeCloseTo(0.018, 4);
    });

    it('should handle different models with different pricing', () => {
      const usage: TokenUsage = { input: 1000, output: 500, total: 1500 };
      
      // GPT-4: $0.03/1K input, $0.06/1K output
      const gpt4Record = tracker.trackRequest({
        provider: 'openai',
        model: 'gpt-4',
        usage
      });

      // Expected: (1000/1000 * 0.03) + (500/1000 * 0.06) = 0.03 + 0.03 = 0.06
      expect(gpt4Record.cost).toBeCloseTo(0.06, 4);
    });

    it('should handle local models with zero cost', () => {
      const usage: TokenUsage = { input: 1000, output: 500, total: 1500 };
      
      const record = tracker.trackRequest({
        provider: 'ollama',
        model: 'llama3',
        usage
      });

      expect(record.cost).toBe(0);
    });
  });

  describe('getCostSummary', () => {
    it('should return empty summary when no requests tracked', () => {
      const summary = tracker.getCostSummary();
      
      expect(summary.totalCost).toBe(0);
      expect(summary.totalRequests).toBe(0);
      expect(summary.totalTokens.input).toBe(0);
      expect(summary.totalTokens.output).toBe(0);
    });

    it('should aggregate costs across multiple requests', () => {
      tracker.trackRequest({
        provider: 'anthropic',
        model: 'claude-3-sonnet-20240229',
        usage: { input: 1000, output: 500, total: 1500 }
      });

      tracker.trackRequest({
        provider: 'openai',
        model: 'gpt-4o',
        usage: { input: 2000, output: 1000, total: 3000 }
      });

      const summary = tracker.getCostSummary();
      
      expect(summary.totalRequests).toBe(2);
      expect(summary.totalTokens.input).toBe(3000);
      expect(summary.totalTokens.output).toBe(1500);
      expect(summary.totalCost).toBeGreaterThan(0);
    });

    it('should filter by date range', () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      // Track a request and manually set timestamp to yesterday
      const record1 = tracker.trackRequest({
        provider: 'anthropic',
        model: 'claude-3-sonnet-20240229',
        usage: { input: 1000, output: 500, total: 1500 }
      });
      // Manually set to yesterday for testing
      record1.timestamp = yesterday;

      // Track today's request
      tracker.trackRequest({
        provider: 'openai',
        model: 'gpt-4o',
        usage: { input: 2000, output: 1000, total: 3000 }
      });

      const todaySummary = tracker.getCostSummary({ 
        startDate: new Date(now.setHours(0, 0, 0, 0)) 
      });
      
      expect(todaySummary.totalRequests).toBe(1);
    });
  });

  describe('getCostsByProvider', () => {
    it('should group costs by provider', () => {
      tracker.trackRequest({
        provider: 'anthropic',
        model: 'claude-3-sonnet-20240229',
        usage: { input: 1000, output: 500, total: 1500 }
      });

      tracker.trackRequest({
        provider: 'anthropic',
        model: 'claude-3-haiku-20240307',
        usage: { input: 500, output: 250, total: 750 }
      });

      tracker.trackRequest({
        provider: 'openai',
        model: 'gpt-4o',
        usage: { input: 2000, output: 1000, total: 3000 }
      });

      const byProvider = tracker.getCostsByProvider();
      
      expect(byProvider.anthropic).toBeDefined();
      expect(byProvider.openai).toBeDefined();
      expect(byProvider.anthropic.totalRequests).toBe(2);
      expect(byProvider.openai.totalRequests).toBe(1);
    });
  });

  describe('getCostsByAgent', () => {
    it('should group costs by agent', () => {
      tracker.trackRequest({
        provider: 'anthropic',
        model: 'claude-3-sonnet-20240229',
        usage: { input: 1000, output: 500, total: 1500 },
        agentId: 'agent-1'
      });

      tracker.trackRequest({
        provider: 'anthropic',
        model: 'claude-3-sonnet-20240229',
        usage: { input: 500, output: 250, total: 750 },
        agentId: 'agent-1'
      });

      tracker.trackRequest({
        provider: 'openai',
        model: 'gpt-4o',
        usage: { input: 2000, output: 1000, total: 3000 },
        agentId: 'agent-2'
      });

      const byAgent = tracker.getCostsByAgent();
      
      expect(byAgent['agent-1']).toBeDefined();
      expect(byAgent['agent-2']).toBeDefined();
      expect(byAgent['agent-1'].totalRequests).toBe(2);
      expect(byAgent['agent-2'].totalRequests).toBe(1);
    });
  });

  describe('getTodayCosts', () => {
    it('should return costs for today only', () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const record1 = tracker.trackRequest({
        provider: 'anthropic',
        model: 'claude-3-sonnet-20240229',
        usage: { input: 1000, output: 500, total: 1500 }
      });
      record1.timestamp = yesterday;

      tracker.trackRequest({
        provider: 'openai',
        model: 'gpt-4o',
        usage: { input: 2000, output: 1000, total: 3000 }
      });

      const todayCosts = tracker.getTodayCosts();
      
      expect(todayCosts.totalRequests).toBe(1);
    });
  });

  describe('getThisMonthCosts', () => {
    it('should return costs for current month', () => {
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15);
      
      const record1 = tracker.trackRequest({
        provider: 'anthropic',
        model: 'claude-3-sonnet-20240229',
        usage: { input: 1000, output: 500, total: 1500 }
      });
      record1.timestamp = lastMonth;

      tracker.trackRequest({
        provider: 'openai',
        model: 'gpt-4o',
        usage: { input: 2000, output: 1000, total: 3000 }
      });

      const monthCosts = tracker.getThisMonthCosts();
      
      expect(monthCosts.totalRequests).toBe(1);
    });
  });

  describe('getRecords', () => {
    it('should return all records', () => {
      tracker.trackRequest({
        provider: 'anthropic',
        model: 'claude-3-sonnet-20240229',
        usage: { input: 1000, output: 500, total: 1500 }
      });

      tracker.trackRequest({
        provider: 'openai',
        model: 'gpt-4o',
        usage: { input: 2000, output: 1000, total: 3000 }
      });

      const records = tracker.getRecords();
      
      expect(records).toHaveLength(2);
    });
  });

  describe('clearRecords', () => {
    it('should clear all records', () => {
      tracker.trackRequest({
        provider: 'anthropic',
        model: 'claude-3-sonnet-20240229',
        usage: { input: 1000, output: 500, total: 1500 }
      });

      tracker.clearRecords();
      
      expect(tracker.getRecords()).toHaveLength(0);
      expect(tracker.getCostSummary().totalCost).toBe(0);
    });
  });

  describe('singleton', () => {
    it('should return the same instance', () => {
      resetCostTracker();
      const instance1 = getCostTracker();
      const instance2 = getCostTracker();
      
      expect(instance1).toBe(instance2);
      
      resetCostTracker();
    });
  });
});
