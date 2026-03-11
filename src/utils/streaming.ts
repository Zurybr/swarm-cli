import { Readable } from 'stream';

export interface StreamingOptions {
  enabled: boolean;
  onToken?: (token: string) => void;
  onComplete?: (fullText: string) => void;
  onError?: (error: Error) => void;
}

export class StreamingOutput {
  private buffer: string = '';
  private isStreaming: boolean = false;
  private options: StreamingOptions;

  constructor(options: StreamingOptions) {
    this.options = options;
  }

  /**
   * Start streaming output
   */
  start(): void {
    if (this.options.enabled) {
      this.isStreaming = true;
      this.buffer = '';
      process.stdout.write(''); // Initialize stdout
    }
  }

  /**
   * Write a token/chunk to the stream
   */
  write(token: string): void {
    if (!this.isStreaming || !this.options.enabled) {
      return;
    }

    this.buffer += token;
    
    // Write token immediately to stdout
    process.stdout.write(token);
    
    // Call callback if provided
    if (this.options.onToken) {
      this.options.onToken(token);
    }
  }

  /**
   * Complete the stream
   */
  complete(): void {
    if (!this.isStreaming) {
      return;
    }

    this.isStreaming = false;
    
    // Add newline at the end
    process.stdout.write('\n');
    
    // Call completion callback
    if (this.options.onComplete) {
      this.options.onComplete(this.buffer);
    }
  }

  /**
   * Handle error in stream
   */
  error(err: Error): void {
    this.isStreaming = false;
    
    if (this.options.onError) {
      this.options.onError(err);
    } else {
      console.error('\n[Streaming Error]:', err.message);
    }
  }

  /**
   * Get full buffered content
   */
  getBuffer(): string {
    return this.buffer;
  }

  /**
   * Check if currently streaming
   */
  isActive(): boolean {
    return this.isStreaming;
  }
}

/**
 * Create a readable stream from async generator
 */
export function createTokenStream(
  generator: AsyncGenerator<string, void, unknown>
): Readable {
  const stream = new Readable({
    objectMode: true,
    read() {}
  });

  (async () => {
    try {
      for await (const token of generator) {
        stream.push(token);
      }
      stream.push(null);
    } catch (error) {
      stream.destroy(error as Error);
    }
  })();

  return stream;
}

/**
 * Mock LLM streaming for testing/demo
 */
export async function* mockLLMStream(
  text: string,
  delayMs: number = 50
): AsyncGenerator<string, void, unknown> {
  const tokens = text.split('');
  
  for (const token of tokens) {
    await new Promise(resolve => setTimeout(resolve, delayMs));
    yield token;
  }
}

/**
 * Parse streaming CLI flag
 */
export function parseStreamingFlag(flags: { streamingOn?: boolean; streaming?: boolean }): boolean {
  return flags.streamingOn === true || flags.streaming === true;
}
