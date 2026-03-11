/**
 * OpenAI Provider - Issue #22
 * Implementación de proveedor para OpenAI GPT
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

export class OpenAIProvider extends BaseProvider {
  name: ProviderName = 'openai';
  supportsTools = true;
  supportsVision = true;
  supportsStreaming = true;
  maxContextTokens = 128000;
  
  models: Model[] = [
    {
      id: 'gpt-4o',
      name: 'GPT-4o',
      provider: 'openai',
      maxTokens: 4096,
      supportsTools: true,
      supportsVision: true,
      costPer1KInput: 0.005,
      costPer1KOutput: 0.015
    },
    {
      id: 'gpt-4o-mini',
      name: 'GPT-4o Mini',
      provider: 'openai',
      maxTokens: 4096,
      supportsTools: true,
      supportsVision: true,
      costPer1KInput: 0.00015,
      costPer1KOutput: 0.0006
    },
    {
      id: 'gpt-4-turbo',
      name: 'GPT-4 Turbo',
      provider: 'openai',
      maxTokens: 4096,
      supportsTools: true,
      supportsVision: true,
      costPer1KInput: 0.01,
      costPer1KOutput: 0.03
    },
    {
      id: 'gpt-3.5-turbo',
      name: 'GPT-3.5 Turbo',
      provider: 'openai',
      maxTokens: 4096,
      supportsTools: true,
      supportsVision: false,
      costPer1KInput: 0.0005,
      costPer1KOutput: 0.0015
    }
  ];
  
  private baseURL = 'https://api.openai.com/v1';
  
  async complete(options: CompletionOptions): Promise<Completion> {
    this.validateOptions(options);
    
    if (!this.apiKey) {
      throw new Error('OpenAI API key is required');
    }
    
    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: options.model,
        messages: this.formatMessages(options.messages),
        max_tokens: options.maxTokens,
        temperature: options.temperature ?? 0.7,
        tools: options.tools ? this.formatTools(options.tools) : undefined
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }
    
    const data = await response.json();
    return this.parseResponse(data);
  }
  
  async *stream(options: CompletionOptions): AsyncIterable<Chunk> {
    this.validateOptions(options);
    
    if (!this.apiKey) {
      throw new Error('OpenAI API key is required');
    }
    
    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: options.model,
        messages: this.formatMessages(options.messages),
        max_tokens: options.maxTokens,
        temperature: options.temperature ?? 0.7,
        stream: true
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
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
            const delta = event.choices[0]?.delta;
            if (delta?.content) {
              yield {
                content: delta.content,
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
      role: m.role,
      content: m.content
    }));
  }
  
  protected formatTools(tools: Tool[]): any[] {
    return tools.map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters
      }
    }));
  }
  
  protected parseResponse(response: any): Completion {
    const choice = response.choices[0];
    const message = choice?.message;
    
    const toolCalls = message?.tool_calls?.map((tc: any) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments)
    }));
    
    return {
      content: message?.content || '',
      toolCalls: toolCalls?.length > 0 ? toolCalls : undefined,
      usage: {
        input: response.usage?.prompt_tokens || 0,
        output: response.usage?.completion_tokens || 0,
        total: response.usage?.total_tokens || 0
      }
    };
  }
}
