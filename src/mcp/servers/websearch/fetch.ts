/**
 * URL Fetching and Content Extraction
 * 
 * Provides tools to fetch and parse web content
 */

import * as cheerio from 'cheerio';
import { fetchUrl } from './search.js';

export interface FetchResult {
  url: string;
  title: string;
  content: string;
  links: string[];
  metadata: {
    description?: string;
    keywords?: string[];
    author?: string;
  };
}

export interface SummarizeResult {
  url: string;
  title: string;
  summary: string;
  keyPoints: string[];
}

/**
 * Fetch and extract content from a URL
 */
export async function fetchAndExtract(url: string): Promise<FetchResult> {
  const html = await fetchUrl(url);
  const $ = cheerio.load(html);
  
  // Remove unwanted elements
  $('script, style, nav, footer, header, aside, iframe').remove();
  
  // Extract title
  const title = $('title').text().trim() || 
                $('h1').first().text().trim() || 
                'No title';
  
  // Extract main content
  let content = '';
  
  // Try common content selectors
  const contentSelectors = [
    'article',
    '[role="main"]',
    'main',
    '.content',
    '.post-content',
    '.article-content',
    '#content',
  ];
  
  for (const selector of contentSelectors) {
    const element = $(selector);
    if (element.length > 0) {
      content = element.text().trim();
      if (content.length > 100) break;
    }
  }
  
  // Fallback to body
  if (!content || content.length < 100) {
    content = $('body').text().trim();
  }
  
  // Clean up whitespace
  content = content
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n\n')
    .trim();
  
  // Extract links
  const links: string[] = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
      try {
        const absoluteUrl = new URL(href, url).toString();
        if (!links.includes(absoluteUrl)) {
          links.push(absoluteUrl);
        }
      } catch {
        // Invalid URL, skip
      }
    }
  });
  
  // Extract metadata
  const metadata = {
    description: $('meta[name="description"]').attr('content') ||
                  $('meta[property="og:description"]').attr('content'),
    keywords: ($('meta[name="keywords"]').attr('content') || '')
      .split(',')
      .map(k => k.trim())
      .filter(Boolean),
    author: $('meta[name="author"]').attr('content'),
  };
  
  return {
    url,
    title,
    content,
    links: links.slice(0, 50), // Limit links
    metadata,
  };
}

/**
 * Summarize web page content
 * This is a simple extractive summarization
 */
export async function summarizeContent(url: string, maxLength = 500): Promise<SummarizeResult> {
  const result = await fetchAndExtract(url);
  
  // Simple extractive summarization
  // Split into sentences and score by position and length
  const sentences = result.content
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 20 && s.length < 200);
  
  if (sentences.length === 0) {
    return {
      url,
      title: result.title,
      summary: result.content.slice(0, maxLength),
      keyPoints: [],
    };
  }
  
  // Score sentences (first and last paragraphs are often important)
  const scoredSentences = sentences.map((sentence, index) => {
    let score = 0;
    
    // First sentences are important
    if (index < 3) score += 3;
    else if (index < 5) score += 2;
    else if (index < 10) score += 1;
    
    // Sentences with keywords are important
    const lowerSentence = sentence.toLowerCase();
    if (lowerSentence.includes('important') || 
        lowerSentence.includes('key') ||
        lowerSentence.includes('main') ||
        lowerSentence.includes('conclusion')) {
      score += 2;
    }
    
    return { sentence, score };
  });
  
  // Sort by score and take top sentences
  scoredSentences.sort((a, b) => b.score - a.score);
  
  const topSentences = scoredSentences
    .slice(0, 5)
    .sort((a, b) => sentences.indexOf(a.sentence) - sentences.indexOf(b.sentence))
    .map(s => s.sentence);
  
  const summary = topSentences.join('. ') + '.';
  
  return {
    url,
    title: result.title,
    summary: summary.slice(0, maxLength),
    keyPoints: topSentences.slice(0, 3),
  };
}
