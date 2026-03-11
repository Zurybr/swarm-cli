export interface RetryOptions {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors?: string[];
  onRetry?: (attempt: number, error: Error, delayMs: number) => void;
}

export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

export class RetryError extends Error {
  constructor(
    message: string,
    public readonly attempts: number,
    public readonly lastError: Error
  ) {
    super(message);
    this.name = 'RetryError';
  }
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(
  attempt: number,
  initialDelayMs: number,
  maxDelayMs: number,
  backoffMultiplier: number
): number {
  // Exponential backoff: initialDelay * (multiplier ^ attempt)
  const exponentialDelay = initialDelayMs * Math.pow(backoffMultiplier, attempt - 1);
  
  // Cap at max delay
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs);
  
  // Add jitter (±25%) to prevent thundering herd
  const jitter = cappedDelay * 0.25 * (Math.random() * 2 - 1);
  
  return Math.max(0, cappedDelay + jitter);
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: Error, retryableErrors?: string[]): boolean {
  if (!retryableErrors || retryableErrors.length === 0) {
    return true; // Retry all errors by default
  }
  
  return retryableErrors.some(pattern => 
    error.message.includes(pattern) || 
    error.name.includes(pattern)
  );
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute a function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const config = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Check if we should retry this error
      if (!isRetryableError(lastError, config.retryableErrors)) {
        throw lastError;
      }
      
      // Don't retry on last attempt
      if (attempt === config.maxAttempts) {
        break;
      }
      
      // Calculate delay for next attempt
      const delayMs = calculateDelay(
        attempt,
        config.initialDelayMs,
        config.maxDelayMs,
        config.backoffMultiplier
      );
      
      // Call retry callback if provided
      if (config.onRetry) {
        config.onRetry(attempt, lastError, delayMs);
      }
      
      // Wait before next attempt
      await sleep(delayMs);
    }
  }
  
  throw new RetryError(
    `Failed after ${config.maxAttempts} attempts: ${lastError?.message}`,
    config.maxAttempts,
    lastError!
  );
}

/**
 * Create a retryable wrapper for a function
 */
export function createRetryable<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: Partial<RetryOptions> = {}
): T {
  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    return withRetry(() => fn(...args), options);
  }) as T;
}

/**
 * CLI retry configuration parser
 */
export function parseRetryOptions(flags: {
  retryAttempts?: string;
  retryDelay?: string;
  retryMaxDelay?: string;
  retryMultiplier?: string;
}): Partial<RetryOptions> {
  const options: Partial<RetryOptions> = {};
  
  if (flags.retryAttempts) {
    const attempts = parseInt(flags.retryAttempts, 10);
    if (!isNaN(attempts) && attempts > 0) {
      options.maxAttempts = attempts;
    }
  }
  
  if (flags.retryDelay) {
    const delay = parseInt(flags.retryDelay, 10);
    if (!isNaN(delay) && delay > 0) {
      options.initialDelayMs = delay;
    }
  }
  
  if (flags.retryMaxDelay) {
    const maxDelay = parseInt(flags.retryMaxDelay, 10);
    if (!isNaN(maxDelay) && maxDelay > 0) {
      options.maxDelayMs = maxDelay;
    }
  }
  
  if (flags.retryMultiplier) {
    const multiplier = parseFloat(flags.retryMultiplier);
    if (!isNaN(multiplier) && multiplier > 1) {
      options.backoffMultiplier = multiplier;
    }
  }
  
  return options;
}
