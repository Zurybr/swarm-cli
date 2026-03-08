# Agency Agents Integration

Swarm CLI integra los 61 agentes especializados de [Agency Agents](https://github.com/msitarzewski/agency-agents) por @msitarzewski.

## 🎯 Uso

```bash
# Listar agentes disponibles
swarm-cli agents list

# Ver detalle de un agente
swarm-cli agents show frontendDeveloper

# Crear tarea con agente específico
swarm-cli task create --spec feature/auth.md --agent securityEngineer

# Crear tarea con múltiples agentes
swarm-cli task create --spec feature/ui.md --agents "frontendDeveloper,uiDesigner,uxResearcher"
```

## 🏢 Divisiones

| División | Agentes | Uso |
|----------|---------|-----|
| **Engineering** | 8 | Frontend, Backend, DevOps, AI, Security |
| **Design** | 7 | UI, UX, Brand, Visual Storytelling |
| **Marketing** | 11 | Growth, Content, Social Media |
| **Product** | 3 | Prioritization, Research |
| **Project Mgmt** | 5 | Producers, Shepherds, Operations |
| **Testing** | 8 | QA, Evidence, Performance, Accessibility |
| **Support** | 7 | Analytics, Finance, Legal |
| **Spatial Computing** | 6 | XR, Vision Pro, WebXR |
| **Specialized** | 6 | Orchestration, LSP, Sales Data |

## 🔧 Implementación

Los agentes se definen en `src/agents/definitions/agency-agents.ts`:

```typescript
export interface AgencyAgent {
  id: string;
  name: string;
  division: string;
  role: string;
  personality: string;  // System prompt
  tools: string[];      // Tools available
  deliverables: string[];  // Expected outputs
  workflow: string[];   // Step-by-step process
  successMetrics: string[];  // How to measure success
}
```

## 📄 Licencia

MIT - Mismo que el proyecto original Agency Agents.
