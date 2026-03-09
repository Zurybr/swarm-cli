# Challenges in Building Agent Skill Systems

**Topic:** New agent capabilities in AI orchestration systems
**Research Focus:** Common pitfalls, failure modes, and lessons learned
**Researched:** 2026-03-09
**Overall Confidence:** MEDIUM-HIGH

---

## Executive Summary

Building agent skill systems presents unique challenges that differ fundamentally from traditional software development. The probabilistic nature of AI agents, combined with dynamic capability registration, multi-agent coordination, and security requirements, creates a complex engineering landscape. This research synthesizes findings from 2025 industry reports, academic literature, and production case studies to identify critical challenges across four domains: capability conflicts, testing, performance, and security.

The most significant finding is that **failure modes have become more valuable than success stories** for maturing agent systems. Teams that systematically study and mitigate failures mature faster than those focused solely on capability expansion.

---

## 1. Agent Capability Conflicts and Resolution

### Types of Capability Conflicts

| Conflict Type | Description | Example |
|--------------|-------------|---------|
| **Result Conflicts** | Different agents provide conflicting answers to the same problem | Two agents return different inventory counts |
| **Resource Conflicts** | Competition for API quota, processing capacity, or data access | Multiple agents exhausting rate limits simultaneously |
| **Temporal Conflicts** | Disagreements about timing or sequencing of operations | One agent deletes records while another is reading them |
| **Goal Conflicts** | Objectives that cannot all be satisfied simultaneously | Cost-optimization vs. performance-optimization agents |
| **Capability Overlap** | Multiple agents claim ability to perform the same task | Registry returns multiple matches with different confidence scores |

### Conflict Resolution Mechanisms

#### 1.1 Hierarchical Supervision
- **Central orchestrator** with supervisor-based resolution
- Multi-layer agent deployment with intervention capabilities
- **Finding:** Reduced error rates by 41% in complex decision scenarios
- **Trade-off:** Creates single point of failure if supervisor fails

#### 1.2 Confidence-Based Resolution
- Weight agent outputs by calibrated confidence scores
- Cross-validation between agents to catch inconsistencies early
- **Best practice:** Require confidence > 85% for autonomous decisions; escalate below threshold

#### 1.3 Voting and Consensus Protocols

| Mechanism | Use Case | Implementation |
|-----------|----------|----------------|
| Majority Voting | Binary decisions | Simple >50% threshold |
| Ranked-Choice | Multi-option scenarios | Eliminate lowest until consensus |
| Weighted Voting | Expertise-based decisions | Security agent vote counts 3x for auth decisions |
| Paxos/Raft | Distributed consensus | Reliable consensus across unreliable networks |
| Byzantine Fault Tolerance | Malicious agent scenarios | Handle corrupted/compromised agents |

#### 1.4 Negotiation Protocols
- **Timeboxing:** Fixed negotiation windows (e.g., 30 seconds) before escalation
- **Reinforcement learning bargaining:** Iterative negotiation for resource allocation
- **Pareto optimization:** Multi-objective trade-off analysis
- **Generative negotiation:** Simulate 100+ paths before committing

### Skill Registry Discovery Challenges

#### Registry Design Pitfalls

1. **Static Registration**
   - **Problem:** Skills registered at startup become stale as agents evolve
   - **Impact:** Registry returns agents for capabilities they no longer possess
   - **Mitigation:** Implement heartbeat-based health checks and dynamic re-registration

2. **Overly Broad Capability Claims**
   - **Problem:** Agents register vague capabilities ("can process data") leading to false matches
   - **Impact:** Task assigned to agent without specific required expertise
   - **Mitigation:** Require structured capability descriptors with input/output schemas

3. **Version Skew**
   - **Problem:** Multiple versions of same skill coexist without compatibility tracking
   - **Impact:** Breaking changes in skill v2 break orchestrators expecting v1
   - **Mitigation:** Semantic versioning with deprecation windows and compatibility layers

4. **Discovery Latency**
   - **Problem:** Registry queries become bottlenecks under load
   - **Impact:** Agent selection delays cascade into timeout failures
   - **Mitigation:** Client-side caching with TTL; eventual consistency acceptable

### Resolution Pipeline Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Detection  │───>│  Analysis   │───>│ Negotiation │───>│  Resolution │───>│  Learning   │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
     │                   │                   │                   │                   │
     ▼                   ▼                   ▼                   ▼                   ▼
Monitor disputes    Classify type      Apply mechanism   Implement decision  Feedback to
Pattern recog.      Assess stakes      (rules/ML/HITL)   Monitor compliance  improve weights
```

---

## 2. Testing Challenges for Dynamic Agents

### Core Testing Challenges

#### 2.1 Non-Determinism and Probabilistic Behavior
- **Challenge:** Agents produce different outputs for identical inputs due to LLM sampling
- **Impact:** Traditional deterministic testing approaches fail; flaky tests erode confidence
- **Mitigation:**
  - Run evaluations multiple times to achieve statistical stability
  - Use temperature=0 for test runs where consistency is required
  - Implement probabilistic assertions ("response contains X in >90% of runs")

#### 2.2 Multi-Turn Interaction Complexity
- **Challenge:** Agents succeed in early steps but fail or hallucinate in longer interactions
- **Impact:** Combinatorial explosion of conversation paths (50 intents x 10 personas = 500+ scenarios)
- **Mitigation:**
  - Capture detailed step-by-step traces for debugging
  - Implement conversation state checkpoints
  - Use simulation platforms to test thousands of scenarios

#### 2.3 Dynamic Context and Memory Handling
- **Challenge:** Agents adapt over time based on memory, feedback, and changing context
- **Impact:** Tests pass in isolation but fail in sequence; memory pollution between tests
- **Mitigation:**
  - Reset agent state between test suites
  - Test memory recall explicitly with controlled sequences
  - Monitor for goal drift over extended interactions

#### 2.4 Tool Integration and Action Sequences
- **Challenge:** Agents must correctly select, sequence, and parameterize tool calls
- **Impact:** Small misinterpretations cause wrong actions or broken workflows
- **Mitigation:**
  - Mock external services for unit tests
  - Integration tests with real (sandboxed) dependencies
  - Validate tool call schemas before execution

### Testing Methodologies for 2025

| Methodology | Purpose | Implementation |
|-------------|---------|----------------|
| **LLM-as-a-Judge** | Automated output evaluation at scale | Use separate LLM to grade response quality, relevance, safety |
| **Simulation-Based Testing** | Pre-production stress testing | AgentBench, REALM-Bench for thousands of scenarios |
| **Adversarial/Red Team** | Security vulnerability discovery | Experts attempt prompt injection, jailbreaking |
| **AETL Lifecycle** | Integrated evaluation | Behavioral checkpoints and risk-aware feedback loops |
| **Multi-Agent Coordination Testing** | Agent-to-agent interaction validation | Specialized frameworks for collaboration and delegation |

### Critical Testing Pitfalls

1. **"God Agent" Testing**
   - **Mistake:** Testing monolithic agents with dozens of tools as single units
   - **Problem:** Test failures provide no diagnostic precision
   - **Solution:** Test skill boundaries independently; use contract testing between skills

2. **Controlled Environment Myopia**
   - **Mistake:** Testing only in sanitized, predictable environments
   - **Problem:** Production failures from edge cases never exercised
   - **Solution:** Chaos engineering; inject realistic noise and failures

3. **Insufficient Observability**
   - **Mistake:** Testing outputs without internal state visibility
   - **Problem:** Cannot diagnose why failures occur
   - **Solution:** Comprehensive tracing and structured logging as first-class requirements

4. **Launch and Leave**
   - **Mistake:** Treating deployment as the finish line
   - **Problem:** Model drift and degradation undetected
   - **Solution:** Continuous evaluation pipelines with automated regression detection

### Testing Statistics (2025)

- **65%** of enterprises piloting agentic AI; only **11%** achieved full deployment
- **61%** of companies experienced accuracy issues with AI applications
- Advanced agents succeed less than **65%** of the time at function-calling for enterprise use cases
- Only **17%** rate their in-house models as "excellent"

---

## 3. Performance Pitfalls

### The "Tool Overload" Problem

**Finding:** Simply giving AI agents more tools and responsibilities does not improve performance—it often makes them worse.

| Metric | Single-Purpose Agent | Multi-Tool Agent (10+ tools) |
|--------|---------------------|------------------------------|
| Decision latency | Low | High (context-switching overhead) |
| Accuracy | High | Reduced (decision paralysis) |
| Resource usage | Predictable | Unpredictable spikes |
| Debuggability | Clear | Opaque |

**Recommendation:** Prefer specialized agent networks over monolithic agents with excessive tool counts.

### Inherited LLM Constraints

AI agents suffer from fundamental limitations of underlying language models:

| Constraint | Impact on Agent Systems |
|------------|------------------------|
| Hallucinations | False information generates cascading errors |
| Shallow reasoning | Cannot handle complex multi-step logic |
| Lack of causal reasoning | Correlation mistaken for causation |
| Stateless prompts | Limited memory without explicit architecture |
| Context window limits | Long conversations lose early context |

### Multi-Agent System Bottlenecks

For systems with multiple agents, eight critical bottlenecks have been identified:

1. **Inter-agent error cascades** – errors propagate between agents
2. **Coordination breakdowns** – communication failures
3. **Emergent instability** – unpredictable system behaviors
4. **Scalability limits** – exponential growth in coordination costs
5. **Explainability issues** – difficulty understanding collective decisions
6. **Synchronization problems** – delays in async operations
7. **Asynchronous conflicts** – race conditions between agents
8. **Heterogeneity challenges** – different protocols, algorithms, resource levels

### Scalability Challenges

| Challenge | At 100 Users | At 10K Users | At 1M Users |
|-----------|--------------|--------------|-------------|
| **Coordination overhead** | Negligible | Noticeable latency | Exponential degradation |
| **API quota management** | Simple rate limiting | Token bucket required | Distributed quota system |
| **Memory/Context storage** | In-memory sufficient | Redis/cache layer | Sharded database |
| **Observability** | Simple logging | Structured tracing | Sampling and aggregation |
| **Cost** | Predictable | Budget surprises | Requires optimization |

### Performance Anti-Patterns

1. **Polling Tax**
   - **Problem:** Agents polling for state changes instead of event-driven architecture
   - **Impact:** Wasted API calls, rate limit exhaustion, unnecessary costs
   - **Solution:** Event-driven architecture with webhooks or message queues

2. **Synchronous Orchestration**
   - **Problem:** Waiting for each agent to complete before next starts
   - **Impact:** Linear scaling, underutilized resources
   - **Solution:** Parallel execution where dependencies allow

3. **Uncapped Retries**
   - **Problem:** Infinite retry loops on transient failures
   - **Impact:** Resource exhaustion, cascading failures
   - **Solution:** Exponential backoff with circuit breakers

---

## 4. Security Considerations for Pluggable Agents

### The "Lethal Trifecta"

The most dangerous configuration occurs when AI agents have simultaneous access to:
1. **Private data**
2. **External network routing**
3. **Untrusted execution capabilities**

This combination creates maximum risk for data exfiltration, unauthorized access, and system compromise.

### Sandboxing Requirements

Standard Docker containers are **insufficient** for AI agents because they share the host kernel.

| Isolation Level | Technology | Use Case |
|----------------|------------|----------|
| **Hardware Virtualization** | AWS Firecracker, Kata Containers | Cloud/multi-tenant deployments |
| **Syscall-level** | gVisor | Environments without nested virtualization |
| **OS Primitives** | Linux Landlock/Seccomp, macOS Seatbelt | Local IDE agents |

**Key principle:** Move execution boundary from application layer down to kernel level.

### Mandatory Security Controls (NVIDIA AI Red Team, 2025)

| Control | Purpose | Implementation |
|---------|---------|----------------|
| **Network egress blocking** | Prevents data exfiltration, remote shells | Firewall rules, proxy enforcement |
| **Block file writes outside workspace** | Stops persistence mechanisms | Filesystem sandboxing |
| **Block writes to config files** | Prevents exploitation of hooks/MCP | Read-only configuration mounts |
| **Resource limits** | Prevents resource exhaustion | CPU, memory, disk quotas |
| **Secret injection** | Scope credentials to minimum required | Short-lived tokens, not env vars |

### Zero Trust Architecture for Agents

#### Identity and Authentication
- **Machine-to-machine (M2M) authentication** with cryptographic algorithms
- **OAuth 2.0** for seamless agent authentication
- **Short-lived tokens** (5-15 minute TTL) with automatic rotation
- **Unique service accounts** per agent session

#### Authorization Patterns
- **Least privilege access:** Grant only minimum required permissions
- **Tool-specific permissions:** Separate read-only from write access
- **Human-in-the-loop gates:** Require approval for high-risk actions
- **Policy enforcement gates:** Vet agent plans before execution

### Pluggable Agent-Specific Threats

#### Model Context Protocol (MCP) Security
- Deploy **MCP Gateway** as centralized proxy
- Implement **tool gating** – treat every invocation as capability request
- Enforce **Service-to-Service (S2S) auth** with mTLS and short-lived JWTs
- Apply **egress filtering** at gateway level

#### Prompt Injection Defense

| Attack Vector | Mitigation |
|--------------|------------|
| Direct prompt injection | Input validation, instruction boundary enforcement |
| Indirect/cross-domain injection | "Spotlighting" untrusted content, sandboxing |
| Malicious repositories/PRs | Sanitize control characters, template separation |
| Context poisoning | Cryptographic verification, immutable storage |

### Security Incidents (2025)

**First documented large-scale agentic AI cyberattack** occurred September 2025:
- AI systems performed 80-90% of attack work autonomously
- Thousands of requests per second
- Approximately 30 global organizations targeted

**Shadow AI statistics:**
- 80% of organizations show detectable shadow AI activity
- 70-80% of this traffic evades traditional monitoring
- ~10% of employees bypass corporate AI restrictions

---

## 5. Critical Failure Modes

### Specification and System Design Failures
- **Example:** Procurement agent deleted vendor records because "remove outdated entries" was undefined
- **Prevention:** Constraint-based checks, executable specifications, adversarial scenario suites

### Reasoning Loops and Hallucination Cascades
- **Example:** Inventory agent invents nonexistent SKU, triggering multi-system incidents
- **Key insight:** "The initial hallucination is not the real problem—it is the cascade it triggers"
- **Prevention:** Verification layers, circuit breakers, cross-reference validation

### Tool Misuse and Function Compromise
- **Example:** Data cleanup agent interpreted "remove redundant files" too broadly and deleted production folders
- **Prevention:** Sandboxed testing, minimum-necessary privilege, whitelisting

### Multi-Agent Specific Failures

| Failure Mode | Description | Prevention |
|--------------|-------------|------------|
| **Cascading Reliability Failures** | Errors propagate through dependent agents | Circuit breakers, bulkheads |
| **Hallucination Propagation** | Fabricated information spreads as other agents build upon it | Verification agents, consistency checks |
| **Orchestrator Single Point of Failure** | Central supervisor failure brings down entire system | Hot standby, distributed consensus |
| **Goal Hijacking** | Attackers manipulate agents to pursue attacker-chosen goals | Input validation, behavior monitoring |
| **Memory Poisoning** | Malicious data injected into agent memory stores | Memory sanitization, access controls |

---

## 6. Lessons Learned from Production Systems

### Shopify Sidekick (2025)

1. **Stay simple:** Resist adding tools without clear boundaries
2. **Start modular:** Use patterns like JIT instructions from the beginning
3. **Avoid multi-agent architectures early:** Single-agent systems handle more complexity than expected
4. **Build multiple LLM judges:** Different aspects require specialized evaluation
5. **Expect reward hacking:** Plan for models to game reward systems

### General Industry Lessons

1. **Building is easy; optimizing is hard** – Evaluation and iteration consume majority of effort
2. **Evaluation as first-class discipline** – Traditional testing insufficient for probabilistic systems
3. **Data quality over model choice** – Context assembly more impactful than marginal model differences
4. **Trust as system property** – Must be engineered through traceability, observability, evaluation
5. **Cost visibility critical** – Token usage and architectural inefficiencies create budget surprises

---

## 7. Recommendations for Roadmap

### Phase Ordering Implications

1. **Foundation Phase (First)**
   - Implement sandboxing and security controls
   - Build observability and tracing infrastructure
   - Establish evaluation frameworks
   - **Why:** Security and observability are harder to retrofit

2. **Skill Registry Phase (Second)**
   - Design for dynamic registration with health checks
   - Implement version management from start
   - Build conflict detection mechanisms
   - **Why:** Registry design impacts all subsequent agent capabilities

3. **Multi-Agent Coordination (Third)**
   - Start with hierarchical supervision
   - Add negotiation protocols as complexity grows
   - Implement circuit breakers and bulkheads
   - **Why:** Requires mature registry and security foundations

4. **Advanced Capabilities (Fourth)**
   - Expand tool sets gradually
   - Add ML-based resolution mechanisms
   - Implement continuous learning from conflicts
   - **Why:** Advanced features require stable base

### Research Flags for Phases

| Phase | Likely Pitfall | Recommended Research |
|-------|---------------|---------------------|
| Skill Registry | Version skew, stale registrations | MCP protocol specifications, semantic versioning patterns |
| Conflict Resolution | Orchestrator bottlenecks | Consensus algorithm implementations (Raft, PBFT) |
| Testing | Non-deterministic failures | Property-based testing, statistical validation |
| Security | Prompt injection vectors | Red team exercises, adversarial testing frameworks |

---

## Sources

### Primary Sources

- [Conflict Resolution for Multi-Agents](https://www.theunwindai.com/p/conflict-resolution-for-multi-agents) – The Unwind AI, February 2025
- [How Multi-Agent Orchestration Powers Enterprise AI](https://www.kore.ai/blog/what-is-multi-agent-orchestration) – Kore.ai
- [Multi-Agent Systems: Design Patterns and Orchestration](https://tetrate.io/learn/ai/multi-agent-systems) – Tetrate
- [Conflict Resolution Playbook: When Agents Clash](https://www.arionresearch.com/blog/conflict-resolution-playbook) – Arion Research
- [7 AI Agent Failure Modes and How To Fix Them](https://galileo.ai/blog/agent-failure-modes-guide) – Galileo AI
- [Building production-ready agentic systems: Lessons from Shopify Sidekick](https://shopify.engineering/building-production-ready-agentic-systems) – Shopify Engineering, 2025
- [Navigating the Pitfalls of AI Agent Development](https://www.kore.ai/blog/navigating-the-pitfalls-of-ai-agent-development) – Kore.ai
- [Benchmarking AI Agents in 2025](https://metadesignsolutions.com/benchmarking-ai-agents-in-2025-top-tools-metrics-performance-testing-strategies/) – MetaDesign Solutions
- [The Bottleneck in AI Agents: Why More Tools Does Not Mean More Intelligence](https://www.linkedin.com/pulse/bottleneck-ai-agents-why-more-tools-doesnt-mean-gary-ramah-lfxnc) – LinkedIn/Gary Ramah
- [AI Scalability Challenges in 2025](https://smartgnt.com/ai-scalability-challenges/) – SmartGNT
- [Practical Security Guidance for Sandboxing Agentic Workflows](https://developer.nvidia.com/blog/practical-security-guidance-for-sandboxing-agentic-workflows-and-managing-execution-risk/) – NVIDIA Developer Blog
- [Best practices for AI agent security in 2025](https://www.glean.com/perspectives/best-practices-for-ai-agent-security-in-2025) – Glean
- [How to sandbox AI agents in 2026](https://northflank.com/blog/how-to-sandbox-ai-agents) – Northflank
- [The 2025 AI Agent Security Landscape](https://www.obsidiansecurity.com/blog/ai-agent-market-landscape) – Obsidian Security
- [Multi-Agent Risks from Advanced AI](https://www.aigl.blog/content/files/2025/04/Multi-Agent-Risks-from-Advanced-AI.pdf) – AI Governance Blog, April 2025
- [Safer Agentic AI Initiative](https://www.saferagenticai.org/safer-agentic-ai-v1.1.pdf) – Safer Agentic AI, 2025

### Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Capability Conflicts | HIGH | Multiple authoritative sources, consistent patterns |
| Testing Challenges | HIGH | Industry consensus, extensive 2025 literature |
| Performance Pitfalls | MEDIUM-HIGH | Some findings from training data verified with 2025 sources |
| Security Considerations | HIGH | Recent (Sept 2025) attack data, NVIDIA guidance |
| Failure Modes | HIGH | Production case studies from major vendors |

---

## Gaps to Address

1. **Quantitative benchmarks** for specific conflict resolution algorithms (limited public data)
2. **Long-term studies** on goal drift in production multi-agent systems
3. **Standardized testing frameworks** for agent skill registries (emerging, not mature)
4. **Compliance frameworks** for regulated industries using pluggable agents
