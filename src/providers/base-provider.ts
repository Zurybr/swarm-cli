/**
 * Multi-Model Provider Abstraction - Issue #22
 * Capa de abstracción para múltiples proveedores de IA
 */

import { 
  Provider, 
  Model, 
  CompletionOptions, 
  Completion, 
  Chunk, 
  Message,
  Tool,
  TokenUsage,
  ProviderName 
} from '../types';

export abstract class BaseProvider implements Provider {
  abstract name: ProviderName;
  abstract models: Model[];
  abstract supportsTools: boolean;
  abstract supportsVision: boolean;
  abstract supportsStreaming: boolean;
  abstract maxContextTokens: number;
  
  protected apiKey?: string;
  protected baseUrl?: string;
  
  constructor(config: { apiKey?: string; baseUrl?: string } = {}) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl;
  }
  
  /**
   * Completa una conversación
   */
  abstract complete(options: CompletionOptions): Promise<Completion>;
  
  /**
   * Stream de respuesta
   */
  abstract stream(options: CompletionOptions): AsyncIterable<Chunk>;
  
  /**
   * Valida opciones de completado
   */
  protected validateOptions(options: CompletionOptions): void {
    if (!options.model) {
      throw new Error('Model is required');
    }
    if (!options.messages || options.messages.length === 0) {
      throw new Error('At least one message is required');
    }
    
    const model = this.models.find(m => m.id === options.model);
    if (!model) {
      throw new Error(`Model ${options.model} not found in provider ${this.name}`);
    }
    
    if (options.tools && !this.supportsTools) {
      throw new Error(`Provider ${this.name} does not support tools`);
    }
  }
  
  /**
   * Calcula uso de tokens (estimación simple)
   */
  protected estimateTokenUsage(messages: Message[], response: string): TokenUsage {
    const input = messages.reduce((acc, m) => acc + m.content.length, 0) / 4;
    const output = response.length / 4;
    
    return {
      input: Math.round(input),
      output: Math.round(output),
      total: Math.round(input + output)
    };
  }
  
  /**
   * Convierte mensajes internos al formato del proveedor
   */
  protected abstract formatMessages(messages: Message[]): any;
  
  /**
   * Convierte tools internas al formato del proveedor
   */
  protected abstract formatTools(tools?: Tool[]): any;
  
  /**
   * Parsea respuesta del proveedor
   */
  protected abstract parseResponse(response: any): Completion;
  
  /**
   * Obtiene información de un modelo
   */
  getModelInfo(modelId: string): Model | undefined {
    return this.models.find(m => m.id === modelId);
  }
  
  /**
   * Lista modelos disponibles
   */
  listModels(): Model[] {
    return [...this.models];
  }
  
  /**
   * Verifica si un modelo existe
   */
  hasModel(modelId: string): boolean {
    return this.models.some(m => m.id === modelId);
  }
}
