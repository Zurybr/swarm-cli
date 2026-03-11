/**
 * Anthropic Provider - Issue #22
 * Implementación de proveedor para Anthropic Claude
 */

import { BaseProvider } from './base-provider';
import { 
  ProviderName, 
  Model, 
  CompletionOptions, 
  Completion, 
  Chunk, 
  Message,
  Tool 
} from '../types';

export class AnthropicProvider extends BaseProvider {
  name: ProviderName = 'anthropic';
  supportsTools = true;
  supportsVision = true;
  supportsStreaming = true;
  maxContextTokens = 200000;
  
  models: Model[] = [
    {
      id: 'claude-3-opus-20240229',
      name: 'Claude 3 Opus',
      provider: 'anthropic',
      maxTokens: 4096,
      supportsTools: true,
      supportsVision: true,
      costPer1KInput: 0.015,
      costPer1KOutput: 0.075
    },
    {
      id: 'claude-3-sonnet-20240229',
      name: 'Claude 3 Sonnet',
      provider: 'anthropic',
      maxTokens: 4096,
      supportsTools: true,
      supportsVision: true,
      costPer1KInput: 0.003,
      costPer1KOutput: 0.015
    },
    {
      id: 'claude-3-haiku-20240307',
      name: 'Claude 3 Haiku',
      provider: 'anthropic',
      maxTokens: 4096,
      supportsTools: true,
      supportsVision: true,
      costPer1KInput: 0.00025,
      costPer1KOutput: 0.00125
    }
  ];
  
  private baseURL = 'https://api.anthropic.com/v1';
  
  async complete(options: CompletionOptions): Promise<Completion> {
    this.validateOptions(options);
    
    if (!this.apiKey) {
      throw new Error('Anthropic API key is required');
    }
    
    const response = await fetch(`${this.baseURL}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: options.model,
        messages: this.formatMessages(options.messages),
        max_tokens: options.maxTokens || 4096,
        temperature: options.temperature ?? 0.7,
        tools: options.tools ? this.formatTools(options.tools) : undefined
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${error}`);
    }
    
    const data = await response.json();
    return this.parseResponse(data);
  }
  
  async *stream(options: CompletionOptions): AsyncIterable<Chunk> {
    this.validateOptions(options);
    
    if (!this.apiKey) {
      throw new Error('Anthropic API key is required');
    }
    
    const response = await fetch(`${this.baseURL}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: options.model,
        messages: this.formatMessages(options.messages),
        max_tokens: options.maxTokens || 4096,
        temperature: options.temperature ?? 0.7,
        stream: true
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${error}`);
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
          if (data === '[DONE]') return;
          
          try {
            const event = JSON.parse(data);
            if (event.type === 'content_block_delta') {
              yield {
                content: event.delta.text || '',
                isComplete: false
              };
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
    return messages.map(m => ({
      role: m.role === 'system' ? 'user' : m.role,
      content: m.content
    }));
  }
  
  protected formatTools(tools: Tool[]): any[] {
    return tools.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters
    }));
  }
  
  protected parseResponse(response: any): Completion {
    const content = response.content
      .filter((c: any) => c.type === 'text')
      .map((c: any) => c.text)
      .join('');
    
    const toolCalls = response.content
      .filter((c: any) => c.type === 'tool_use')
      .map((c: any) => ({
        id: c.id,
        name: c.name,
        arguments: c.input
      }));
    
    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: {
        input: response.usage?.input_tokens || 0,
        output: response.usage?.output_tokens || 0,
        total: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)
      }
    };
  }
}
