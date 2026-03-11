import { withRetry, RetryOptions, DEFAULT_RETRY_OPTIONS } from '../utils/retry';

/**
 * Example: Using retry with agent operations
 */

// Example 1: Basic retry with default options
async function basicExample() {
  const result = await withRetry(
    async () => {
      // Simulate an API call that might fail
      const response = await fetch('https://api.example.com/data');
      if (!response.ok) throw new Error('API request failed');
      return response.json();
    },
    DEFAULT_RETRY_OPTIONS
  );
  return result;
}

// Example 2: Custom retry configuration
async function customRetryExample() {
  const result = await withRetry(
    async () => {
      // Agent operation that might fail
      return await executeAgentTask('complex-analysis');
    },
    {
      maxAttempts: 5,
      initialDelayMs: 500,
      maxDelayMs: 10000,
      backoffMultiplier: 1.5,
      retryableErrors: ['ETIMEDOUT', 'ECONNRESET', 'rate limit'],
      onRetry: (attempt, error, delayMs) => {
        console.log(`Retry ${attempt}: ${error.message} (waiting ${delayMs}ms)`);
      }
    }
  );
  return result;
}

// Example 3: Using with CLI flags
async function cliExample(retryFlags: {
  retryAttempts?: string;
  retryDelay?: string;
  retryMaxDelay?: string;
  retryMultiplier?: string;
}) {
  const { parseRetryOptions } = await import('../utils/retry');
  const retryOptions = parseRetryOptions(retryFlags);
  
  const result = await withRetry(
    async () => await runAgentOperation(),
    retryOptions
  );
  return result;
}

// Mock functions for examples
async function executeAgentTask(task: string): Promise<any> {
  // Implementation
  return { task, status: 'completed' };
}

async function runAgentOperation(): Promise<any> {
  // Implementation
  return { status: 'success' };
}

// Example usage with CLI
if (require.main === module) {
  // Run examples
  console.log('Retry system examples');
  console.log('Usage:');
  console.log('  swarm-cli command --retry-attempts 5 --retry-delay 500');
}
