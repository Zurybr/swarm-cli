/**
 * Embedding Backends - Issue #26
 * Implementaciones de backends de embeddings
 */

import { EmbeddingBackend } from '../types';

/**
 * Backend de Ollama para embeddings locales
 */
export class OllamaEmbeddingBackend implements EmbeddingBackend {
  name = 'ollama';
  private baseURL: string;
  private model: string;
  
  constructor(baseURL: string = 'http://localhost:11434', model: string = 'mxbai-embed-large') {
    this.baseURL = baseURL;
    this.model = model;
  }
  
  async embed(text: string): Promise<number[]> {
    const response = await fetch(`${this.baseURL}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt: text
      })
    });
    
    if (!response.ok) {
      throw new Error(`Ollama embedding error: ${await response.text()}`);
    }
    
    const data = await response.json();
    return data.embedding;
  }
  
  similarity(a: number[], b: number[]): number {
    return cosineSimilarity(a, b);
  }
}

/**
 * Backend de OpenAI para embeddings en la nube
 */
export class OpenAIEmbeddingBackend implements EmbeddingBackend {
  name = 'openai';
  private apiKey: string;
  private model: string;
  
  constructor(apiKey: string, model: string = 'text-embedding-3-small') {
    this.apiKey = apiKey;
    this.model = model;
  }
  
  async embed(text: string): Promise<number[]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        input: text
      })
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI embedding error: ${await response.text()}`);
    }
    
    const data = await response.json();
    return data.data[0].embedding;
  }
  
  similarity(a: number[], b: number[]): number {
    return cosineSimilarity(a, b);
  }
}

/**
 * Backend de búsqueda de texto completo (sin embeddings)
 * Nota: Este backend usa tokens en lugar de embeddings reales.
 * Los "embeddings" son representaciones numéricas de hash de tokens.
 */
export class FullTextSearchBackend implements EmbeddingBackend {
  name = 'fts';
  
  async embed(text: string): Promise<number[]> {
    // Convierte tokens a representación numérica simple
    const tokens = text.toLowerCase().split(/\W+/).filter(w => w.length > 2);
    // Usa hash simple de cada token como "embedding"
    return tokens.map(token => {
      let hash = 0;
      for (let i = 0; i < token.length; i++) {
        hash = ((hash << 5) - hash) + token.charCodeAt(i);
        hash = hash & hash; // Convert to 32bit integer
      }
      return Math.abs(hash) / 2147483647; // Normalize to 0-1
    });
  }
  
  similarity(a: number[], b: number[]): number {
    // Usa Jaccard similarity para los valores
    const setA = new Set(a.map(n => n.toFixed(4)));
    const setB = new Set(b.map(n => n.toFixed(4)));
    
    const intersectionSize = Array.from(setA).filter(x => setB.has(x)).length;
    const unionSize = new Set([...Array.from(setA), ...Array.from(setB)]).size;
    
    return unionSize === 0 ? 0 : intersectionSize / unionSize;
  }
}

/**
 * Calcula similitud de coseno entre dos vectores
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same dimension');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Factory para crear backends
 */
export function createEmbeddingBackend(
  type: 'ollama' | 'openai' | 'fts',
  config: { apiKey?: string; baseURL?: string; model?: string } = {}
): EmbeddingBackend {
  switch (type) {
    case 'ollama':
      return new OllamaEmbeddingBackend(config.baseURL, config.model);
    case 'openai':
      if (!config.apiKey) throw new Error('OpenAI API key required');
      return new OpenAIEmbeddingBackend(config.apiKey, config.model);
    case 'fts':
      return new FullTextSearchBackend();
    default:
      throw new Error(`Unknown embedding backend type: ${type}`);
  }
}
