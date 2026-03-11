# Web Search MCP Server

A built-in MCP server providing web search and content fetching tools for Swarm CLI.

## Installation

```bash
npm install @swarm-cli/mcp-websearch
```

## Usage

### Standalone

```bash
# Run directly with ts-node
npx ts-node src/mcp/servers/websearch/index.ts

# Or after building
node dist/websearch/index.js
```

### With Claude Desktop

Add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "websearch": {
      "command": "node",
      "args": ["/path/to/swarm-cli/dist/mcp/servers/websearch/index.js"]
    }
  }
}
```

## Available Tools

### `web:search`

Search the web using DuckDuckGo.

**Parameters:**
- `query` (string, required): Search query
- `maxResults` (number, optional): Maximum results (default: 10)

**Example:**
```json
{
  "name": "web:search",
  "arguments": {
    "query": "Model Context Protocol MCP",
    "maxResults": 5
  }
}
```

**Response:**
```json
[
  {
    "title": "Model Context Protocol",
    "url": "https://modelcontextprotocol.io/",
    "description": "The Model Context Protocol is a standard for connecting AI assistants..."
  }
]
```

### `web:fetch`

Fetch and extract content from a URL.

**Parameters:**
- `url` (string, required): URL to fetch

**Example:**
```json
{
  "name": "web:fetch",
  "arguments": {
    "url": "https://modelcontextprotocol.io/introduction"
  }
}
```

**Response:**
```json
{
  "url": "https://modelcontextprotocol.io/introduction",
  "title": "Introduction - Model Context Protocol",
  "content": "Extracted text content...",
  "links": ["https://..."],
  "metadata": {
    "description": "Page description",
    "keywords": ["mcp", "protocol"],
    "author": "Author name"
  }
}
```

### `web:summarize`

Summarize web page content.

**Parameters:**
- `url` (string, required): URL to summarize
- `maxLength` (number, optional): Max summary length (default: 500)

**Example:**
```json
{
  "name": "web:summarize",
  "arguments": {
    "url": "https://modelcontextprotocol.io/introduction",
    "maxLength": 300
  }
}
```

**Response:**
```json
{
  "url": "https://modelcontextprotocol.io/introduction",
  "title": "Introduction - Model Context Protocol",
  "summary": "The Model Context Protocol (MCP) is a standard for connecting AI assistants to external systems...",
  "keyPoints": [
    "MCP provides a standard way to connect AI to external tools",
    "It supports tools, resources, and prompts",
    "Multiple clients and servers are available"
  ]
}
```

## Features

- **DuckDuckGo Search**: No API key required, privacy-focused search
- **Content Extraction**: Extracts main content from web pages
- **Smart Summarization**: Extractive summarization of web content
- **Link Extraction**: Extracts all links from a page
- **Metadata Extraction**: Gets page description, keywords, and author

## Limitations

- DuckDuckGo HTML parsing may break if they change their format
- Some websites may block automated requests
- JavaScript-heavy sites may not render properly
- Rate limiting may apply for frequent requests

## Future Improvements

- Support for other search engines (Google, Bing)
- Better JavaScript rendering (headless browser)
- AI-powered summarization with LLM integration
- Caching for frequently accessed pages
