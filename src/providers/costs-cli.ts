/**
 * Cost Reporting CLI Commands - Issue #22.6
 * Provides `swarm costs` commands for viewing cost information
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { getCostTracker, resetCostTracker, AgentCostSummary, ProviderCostSummary } from './cost-tracker';
import { getBudgetManager, resetBudgetManager } from './budget-manager';

/**
 * Format currency for display
 */
function formatCurrency(amount: number): string {
  return `$${amount.toFixed(4)}`;
}

/**
 * Format percentage for display
 */
function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

/**
 * Format tokens for display (with K/M suffix)
 */
function formatTokens(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(2)}M`;
  }
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K`;
  }
  return tokens.toString();
}

/**
 * Create the costs command
 */
export function createCostsCommand(): Command {
  const costs = new Command('costs')
    .description('View cost tracking and budget information')
    .option('--today', 'Show costs for today only')
    .option('--this-month', 'Show costs for this month')
    .option('--by-agent', 'Group costs by agent')
    .option('--by-provider', 'Group costs by provider')
    .option('--budget', 'Show budget status')
    .option('--reset', 'Reset cost tracking data')
    .action((options) => {
      const costTracker = getCostTracker();
      const budgetManager = getBudgetManager();

      if (options.reset) {
        resetCostTracker();
        resetBudgetManager();
        console.log(chalk.green('✓ Cost tracking data has been reset'));
        return;
      }

      if (options.budget) {
        showBudgetStatus(budgetManager);
        return;
      }

      if (options.byAgent) {
        showCostsByAgent(costTracker, options);
        return;
      }

      if (options.byProvider) {
        showCostsByProvider(costTracker, options);
        return;
      }

      if (options.today) {
        showTodayCosts(costTracker);
        return;
      }

      if (options.thisMonth) {
        showMonthlyCosts(costTracker);
        return;
      }

      // Default: show overall summary
      showOverallSummary(costTracker, budgetManager);
    });

  return costs;
}

/**
 * Show overall cost summary with budget info
 */
function showOverallSummary(costTracker: ReturnType<typeof getCostTracker>, budgetManager: ReturnType<typeof getBudgetManager>): void {
  console.log(chalk.bold('\n💰 Swarm CLI - Cost Summary\n'));

  // Get summaries
  const todaySummary = costTracker.getTodayCosts();
  const monthSummary = costTracker.getThisMonthCosts();
  const budgetStatus = budgetManager.getStatus();

  // Today's costs
  console.log(chalk.cyan('📅 Today'));
  console.log(`   Spent: ${formatCurrency(todaySummary.totalCost)}`);
  console.log(`   Requests: ${todaySummary.totalRequests}`);
  console.log(`   Tokens: ${formatTokens(todaySummary.totalTokens.input)} input / ${formatTokens(todaySummary.totalTokens.output)} output`);
  console.log();

  // This month
  console.log(chalk.cyan('📆 This Month'));
  console.log(`   Spent: ${formatCurrency(monthSummary.totalCost)}`);
  console.log(`   Requests: ${monthSummary.totalRequests}`);
  console.log(`   Tokens: ${formatTokens(monthSummary.totalTokens.input)} input / ${formatTokens(monthSummary.totalTokens.output)} output`);
  console.log();

  // Budget status
  if (budgetStatus.dailyBudget !== undefined || budgetStatus.monthlyBudget !== undefined) {
    console.log(chalk.cyan('🎯 Budget Status'));
    
    if (budgetStatus.dailyBudget !== undefined) {
      const dailyColor = budgetStatus.dailyPercentage >= 100 ? chalk.red :
                         budgetStatus.dailyPercentage >= 80 ? chalk.yellow : chalk.green;
      console.log(`   Daily: ${dailyColor(formatCurrency(budgetStatus.dailySpent) + ' / ' + formatCurrency(budgetStatus.dailyBudget))} (${formatPercentage(budgetStatus.dailyPercentage)})`);
    }
    
    if (budgetStatus.monthlyBudget !== undefined) {
      const monthlyColor = budgetStatus.monthlyPercentage >= 100 ? chalk.red :
                           budgetStatus.monthlyPercentage >= 80 ? chalk.yellow : chalk.green;
      console.log(`   Monthly: ${monthlyColor(formatCurrency(budgetStatus.monthlySpent) + ' / ' + formatCurrency(budgetStatus.monthlyBudget))} (${formatPercentage(budgetStatus.monthlyPercentage)})`);
    }

    if (budgetStatus.isBlocked) {
      console.log(chalk.red.bold('   ⚠️  Budget limit reached - requests are blocked'));
    }
    console.log();
  }

  // Show alerts
  if (budgetStatus.alerts.length > 0) {
    console.log(chalk.cyan('🔔 Alerts'));
    for (const alert of budgetStatus.alerts) {
      const color = alert.level === 'critical' ? chalk.red :
                    alert.level === 'warning' ? chalk.yellow : chalk.blue;
      console.log(`   ${color('•')} ${alert.message}`);
    }
    console.log();
  }
}

/**
 * Show today's costs in detail
 */
function showTodayCosts(costTracker: ReturnType<typeof getCostTracker>): void {
  console.log(chalk.bold('\n💰 Today\'s Costs\n'));

  const summary = costTracker.getTodayCosts();
  const byProvider = costTracker.getCostsByProvider({ 
    startDate: new Date(new Date().setHours(0, 0, 0, 0)) 
  });

  console.log(`Total: ${formatCurrency(summary.totalCost)}`);
  console.log(`Requests: ${summary.totalRequests}`);
  console.log(`Tokens: ${formatTokens(summary.totalTokens.input)} input / ${formatTokens(summary.totalTokens.output)} output`);
  console.log();

  if (Object.keys(byProvider).length > 0) {
    showProviderTable(byProvider);
  } else {
    console.log(chalk.gray('No costs recorded today'));
  }
}

/**
 * Show this month's costs in detail
 */
function showMonthlyCosts(costTracker: ReturnType<typeof getCostTracker>): void {
  console.log(chalk.bold('\n💰 This Month\'s Costs\n'));

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  const summary = costTracker.getCostSummary({ startDate: startOfMonth });
  const byProvider = costTracker.getCostsByProvider({ startDate: startOfMonth });

  console.log(`Total: ${formatCurrency(summary.totalCost)}`);
  console.log(`Requests: ${summary.totalRequests}`);
  console.log(`Tokens: ${formatTokens(summary.totalTokens.input)} input / ${formatTokens(summary.totalTokens.output)} output`);
  console.log();

  if (Object.keys(byProvider).length > 0) {
    showProviderTable(byProvider);
  } else {
    console.log(chalk.gray('No costs recorded this month'));
  }
}

/**
 * Show costs grouped by provider
 */
function showCostsByProvider(costTracker: ReturnType<typeof getCostTracker>, options: { today?: boolean; thisMonth?: boolean }): void {
  console.log(chalk.bold('\n💰 Costs by Provider\n'));

  let byProvider: Record<string, ProviderCostSummary>;
  if (options.today) {
    byProvider = costTracker.getCostsByProvider({ 
      startDate: new Date(new Date().setHours(0, 0, 0, 0)) 
    });
  } else if (options.thisMonth) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    byProvider = costTracker.getCostsByProvider({ startDate: startOfMonth });
  } else {
    byProvider = costTracker.getCostsByProvider();
  }

  if (Object.keys(byProvider).length > 0) {
    showProviderTable(byProvider);
  } else {
    console.log(chalk.gray('No costs recorded'));
  }
}

/**
 * Show costs grouped by agent
 */
function showCostsByAgent(costTracker: ReturnType<typeof getCostTracker>, options: { today?: boolean; thisMonth?: boolean }): void {
  console.log(chalk.bold('\n💰 Costs by Agent\n'));

  let byAgent: Record<string, AgentCostSummary>;
  if (options.today) {
    byAgent = costTracker.getCostsByAgent({ 
      startDate: new Date(new Date().setHours(0, 0, 0, 0)) 
    });
  } else if (options.thisMonth) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    byAgent = costTracker.getCostsByAgent({ startDate: startOfMonth });
  } else {
    byAgent = costTracker.getCostsByAgent();
  }

  if (Object.keys(byAgent).length > 0) {
    const tableData = Object.values(byAgent)
      .sort((a, b) => b.totalCost - a.totalCost)
      .map((agent) => ({
        Agent: agent.agentId,
        Cost: formatCurrency(agent.totalCost),
        Requests: agent.totalRequests.toString(),
        'Input Tokens': formatTokens(agent.totalTokens.input),
        'Output Tokens': formatTokens(agent.totalTokens.output)
      }));

    console.table(tableData);
  } else {
    console.log(chalk.gray('No costs recorded'));
  }
}

/**
 * Show budget status
 */
function showBudgetStatus(budgetManager: ReturnType<typeof getBudgetManager>): void {
  console.log(chalk.bold('\n🎯 Budget Status\n'));

  const status = budgetManager.getStatus();
  const config = budgetManager.getConfig();

  // Daily budget
  if (status.dailyBudget !== undefined) {
    console.log(chalk.cyan('📅 Daily Budget'));
    console.log(`   Budget: ${formatCurrency(status.dailyBudget)}`);
    console.log(`   Spent: ${formatCurrency(status.dailySpent)}`);
    console.log(`   Remaining: ${formatCurrency(status.dailyRemaining)}`);
    
    const progressColor = status.dailyPercentage >= 100 ? chalk.red :
                          status.dailyPercentage >= 80 ? chalk.yellow : chalk.green;
    console.log(`   Progress: ${progressColor(formatPercentage(status.dailyPercentage))}`);
    console.log();
  }

  // Monthly budget
  if (status.monthlyBudget !== undefined) {
    console.log(chalk.cyan('📆 Monthly Budget'));
    console.log(`   Budget: ${formatCurrency(status.monthlyBudget)}`);
    console.log(`   Spent: ${formatCurrency(status.monthlySpent)}`);
    console.log(`   Remaining: ${formatCurrency(status.monthlyRemaining)}`);
    
    const progressColor = status.monthlyPercentage >= 100 ? chalk.red :
                          status.monthlyPercentage >= 80 ? chalk.yellow : chalk.green;
    console.log(`   Progress: ${progressColor(formatPercentage(status.monthlyPercentage))}`);
    console.log();
  }

  // Alerts configuration
  if (config.alerts && config.alerts.length > 0) {
    console.log(chalk.cyan('🔔 Alert Configuration'));
    for (const alert of config.alerts) {
      console.log(`   At ${alert.at}: ${alert.action}`);
    }
    console.log();
  }

  // Current alerts
  if (status.alerts.length > 0) {
    console.log(chalk.cyan('⚠️  Active Alerts'));
    for (const alert of status.alerts) {
      const color = alert.level === 'critical' ? chalk.red :
                    alert.level === 'warning' ? chalk.yellow : chalk.blue;
      console.log(`   ${color('•')} ${alert.message}`);
    }
    console.log();
  }

  // Blocked status
  if (status.isBlocked) {
    console.log(chalk.red.bold('⛔ Budget limit reached - new requests are blocked'));
    console.log();
  }
}

/**
 * Show provider costs in a table
 */
function showProviderTable(byProvider: Record<string, ProviderCostSummary>): void {
  const tableData: Array<{
    Provider: string;
    Model: string;
    Cost: string;
    Requests: string;
    Tokens: string;
  }> = [];

  for (const [provider, data] of Object.entries(byProvider)) {
    // Add provider total row
    tableData.push({
      Provider: provider,
      Model: '(all models)',
      Cost: formatCurrency(data.totalCost),
      Requests: data.totalRequests.toString(),
      Tokens: `${formatTokens(data.totalTokens.input)} / ${formatTokens(data.totalTokens.output)}`
    });

    // Add individual model rows
    for (const [model, modelData] of Object.entries(data.models)) {
      tableData.push({
        Provider: '',
        Model: model,
        Cost: formatCurrency(modelData.totalCost),
        Requests: modelData.totalRequests.toString(),
        Tokens: `${formatTokens(modelData.totalTokens.input)} / ${formatTokens(modelData.totalTokens.output)}`
      });
    }
  }

  console.table(tableData);
}

export default createCostsCommand;
