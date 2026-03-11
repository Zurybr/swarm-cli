/**
 * Web Search Implementation
 * 
 * Provides web search using DuckDuckGo
 */

import * as https from 'https';
import * as http from 'http';

export interface SearchResult {
  title: string;
  url: string;
  description: string;
}

export interface SearchOptions {
  maxResults?: number;
  region?: string;
}

/**
 * Perform a web search using DuckDuckGo HTML
 */
export async function search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
  const maxResults = options.maxResults || 10;
  const region = options.region || 'us-en';
  
  const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=${region}`;
  
  try {
    const html = await fetchUrl(searchUrl);
    return parseDuckDuckGoResults(html, maxResults);
  } catch (error) {
    throw new Error(`Search failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Parse DuckDuckGo HTML results
 */
function parseDuckDuckGoResults(html: string, maxResults: number): SearchResult[] {
  const results: SearchResult[] = [];
  
  // Simple regex parsing for DuckDuckGo HTML
  // Pattern: <a class="result__a" href="URL">TITLE</a>
  const linkRegex = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
  const snippetRegex = /<a[^>]*class="result__snippet"[^>]*>([^<]*(?:<[^>]+>[^<]*)*)<\/a>/g;
  
  const links: Array<{ url: string; title: string }> = [];
  const snippets: string[] = [];
  
  let match;
  while ((match = linkRegex.exec(html)) !== null && links.length < maxResults) {
    // DuckDuckGo redirects through their service, extract actual URL
    let url = match[1];
    const uddgMatch = url.match(/uddg=([^&]+)/);
    if (uddgMatch) {
      url = decodeURIComponent(uddgMatch[1]);
    }
    
    links.push({
      url,
      title: decodeHtmlEntities(match[2]),
    });
  }
  
  while ((match = snippetRegex.exec(html)) !== null && snippets.length < maxResults) {
    snippets.push(decodeHtmlEntities(match[1].replace(/<[^>]+>/g, '')));
  }
  
  for (let i = 0; i < Math.min(links.length, maxResults); i++) {
    results.push({
      title: links[i].title,
      url: links[i].url,
      description: snippets[i] || '',
    });
  }
  
  return results;
}

/**
 * Decode HTML entities
 */
function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&nbsp;': ' ',
  };
  
  return text.replace(/&[^;]+;/g, (entity) => entities[entity] || entity);
}

/**
 * Fetch URL content
 */
export async function fetchUrl(url: string, timeout = 30000): Promise<string> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    const request = protocol.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SwarmCLI/1.0)',
        'Accept': 'text/html,application/xhtml+xml,text/plain',
      },
      timeout,
    }, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 303) {
        const location = response.headers.location;
        if (location) {
          fetchUrl(location, timeout).then(resolve).catch(reject);
          return;
        }
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      
      let data = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => resolve(data));
      response.on('error', reject);
    });
    
    request.on('error', reject);
    request.on('timeout', () => {
      request.destroy();
      reject(new Error('Request timeout'));
    });
  });
}
