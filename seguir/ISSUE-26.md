# Issue #26: [Feature][Epic] Hivemind - Semantic Memory with Embeddings

**Estado:** OPEN  
**Labels:** enhancement  
**Número:** 26  

---

## Overview
Implement Hivemind - semantic memory with embeddings for storing and retrieving learnings.

## Background
Swarm Tools uses Hivemind to store learnings as embeddings, enabling semantic search across past experiences.

## Benefits
- Learn from past experiences
- Semantic search (not just keyword)
- Pattern recognition
- Anti-pattern detection

## Sub-Issues

### #26.1 Embedding Storage Backend
**Priority:** Critical

Support multiple embedding backends:

```typescript
interface EmbeddingBackend {
  name: string;
  embed(text: string): Promise<number[]>;
  similarity(a: number[], b: number[]): number;
}

// Local: Ollama (default)
const ollamaBackend = {
  name: 'ollama',
  embed: async (text) => {
    const response = await fetch('http://localhost:11434/api/embeddings', {
      method: 'POST',
      body: JSON.stringify({
        model: 'mxbai-embed-large',  // 1024 dimensions
        prompt: text
      })
    });
    return response.embedding;
  }
};

// Cloud: OpenAI
const openaiBackend = {
  name: 'openai',
  embed: async (text) => {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text
    });
    return response.data[0].embedding;
  }
};

// Fallback: Full-text search (no embeddings)
const ftsBackend = {
  name: 'fts',
  // Use SQLite FTS5
};
```

**Configuration:**
```yaml
hivemind:
  backend: ollama  # ollama | openai | local | fts
  ollama:
    host: http://localhost:11434
    model: mxbai-embed-large  # or nomic-embed-text, all-minilm
  openai:
    model: text-embedding-3-small
  local:
    # Use local embedding model (ONNX)
    model_path: ./models/embeddings.onnx
```

**Supported Models:**
| Model | Dimensions | Best For |
|-------|------------|----------|
| mxbai-embed-large | 1024 | Quality |
| nomic-embed-text | 768 | Speed/Quality balance |
| all-minilm | 384 | Speed |
| snowflake-arctic-embed | 1024 | Long documents |

**Tasks:**
- [ ] Implement Ollama backend
- [ ] Implement OpenAI backend
- [ ] Add local ONNX backend
- [ ] Implement FTS fallback
- [ ] Add backend auto-selection

### #26.2 Vector Database
**Priority:** Critical

Store and query embeddings efficiently:

```typescript
interface VectorDB {
  // Store learning
  store(entry: HivemindEntry): Promise<void>;
  
  // Semantic search
  search(query: string, options: SearchOptions): Promise<HivemindResult[]>;
  
  // Similarity search with embedding
  searchSimilar(embedding: number[], k: number): Promise<HivemindResult[]>;
}

interface HivemindEntry {
  id: string;
  content: string;           // The learning/information
  embedding: number[];       // Vector representation
  tags: string[];            # Manual tags
  source: string;            // cell-abc123, issue-42, etc.
  type: 'pattern' | 'anti-pattern' | 'learning' | 'note';
  confidence: number;        // 0-1
  created_at: string;
  last_validated: string;
}
```

**Storage Options:**
```yaml
hivemind:
  storage: sqlite  # sqlite | libsql | chroma | pinecone
  
  sqlite:
    path: .hivemind/vectors.db
    
  libsql:
    url: libsql://...turso.io
    auth_token: xxx
```

**SQLite Schema:**
```sql
CREATE TABLE embeddings (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  embedding F32_BLOB(1024),  -- Vector
  tags TEXT,                 -- JSON array
  source TEXT,
  type TEXT,
  confidence REAL,
  created_at DATETIME,
  last_validated DATETIME
);

-- Vector similarity search using sqlite-vec
CREATE VIRTUAL TABLE vec_embeddings USING vec0(
  embedding float[1024]
);
```

**Tasks:**
- [ ] Implement SQLite vector storage
- [ ] Add libsql/Turso support
- [ ] Support ChromaDB
- [ ] Implement similarity search
- [ ] Add ANN indexing

### #26.3 Hivemind CLI Commands
**Priority:** High

```bash
# Store a learning
swarm-cli hivemind store "Auth requires idempotency keys for retries" \
  --tags "auth,gotcha,resilience" \
  --source cell-abc123 \
  --type learning

# Semantic search
swarm-cli hivemind search "authentication patterns"
swarm-cli hivemind search "how to handle OAuth errors"
swarm-cli hivemind search --tags "auth" --type pattern

# Find similar to existing entry
swarm-cli hivemind similar entry-id-123

# List all learnings
swarm-cli hivemind list
swarm-cli hivemind list --type pattern
swarm-cli hivemind list --tags "auth,security"

# View entry details
swarm-cli hivemind show entry-id-123

# Update entry
swarm-cli hivemind update entry-id-123 --confidence 0.95

# Delete entry
swarm-cli hivemind forget entry-id-123

# Export/Import
swarm-cli hivemind export > hivemind.json
swarm-cli hivemind import --file hivemind.json
```

**Tasks:**
- [ ] Implement store command
- [ ] Add search command
- [ ] Create list/show commands
- [ ] Implement update/forget
- [ ] Add export/import

### #26.4 Automatic Learning Capture
**Priority:** High

Auto-capture learnings from cell execution:

```typescript
// After cell completion, extract learnings
async function extractLearnings(cell: Cell): Promise<HivemindEntry[]> {
  const prompt = `
    Analyze this completed task and extract key learnings:
    
    Task: ${cell.title}
    Description: ${cell.description}
    Files modified: ${cell.files.join(', ')}
    Errors encountered: ${cell.errors.join(', ')}
    Outcome: ${cell.outcome}
    
    Extract:
    1. Patterns that worked well
    2. Anti-patterns to avoid
    3. Gotchas or surprises
    4. Best practices demonstrated
    
    Format as JSON array of learnings.
  `;
  
  const learnings = await agent.complete(prompt);
  return learnings.map(l => ({
    content: l.content,
    tags: l.tags,
    source: cell.id,
    type: l.type,
    confidence: 0.7  // Initial confidence
  }));
}
```

**Auto-Capture Triggers:**
- Cell completed successfully → Capture patterns
- Cell failed → Capture anti-patterns
- Cell retried → Capture resilience learning
- Checkpoint passed → Capture verification learning

**Configuration:**
```yaml
hivemind:
  auto_capture:
    enabled: true
    on_success: true
    on_failure: true
    min_confidence: 0.5
```

**Tasks:**
- [ ] Implement learning extraction
- [ ] Add auto-capture hooks
- [ ] Create confidence scoring
- [ ] Filter low-quality learnings

### #26.5 Pattern Maturation System
**Priority:** Medium

Patterns mature over time with validation:

```typescript
interface Pattern {
  id: string;
  content: string;
  stage: 'candidate' | 'established' | 'proven' | 'deprecated';
  
  // Usage tracking
  uses: {
    cell_id: string;
    outcome: 'success' | 'failure';
    at: string;
  }[];
  
  // Statistics
  success_rate: number;      // successes / total_uses
  last_used: string;
  total_uses: number;
}

// Stage transitions
candidate → established: 3+ successful uses
established → proven: 10+ successful uses, 90%+ success rate
any → deprecated: <40% success rate over last 5 uses

// Auto-deprecation
if (pattern.last_used < 90 days ago) {
  pattern.stage = 'candidate';  // Reset confidence
}
```

**CLI:**
```bash
# View pattern stats
swarm-cli hivemind pattern pattern-id-123

# Force validate
swarm-cli hivemind validate pattern-id-123 --outcome success

# List patterns by stage
swarm-cli hivemind patterns --stage proven
swarm-cli hivemind patterns --stage deprecated
```

**Tasks:**
- [ ] Implement stage tracking
- [ ] Add success/failure logging
- [ ] Create maturation logic
- [ ] Implement deprecation
- [ ] Add decay over time

### #26.6 Query Augmentation
**Priority:** Low

Automatically enhance prompts with relevant learnings:

```typescript
async function augmentQuery(query: string, context: Context): Promise<string> {
  // Search for relevant learnings
  const learnings = await hivemind.search(query, { k: 5 });
  
  // Filter by relevance
  const relevant = learnings.filter(l => l.similarity > 0.7);
  
  // Augment prompt
  return `
    ${query}
    
    ---
    Relevant learnings from past experiences:
    ${relevant.map(l => `- ${l.content} (${l.stage})`).join('\n')}
    ---
  `;
}

// Usage in agent
const augmentedPrompt = await augmentQuery(
  "Implement user authentication",
  { current_files: [...] }
);
const response = await agent.complete(augmentedPrompt);
```

**Configuration:**
```yaml
hivemind:
  augmentation:
    enabled: true
    max_learnings: 5
    min_similarity: 0.7
    include_stages: [established, proven]
```

**Tasks:**
- [ ] Implement query augmentation
- [ ] Add relevance filtering
- [ ] Create prompt formatting
- [ ] Measure augmentation effectiveness

## Acceptance Criteria
- [ ] Embedding backends work
- [ ] Vector storage functional
- [ ] CLI commands complete
- [ ] Auto-capture works
- [ ] Pattern maturation functional
- [ ] Query augmentation works

## References
- Swarm Tools: https://github.com/joelhooks/swarm-tools
- Swarm Tools Hivemind concept

---

*Fetch date: 2026-03-11*
