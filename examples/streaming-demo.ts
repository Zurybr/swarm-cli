import { StreamingOutput, mockLLMStream } from '../src/utils/streaming';

/**
 * Example: Using streaming output for LLM responses
 */

async function streamingExample() {
  console.log('=== Streaming Output Example ===\n');

  // Example 1: Basic streaming
  console.log('Example 1: Basic streaming output');
  const stream = new StreamingOutput({
    enabled: true,
    onToken: (token) => {
      // Optional: custom handling per token
    },
    onComplete: (fullText) => {
      console.log('\n[Complete] Full text length:', fullText.length);
    }
  });

  stream.start();
  
  // Simulate LLM response streaming
  const response = "Hello! I'm an AI assistant. I can help you with coding, analysis, and more.";
  const tokens = response.split(' ');
  
  for (const token of tokens) {
    await new Promise(resolve => setTimeout(resolve, 100));
    stream.write(token + ' ');
  }
  
  stream.complete();

  // Example 2: With async generator (like OpenAI streaming)
  console.log('\n\nExample 2: Async generator streaming');
  const stream2 = new StreamingOutput({
    enabled: true,
    onComplete: (text) => console.log('\n[Done]')
  });

  stream2.start();
  
  const mockStream = mockLLMStream('This is a simulated LLM streaming response.', 30);
  
  for await (const token of mockStream) {
    stream2.write(token);
  }
  
  stream2.complete();
}

// Run example
if (require.main === module) {
  streamingExample().catch(console.error);
}
