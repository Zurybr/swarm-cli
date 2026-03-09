# Research Summary: Agent Capability Systems

## Key Findings

### 1. Framework Landscape (from stack.md)

**Leading Frameworks for Agent Skills:**
- **LangGraph (2025)** — Graph-based state machines with cycles, BSP execution, checkpointing, subgraph composition. Recommended by LangChain for production.
- **AutoGen/AG2** — Multi-agent orchestration with Group Chat, Swarm patterns, explicit handoffs, A2A protocol support.
- **CrewAI** — Role-based agents with sequential/parallel/hierarchical processes.
- **Pydantic AI** — Type-safe agent framework with dependency injection.

**Skill System Patterns:**
- **Registry Pattern**: Central skill registry with version management
- **Plugin Architecture**: Hot-swappable capabilities with standardized interfaces
- **MCP (Model Context Protocol)**: Emerging standard for tool/context standardization
- **A2A Protocol**: Agent-to-agent interoperability for cross-framework collaboration

### 2. Architecture Patterns (from research)

**Capability Discovery:**
- Runtime skill registration with metadata
- Hierarchical supervision for conflict resolution
- LLM-powered agent selection based on task requirements

**Composition Approaches:**
- **Fractal Composition**: Subgraphs as nodes in parent graphs
- **Pipeline**: Sequential handoffs between specialized agents
- **Supervisor**: Central coordinator routes to specialists
- **Swarm**: Dynamic handoffs with explicit transfer control

### 3. Challenges & Pitfalls (from challenges.md)

**Capability Conflicts:**
- Five types: result, resource, temporal, goal, overlap
- Resolution: hierarchical supervision, confidence-based voting, circuit breakers

**Testing Dynamic Agents:**
- Non-determinism requires LLM-as-a-Judge methodologies
- Simulation-based testing vs traditional deterministic tests
- Need for evaluation frameworks

**Performance:**
- "Tool overload" — more capabilities can degrade performance
- Error cascades in multi-agent systems
- Coordination breakdown at scale

**Security:**
- Kernel-level isolation for pluggable agents
- "Lethal trifecta": private data + network access + untrusted execution
- Guardrails: regex and LLM-based policy enforcement

## Roadmap Implications

Recommended phase ordering:
1. **Foundation** — Security controls and observability first
2. **Skill Registry** — Dynamic registration with version management
3. **Multi-Agent Coordination** — Hierarchical supervision before advanced negotiation
4. **Advanced Capabilities** — Gradual tool expansion with circuit breakers

## Sources

- .planning/research/stack.md — Frameworks and tools
- .planning/research/challenges.md — Pitfalls and mitigation strategies
