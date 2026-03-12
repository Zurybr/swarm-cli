/**
 * Provider Manager - Issue #22
 * Gestión de múltiples proveedores de IA con routing y fallback
 */

import { 
  Provider, 
  ProviderName, 
  CompletionOptions, 
  Completion, 
  Chunk,
  RoutingConfig,
  RoutingRule,
  Model 
} from '../types';
import { AnthropicProvider } from './anthropic-provider';
import { OpenAIProvider } from './openai-provider';
import { OllamaProvider } from './ollama-provider';
import { GoogleProvider } from './google-provider';

export class ProviderManager {
  private providers: Map<ProviderName, Provider> = new Map();
  private routingConfig: RoutingConfig;
  
  constructor(config?: Partial<RoutingConfig>) {
    this.routingConfig = {
      defaultProvider: 'anthropic',
      defaultModel: 'claude-3-sonnet-20240229',
      fallbackChain: ['anthropic', 'openai', 'google', 'ollama'],
      routingRules: [],
      ...config
    };
  }
  
  /**
   * Registra un proveedor
   */
  registerProvider(provider: Provider): void {
    this.providers.set(provider.name, provider);
  }
  
  /**
   * Registra proveedores por defecto
   */
  registerDefaultProviders(config: {
    anthropicApiKey?: string;
    openaiApiKey?: string;
    ollamaBaseUrl?: string;
    googleApiKey?: string;
  } = {}): void {
    if (config.anthropicApiKey) {
      this.registerProvider(new AnthropicProvider({ apiKey: config.anthropicApiKey }));
    }
    
    if (config.openaiApiKey) {
      this.registerProvider(new OpenAIProvider({ apiKey: config.openaiApiKey }));
    }
    
    if (config.googleApiKey) {
      this.registerProvider(new GoogleProvider({ apiKey: config.googleApiKey }));
    }
    
    this.registerProvider(new OllamaProvider({ baseUrl: config.ollamaBaseUrl }));
  }
  
  /**
   * Auto-detecta y registra proveedores basado en variables de entorno
   */
  async autoRegisterProviders(): Promise<void> {
    // Anthropic
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (anthropicKey) {
      this.registerProvider(new AnthropicProvider({ apiKey: anthropicKey }));
    }
    
    // OpenAI
    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey) {
      this.registerProvider(new OpenAIProvider({ apiKey: openaiKey }));
    }
    
    // Google
    const googleKey = await GoogleProvider.detectApiKey();
    if (googleKey) {
      this.registerProvider(new GoogleProvider({ apiKey: googleKey }));
    }
    
    // Ollama (always register, will fail gracefully if not available)
    this.registerProvider(new OllamaProvider());
  }
  
  /**
   * Detecta qué proveedores están disponibles
   */
  async detectAvailableProviders(): Promise<ProviderName[]> {
    const available: ProviderName[] = [];
    
    if (process.env.ANTHROPIC_API_KEY) {
      available.push('anthropic');
    }
    
    if (process.env.OPENAI_API_KEY) {
      available.push('openai');
    }
    
    if (await GoogleProvider.isAvailable()) {
      available.push('google');
    }
    
    // Check Ollama availability
    const ollama = this.providers.get('ollama') as OllamaProvider | undefined;
    if (ollama && await ollama.isAvailable()) {
      available.push('ollama');
    }
    
    return available;
  }
  
  /**
   * Obtiene un proveedor por nombre
   */
  getProvider(name: ProviderName): Provider | undefined {
    return this.providers.get(name);
  }
  
  /**
   * Lista todos los proveedores registrados
   */
  listProviders(): Provider[] {
    return Array.from(this.providers.values());
  }
  
  /**
   * Lista todos los modelos disponibles
   */
  listAllModels(): Model[] {
    return this.listProviders().flatMap(p => p.models);
  }
  
  /**
   * Selecciona el mejor proveedor basado en reglas de routing
   */
  selectProvider(options: CompletionOptions): Provider {
    // Aplicar reglas de routing
    for (const rule of this.routingConfig.routingRules) {
      if (this.matchesRule(rule, options)) {
        const provider = this.providers.get(rule.provider);
        if (provider) return provider;
      }
    }
    
    // Usar proveedor por defecto
    const defaultProvider = this.providers.get(this.routingConfig.defaultProvider);
    if (defaultProvider) return defaultProvider;
    
    // Fallback al primer proveedor disponible
    const firstProvider = this.listProviders()[0];
    if (firstProvider) return firstProvider;
    
    throw new Error('No providers registered');
  }
  
  /**
   * Verifica si una regla aplica a las opciones
   */
  private matchesRule(rule: RoutingRule, options: CompletionOptions): boolean {
    if (rule.condition === 'capability') {
      const provider = this.providers.get(rule.provider);
      if (!provider) return false;
      
      switch (rule.capability) {
        case 'tools': return provider.supportsTools;
        case 'vision': return provider.supportsVision;
        case 'streaming': return provider.supportsStreaming;
      }
    }
    
    return false;
  }
  
  /**
   * Completa con el mejor proveedor disponible
   */
  async complete(options: CompletionOptions): Promise<Completion> {
    const provider = this.selectProvider(options);
    
    try {
      return await provider.complete(options);
    } catch (error) {
      // Intentar fallback
      return this.fallbackComplete(options, error as Error);
    }
  }
  
  /**
   * Stream con el mejor proveedor disponible
   */
  async *stream(options: CompletionOptions): AsyncIterable<Chunk> {
    const provider = this.selectProvider(options);
    
    try {
      yield* provider.stream(options);
    } catch (error) {
      // Intentar fallback
      yield* this.fallbackStream(options, error as Error);
    }
  }
  
  /**
   * Fallback para complete
   */
  private async fallbackComplete(originalOptions: CompletionOptions, originalError: Error): Promise<Completion> {
    for (const providerName of this.routingConfig.fallbackChain) {
      if (providerName === this.routingConfig.defaultProvider) continue;
      
      const provider = this.providers.get(providerName);
      if (!provider) continue;
      
      try {
        // Ajustar opciones para el proveedor fallback
        const fallbackOptions = this.adaptOptionsForProvider(originalOptions, provider);
        return await provider.complete(fallbackOptions);
      } catch {
        // Continuar con el siguiente fallback
        continue;
      }
    }
    
    throw new Error(`All providers failed. Original error: ${originalError.message}`);
  }
  
  /**
   * Fallback para stream
   */
  private async *fallbackStream(originalOptions: CompletionOptions, originalError: Error): AsyncIterable<Chunk> {
    for (const providerName of this.routingConfig.fallbackChain) {
      if (providerName === this.routingConfig.defaultProvider) continue;
      
      const provider = this.providers.get(providerName);
      if (!provider) continue;
      
      try {
        const fallbackOptions = this.adaptOptionsForProvider(originalOptions, provider);
        yield* provider.stream(fallbackOptions);
        return;
      } catch {
        continue;
      }
    }
    
    throw new Error(`All providers failed. Original error: ${originalError.message}`);
  }
  
  /**
   * Adapta opciones para un proveedor específico
   */
  private adaptOptionsForProvider(options: CompletionOptions, provider: Provider): CompletionOptions {
    const adapted = { ...options };
    
    // Si el modelo no está disponible, usar el default del proveedor
    if (!provider.hasModel(options.model)) {
      adapted.model = provider.models[0]?.id || '';
    }
    
    // Remover tools si no son soportadas
    if (options.tools && !provider.supportsTools) {
      delete adapted.tools;
    }
    
    return adapted;
  }
  
  /**
   * Actualiza configuración de routing
   */
  updateRoutingConfig(config: Partial<RoutingConfig>): void {
    this.routingConfig = { ...this.routingConfig, ...config };
  }
  
  /**
   * Obtiene configuración de routing
   */
  getRoutingConfig(): RoutingConfig {
    return { ...this.routingConfig };
  }
  
  /**
   * Verifica el estado de todos los proveedores
   */
  async healthCheck(): Promise<Map<ProviderName, { available: boolean; latency: number }>> {
    const results = new Map();
    
    for (const entry of Array.from(this.providers.entries())) {
      const [name, provider] = entry;
      const start = Date.now();
      try {
        // Intentar una llamada simple
        await provider.complete({
          model: provider.models[0]?.id || '',
          messages: [{ role: 'user', content: 'Hi' }],
          maxTokens: 10
        });
        results.set(name, { available: true, latency: Date.now() - start });
      } catch {
        results.set(name, { available: false, latency: -1 });
      }
    }
    
    return results;
  }
}
