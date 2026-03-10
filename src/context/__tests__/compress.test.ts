/**
 * Context Compression Tests
 */

import {
  compressContext,
  ContextCompressor,
} from '../compress';
import {
  ContextChunk,
  CompressionConfig,
} from '../types';

describe('Context Compression', () => {
  const createTestChunk = (
    id: string,
    content: string,
    type: ContextChunk['type'] = 'code',
    tokenCount?: number
  ): ContextChunk => ({
    id,
    content,
    type,
    source: 'test.ts',
    timestamp: Date.now(),
    tokenCount: tokenCount || Math.ceil(content.length / 4),
    priority: 'medium',
  });

  describe('compressContext', () => {
    it('should compress chunks with truncate strategy', () => {
      const chunks: ContextChunk[] = [
        createTestChunk('1', 'A'.repeat(400)), // ~100 tokens
        createTestChunk('2', 'B'.repeat(400)), // ~100 tokens
      ];
      const config: CompressionConfig = {
        strategy: 'truncate',
        targetTokens: 100,
        maxTokens: 150,
        preserveCode: true,
        preserveStructure: true,
        minChunkSize: 20,
        level: 5,
      };

      const result = compressContext(chunks, config);

      expect(result.compressedTokens).toBeLessThanOrEqual(result.originalTokens);
      expect(result.chunks.length).toBeGreaterThan(0);
    });

    it('should compress chunks with summarize strategy', () => {
      const chunks: ContextChunk[] = [
        createTestChunk('1', `
function calculateSum(a: number, b: number): number {
  // This function adds two numbers together
  // It takes two parameters and returns their sum
  const result = a + b;
  console.log('Calculating sum');
  return result;
}
        `.trim()),
      ];
      const config: CompressionConfig = {
        strategy: 'summarize',
        targetTokens: 50,
        maxTokens: 100,
        preserveCode: true,
        preserveStructure: true,
        minChunkSize: 10,
        level: 5,
      };

      const result = compressContext(chunks, config);

      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.chunks[0].summarized).toBe(true);
    });

    it('should deduplicate chunks', () => {
      const chunks: ContextChunk[] = [
        createTestChunk('1', 'function test() { return 1; }'),
        createTestChunk('2', 'function test() { return 1; }'), // Duplicate
        createTestChunk('3', 'function other() { return 2; }'),
      ];
      const config: CompressionConfig = {
        strategy: 'deduplicate',
        targetTokens: 1000,
        maxTokens: 1200,
        preserveCode: true,
        preserveStructure: true,
        minChunkSize: 10,
        level: 5,
      };

      const result = compressContext(chunks, config);

      expect(result.chunks.length).toBe(2); // One duplicate removed
    });

    it('should use selective compression by default', () => {
      const chunks: ContextChunk[] = [
        createTestChunk('1', 'Short'),
        createTestChunk('2', 'A'.repeat(800)), // Large chunk
      ];
      const config: CompressionConfig = {
        strategy: 'selective',
        targetTokens: 200,
        maxTokens: 300,
        preserveCode: true,
        preserveStructure: true,
        minChunkSize: 10,
        level: 5,
      };

      const result = compressContext(chunks, config);

      expect(result.chunks.length).toBe(2);
      // Large chunk should be compressed
      const largeChunk = result.chunks.find(c => c.originalId === '2');
      expect(largeChunk?.compressedTokens).toBeLessThan(largeChunk?.originalTokens || 0);
    });

    it('should preserve small chunks', () => {
      const chunks: ContextChunk[] = [
        createTestChunk('1', 'Tiny', 'code', 10),
      ];
      const config: CompressionConfig = {
        strategy: 'selective',
        targetTokens: 100,
        maxTokens: 150,
        preserveCode: true,
        preserveStructure: true,
        minChunkSize: 50,
        level: 5,
      };

      const result = compressContext(chunks, config);

      expect(result.chunks[0].truncated).toBe(false);
      expect(result.chunks[0].summarized).toBe(false);
    });

    it('should calculate compression ratio', () => {
      const chunks: ContextChunk[] = [
        createTestChunk('1', 'A'.repeat(400)),
      ];
      const config: CompressionConfig = {
        strategy: 'truncate',
        targetTokens: 50,
        maxTokens: 100,
        preserveCode: true,
        preserveStructure: true,
        minChunkSize: 10,
        level: 5,
      };

      const result = compressContext(chunks, config);

      expect(result.compressionRatio).toBeLessThan(1);
      expect(result.compressionRatio).toBeGreaterThan(0);
    });

    it('should estimate information loss', () => {
      const chunks: ContextChunk[] = [
        createTestChunk('1', 'A'.repeat(400)),
      ];
      const config: CompressionConfig = {
        strategy: 'summarize',
        targetTokens: 50,
        maxTokens: 100,
        preserveCode: true,
        preserveStructure: true,
        minChunkSize: 10,
        level: 5,
      };

      const result = compressContext(chunks, config);

      expect(result.informationLoss).toBeGreaterThanOrEqual(0);
      expect(result.informationLoss).toBeLessThanOrEqual(1);
    });

    it('should handle empty chunks array', () => {
      const config: CompressionConfig = {
        strategy: 'selective',
        targetTokens: 100,
        maxTokens: 150,
        preserveCode: true,
        preserveStructure: true,
        minChunkSize: 10,
        level: 5,
      };

      const result = compressContext([], config);

      expect(result.chunks).toEqual([]);
      expect(result.originalTokens).toBe(0);
      expect(result.compressedTokens).toBe(0);
      expect(result.compressionRatio).toBe(1);
    });

    it('should apply hierarchical compression', () => {
      const chunks: ContextChunk[] = [
        createTestChunk('1', 'Code A', 'code'),
        createTestChunk('2', 'Code B', 'code'),
        createTestChunk('3', 'Doc A', 'documentation'),
      ];
      const config: CompressionConfig = {
        strategy: 'hierarchical',
        targetTokens: 100,
        maxTokens: 150,
        preserveCode: true,
        preserveStructure: true,
        minChunkSize: 10,
        level: 5,
      };

      const result = compressContext(chunks, config);

      expect(result.chunks.length).toBeGreaterThan(0);
    });
  });

  describe('ContextCompressor class', () => {
    it('should compress with default config', () => {
      const compressor = new ContextCompressor();
      const chunks: ContextChunk[] = [
        createTestChunk('1', 'A'.repeat(400)),
      ];

      const result = compressor.compress(chunks);

      expect(result.chunks.length).toBeGreaterThan(0);
    });

    it('should compress a single chunk', () => {
      const compressor = new ContextCompressor({
        preserveCode: true,
        preserveStructure: true,
        minChunkSize: 10,
        level: 5,
      });
      const chunk = createTestChunk('1', 'A'.repeat(400), 'code', 100);

      const result = compressor.compressChunk(chunk, 50);

      expect(result.compressedTokens).toBeLessThanOrEqual(50);
    });

    it('should update config', () => {
      const compressor = new ContextCompressor({ targetTokens: 1000 });

      compressor.updateConfig({ targetTokens: 500 });

      expect(compressor.getConfig().targetTokens).toBe(500);
    });

    it('should return config copy', () => {
      const compressor = new ContextCompressor({ targetTokens: 1000 });
      const config = compressor.getConfig();

      config.targetTokens = 500; // Should not affect internal config

      expect(compressor.getConfig().targetTokens).toBe(1000);
    });
  });

  describe('Content type specific compression', () => {
    it('should compress code chunks preserving structure', () => {
      const chunks: ContextChunk[] = [
        createTestChunk('1', `
function foo() {
  console.log('foo');
}

function bar() {
  console.log('bar');
}
        `.trim(), 'code'),
      ];
      const config: CompressionConfig = {
        strategy: 'summarize',
        targetTokens: 50,
        maxTokens: 100,
        preserveCode: true,
        preserveStructure: true,
        minChunkSize: 10,
        level: 5,
      };

      const result = compressContext(chunks, config);

      expect(result.chunks[0].content).toContain('function');
    });

    it('should compress documentation preserving headers', () => {
      const chunks: ContextChunk[] = [
        createTestChunk('1', `
# Main Header

Some content here.

## Sub Header

More content.
        `.trim(), 'documentation'),
      ];
      const config: CompressionConfig = {
        strategy: 'summarize',
        targetTokens: 50,
        maxTokens: 100,
        preserveCode: true,
        preserveStructure: true,
        minChunkSize: 10,
        level: 5,
      };

      const result = compressContext(chunks, config);

      expect(result.chunks[0].content).toContain('#');
    });

    it('should compress conversation chunks', () => {
      const chunks: ContextChunk[] = [
        createTestChunk('1', `
User: Hello, I need help with something.
Assistant: Sure, what do you need help with?
User: I want to implement a feature.
Assistant: Great, let's get started.
        `.trim(), 'conversation'),
      ];
      const config: CompressionConfig = {
        strategy: 'summarize',
        targetTokens: 50,
        maxTokens: 100,
        preserveCode: true,
        preserveStructure: true,
        minChunkSize: 10,
        level: 5,
      };

      const result = compressContext(chunks, config);

      expect(result.chunks[0].summarized).toBe(true);
    });

    it('should compress error chunks preserving error info', () => {
      const chunks: ContextChunk[] = [
        createTestChunk('1', `
Error: Cannot find module 'lodash'
    at Object.<anonymous> (/app/index.js:1:15)
    at Module._compile (internal/modules/cjs/loader.js:999:30)
    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1027:10)
        `.trim(), 'error'),
      ];
      const config: CompressionConfig = {
        strategy: 'summarize',
        targetTokens: 50,
        maxTokens: 100,
        preserveCode: true,
        preserveStructure: true,
        minChunkSize: 10,
        level: 5,
      };

      const result = compressContext(chunks, config);

      expect(result.chunks[0].content).toContain('Error');
    });
  });
});
