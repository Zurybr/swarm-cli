/**
 * Ollama Provider - Issue #22
 * Implementación de proveedor para modelos locales via Ollama
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

export class OllamaProvider extends BaseProvider {
  name: ProviderName = 'ollama';
  supportsTools = false; // Ollama tiene soporte limitado
  supportsVision = false;
  supportsStreaming = true;
  maxContextTokens = 32768;
  
  models: Model[] = [
    {
      id: 'llama3',
      name: 'Llama 3',
      provider: 'ollama',
      maxTokens: 4096,
      supportsTools: false,
      supportsVision: false,
      costPer1KInput: 0,
      costPer1KOutput: 0
    },
    {
      id: 'llama3.1',
      name: 'Llama 3.1',
      provider: 'ollama',
      maxTokens: 4096,
      supportsTools: false,
      supportsVision: false,
      costPer1KInput: 0,
      costPer1KOutput: 0
    },
    {
      id: 'mistral',
      name: 'Mistral',
      provider: 'ollama',
      maxTokens: 4096,
      supportsTools: false,
      supportsVision: false,
      costPer1KInput: 0,
      costPer1KOutput: 0
    },
    {
      id: 'codellama',
      name: 'CodeLlama',
      provider: 'ollama',
      maxTokens: 4096,
      supportsTools: false,
      supportsVision: false,
      costPer1KInput: 0,
      costPer1KOutput: 0
    },
    {
      id: 'mixtral',
      name: 'Mixtral',
      provider: 'ollama',
      maxTokens: 4096,
      supportsTools: false,
      supportsVision: false,
      costPer1KInput: 0,
      costPer1KOutput: 0
    }
  ];
  
  private baseURL = 'http://localhost:11434';
  
  constructor(config: { apiKey?: string; baseUrl?: string } = {}) {
    super(config);
    if (config.baseUrl) {
      this.baseURL = config.baseUrl;
    }
  }
  
  async complete(options: CompletionOptions): Promise<Completion> {
    this.validateOptions(options);
    
    const response = await fetch(`${this.baseURL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: options.model,
        messages: this.formatMessages(options.messages),
        stream: false,
        options: {
          temperature: options.temperature ?? 0.7
        }
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama API error: ${error}`);
    }
    
    const data = await response.json();
    return this.parseResponse(data);
  }
  
  async *stream(options: CompletionOptions): AsyncIterable<Chunk> {
    this.validateOptions(options);
    
    const response = await fetch(`${this.baseURL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: options.model,
        messages: this.formatMessages(options.messages),
        stream: true,
        options: {
          temperature: options.temperature ?? 0.7
        }
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama API error: ${error}`);
    }
    
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');
    
    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(Boolean);
      
      for (const line of lines) {
        try {
          const event = JSON.parse(line);
          if (event.message?.content) {
            yield {
              content: event.message.content,
              isComplete: event.done || false
            };
          }
        } catch {
          // Ignorar líneas inválidas
        }
      }
    }
    
    yield { content: '', isComplete: true };
  }
  
  protected formatMessages(messages: Message[]): any[] {
    return messages.map(m => ({
      role: m.role === 'system' ? 'system' : m.role,
      content: m.content
    }));
  }
  
  protected formatTools(tools?: Tool[]): any[] {
    // Ollama no soporta tools de forma nativa
    return [];
  }
  
  protected parseResponse(response: any): Completion {
    return {
      content: response.message?.content || '',
      usage: {
        input: response.prompt_eval_count || 0,
        output: response.eval_count || 0,
        total: (response.prompt_eval_count || 0) + (response.eval_count || 0)
      }
    };
  }
  
  /**
   * Lista modelos disponibles en Ollama
   */
  async listLocalModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseURL}/api/tags`);
      if (!response.ok) return [];
      
      const data = await response.json();
      return data.models?.map((m: any) => m.name) || [];
    } catch {
      return [];
    }
  }
  
  /**
   * Verifica si Ollama está disponible
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
