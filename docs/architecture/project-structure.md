# Estructura del Proyecto

```
swarm-cli/
├── README.md                 # Documentación principal
├── LICENSE                   # MIT License
├── CHANGELOG.md              # Historial de cambios
├── AGENTS.md                 # Identidad y comportamiento
├── package.json              # Dependencias npm
├── tsconfig.json             # Configuración TypeScript
│
├── docs/                     # Documentación
│   ├── plans/                # Planes de implementación
│   ├── architecture/         # Documentación de arquitectura
│   └── api/                  # API Reference
│
├── src/                      # Código fuente
│   ├── backend/              # Backend (fuente de verdad)
│   │   ├── core/
│   │   │   ├── orchestrator.ts
│   │   │   ├── agent-registry.ts
│   │   │   ├── task-queue.ts
│   │   │   └── state-manager.ts
│   │   ├── github-sync/
│   │   │   ├── issue-sync.ts
│   │   │   ├── project-sync.ts
│   │   │   └── worktree-manager.ts
│   │   ├── agents/
│   │   │   ├── base-agent.ts
│   │   │   ├── orchestrator-agent.ts
│   │   │   ├── planner-agent.ts
│   │   │   ├── coder-agent.ts
│   │   │   ├── tester-agent.ts
│   │   │   └── validator-agent.ts
│   │   ├── persistence/
│   │   │   ├── sqlite/
│   │   │   ├── vector/
│   │   │   ├── graph/
│   │   │   └── memory-factory.ts
│   │   ├── embedding/
│   │   │   └── adapters/
│   │   ├── api/
│   │   │   ├── routes/
│   │   │   ├── websocket.ts
│   │   │   └── middleware/
│   │   └── utils/
│   │
│   ├── frontend/             # Web UI
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   └── api-client/
│   │
│   └── cli/                  # CLI dual
│       ├── human/            # Modo interactivo
│       ├── ai/               # Modo estructurado
│       └── shared/
│
├── tests/                    # Tests
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── scripts/                  # Scripts utilitarios
│   └── setup.sh
│
└── config/                   # Configuración
    ├── default.yaml
    └── schema.json
```

## Convenciones

- **Backend:** TypeScript, arquitectura modular
- **Frontend:** React/Vue (TBD), consume API backend
- **CLI:** Commander.js, dual interface
- **Tests:** Jest, cobertura mínima 80%
- **Docs:** Markdown, diagramas con Mermaid
