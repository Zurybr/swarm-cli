# Swarm CLI

> Convierte especificaciones en proyectos funcionales mediante agentes inteligentes

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22.0-brightgreen)](package.json)

## 🎯 Objetivo

Swarm CLI es un sistema de orquestación de agentes que transforma especificaciones (PRDs, tareas, tickets) en implementaciones funcionales, gestionando el trabajo en lugar de supervisar agentes de codificación.

Inspirado en [OpenAI Symphony](https://github.com/openai/symphony), DeerFlow, y las mejores prácticas de OpenClaw.

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│  FRONTEND (Web UI)                                      │
│  • Kanban view de GitHub Projects                       │
│  • Dashboard de agentes en tiempo real                  │
│  • Autenticación simple por token                       │
├─────────────────────────────────────────────────────────┤
│  CLI DUAL                                               │
│  • CLI/Humanos: Interfaz paso a paso conversacional     │
│  • CLI/IA: JSON/YAML estructurado para automatización   │
├─────────────────────────────────────────────────────────┤
│  BACKEND (Fuente única de verdad)                       │
│  • Orquestación Mastra + Symphony-style                 │
│  • Sync bidireccional GitHub (issues, projects)         │
│  • Git worktrees por tarea (aislamiento)                │
│  • Validación automática sin intervención humana        │
│  • Merge inteligente basado en specs                    │
│  • Persistencia: SQLite + Vector + Graph                │
└───────────────────────────────────────────────��────────┘
```

## ✨ Características

- 🎯 **Specs → Código**: Convierte PRDs en proyectos funcionales
- 🤖 **Agentes Especializados**: Orquestador, Planner, Coder, Tester, Validator
- 🌳 **Git Worktrees**: Cada tarea = rama aislada no bloqueante
- 📊 **GitHub Integration**: Issues y Projects sincronizados automáticamente
- 🔄 **Ralph Loop**: Investigación profunda disponible ON/OFF
- 🧠 **Memoria Híbrida**: ArsContexta (default) + Mem0 + Graphiti + Obsidian
- 🔌 **Embeddings Configurables**: BGE-M3 (default) + OpenAI + Voyage + más
- 🌐 **Multi-Provider**: Kimi, Anthropic, OpenAI, OpenRouter, etc.
- 🧪 **Validación Automática**: Subagentes validan sin supervisión

## 🚀 Instalación

```bash
# Global install
npm install -g swarm-cli

# O usar npx
npx swarm-cli
```

## 📖 Uso Rápido

```bash
# Inicializar proyecto
swarm-cli init --github owner/repo --specs specs.md

# Crear tarea desde spec
swarm-cli task create --spec "feature/auth.md" --depth 3

# Ver estado
swarm-cli status

# Modo interactivo
swarm-cli
```

## 📚 Documentación

- [Arquitectura Backend](docs/architecture/backend.md)
- [Plan de Implementación](docs/plans/)
- [API Reference](docs/api.md)

## 🤝 Contribuir

Ver [CONTRIBUTING.md](CONTRIBUTING.md)

## 📄 Licencia

MIT License - ver [LICENSE](LICENSE)

---

*Built with ❤️ using Mastra, Symphony patterns, and OpenClaw principles*
