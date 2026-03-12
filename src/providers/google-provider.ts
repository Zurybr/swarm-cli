/**
 * Google Provider - Issue #22
 * Implementación de proveedor para Google Generative AI (Gemini)
 */

import { BaseProvider } from './base-provider';
import { 
  ProviderName, 
  Model, 
  CompletionOptions, 
  Completion, 
  Chunk, 
  Message,
  Tool,
  ToolCall 
} from '../types';

export class GoogleProvider extends BaseProvider {
  name: ProviderName = 'google';
  supportsTools = true;
  supportsVision = true;
  supportsStreaming = true;
  maxContextTokens = 1000000; // Gemini 1.5 Pro supports up to 1M tokens
  
  models: Model[] = [
    {
      id: 'gemini-1.5-pro',
      name: 'Gemini 1.5 Pro',
      provider: 'google',
      maxTokens: 8192,
      supportsTools: true,
      supportsVision: true,
      costPer1KInput: 0.00125,
      costPer1KOutput: 0.005
    },
    {
      id: 'gemini-1.5-flash',
      name: 'Gemini 1.5 Flash',
      provider: 'google',
      maxTokens: 8192,
      supportsTools: true,
      supportsVision: true,
      costPer1KInput: 0.000075,
      costPer1KOutput: 0.0003
    },
    {
      id: 'gemini-1.0-pro',
      name: 'Gemini 1.0 Pro',
      provider: 'google',
      maxTokens: 2048,
      supportsTools: true,
      supportsVision: false,
      costPer1KInput: 0.00025,
      costPer1KOutput: 0.0005
    },
    {
      id: 'gemini-2.0-flash-exp',
      name: 'Gemini 2.0 Flash (Experimental)',
      provider: 'google',
      maxTokens: 8192,
      supportsTools: true,
      supportsVision: true,
      costPer1KInput: 0,
      costPer1KOutput: 0
    }
  ];
  
  private baseURL = 'https://generativelanguage.googleapis.com/v1beta';
  
  async complete(options: CompletionOptions): Promise<Completion> {
    this.validateOptions(options);
    
    if (!this.apiKey) {
      throw new Error('Google API key is required');
    }
    
    const endpoint = `${this.baseURL}/models/${options.model}:generateContent`;
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.apiKey
      },
      body: JSON.stringify({
        contents: this.formatMessages(options.messages),
        generationConfig: {
          temperature: options.temperature ?? 0.7,
          maxOutputTokens: options.maxTokens || 8192
        },
        tools: options.tools ? this.formatTools(options.tools) : undefined
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google API error: ${error}`);
    }
    
    const data = await response.json();
    return this.parseResponse(data);
  }
  
  async *stream(options: CompletionOptions): AsyncIterable<Chunk> {
    this.validateOptions(options);
    
    if (!this.apiKey) {
      throw new Error('Google API key is required');
    }
    
    const endpoint = `${this.baseURL}/models/${options.model}:streamGenerateContent?alt=sse`;
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.apiKey
      },
      body: JSON.stringify({
        contents: this.formatMessages(options.messages),
        generationConfig: {
          temperature: options.temperature ?? 0.7,
          maxOutputTokens: options.maxTokens || 8192
        }
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google API error: ${error}`);
    }
    
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');
    
    const decoder = new TextDecoder();
    let buffer = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            yield { content: '', isComplete: true };
            return;
          }
          
          try {
            const event = JSON.parse(data);
            const candidate = event.candidates?.[0];
            
            if (candidate?.content?.parts) {
              for (const part of candidate.content.parts) {
                if (part.text) {
                  yield {
                    content: part.text,
                    isComplete: false
                  };
                }
              }
            }
            
            if (candidate?.finishReason === 'STOP') {
              yield { content: '', isComplete: true };
              return;
            }
          } catch {
            // Ignorar eventos inválidos
          }
        }
      }
    }
    
    yield { content: '', isComplete: true };
  }
  
  protected formatMessages(messages: Message[]): any[] {
    // Google uses a different format with 'contents' array
    // and separates system instructions
    const systemMessages = messages.filter(m => m.role === 'system');
    const nonSystemMessages = messages.filter(m => m.role !== 'system');
    
    // Build contents array with proper role mapping
    const contents: any[] = [];
    
    for (const msg of nonSystemMessages) {
      // Google uses 'user' and 'model' roles
      const role = msg.role === 'assistant' ? 'model' : msg.role;
      
      contents.push({
        role,
        parts: [{ text: msg.content }]
      });
    }
    
    return contents;
  }
  
  protected formatTools(tools: Tool[]): any[] {
    // Google's function calling format
    return [{
      functionDeclarations: tools.map(t => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters
      }))
    }];
  }
  
  protected parseResponse(response: any): Completion {
    const candidate = response.candidates?.[0];
    
    if (!candidate) {
      return {
        content: '',
        usage: { input: 0, output: 0, total: 0 }
      };
    }
    
    // Extract text content
    const textParts = candidate.content?.parts?.filter((p: any) => p.text) || [];
    const content = textParts.map((p: any) => p.text).join('');
    
    // Extract function calls
    const functionParts = candidate.content?.parts?.filter((p: any) => p.functionCall) || [];
    const toolCalls: ToolCall[] = functionParts.map((p: any) => ({
      id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: p.functionCall.name,
      arguments: p.functionCall.args || {}
    }));
    
    // Extract usage metadata
    const usageMetadata = response.usageMetadata || {};
    
    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: {
        input: usageMetadata.promptTokenCount || 0,
        output: usageMetadata.candidatesTokenCount || 0,
        total: usageMetadata.totalTokenCount || 0
      }
    };
  }
  
  /**
   * Auto-detect if Google API key is available
   */
  static async detectApiKey(): Promise<string | undefined> {
    return process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  }
  
  /**
   * Check if Google provider can be initialized
   */
  static async isAvailable(): Promise<boolean> {
    const key = await GoogleProvider.detectApiKey();
    return !!key;
  }
}
