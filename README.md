# Swarm CLI

> Transforma especificaciones (PRDs, tickets, tareas) en proyectos funcionales mediante orquestación inteligente de agentes

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22.0-brightgreen)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](tsconfig.json)

---

## 📚 Tabla de Contenidos

- [🚀 ¿Qué es Swarm CLI?](#-qué-es-swarm-cli)
- [🏗️ Arquitectura](#️-arquitectura)
- [📖 Cómo Funciona](#-cómo-funciona)
- [⚡ Quick Start](#-quick-start)
- [🚀 Instalación](#-instalación)
- [📚 Uso](#-uso)
- [🛠️ Desarrollo](#️-desarrollo)
- [🐛 Debugging](#-debugging)
- [🤝 Cómo Contribuir](#-cómo-contribuir)
- [📄 Licencia](#-licencia)

---

## 🚀 ¿Qué es Swarm CLI?

Swarm CLI es un sistema que **gestiona trabajo en lugar de supervisar agentes de codificación**. Convierte tus especificaciones (PRDs, tickets de Linear, archivos de tareas) en implementaciones funcionales mediante orquestación inteligente.

Inspirado en [OpenAI Symphony](https://github.com/openai/symphony), DeerFlow, y las mejores prácticas de OpenClaw.

### Flujo de Trabajo

```
Tu Spec (PRD.md) → Swarm CLI → GitHub Issues → Agentes → Código → Validación → Merge
```

---

## 🛠️ Tecnologías

### Core
| Tecnología | Uso |
|------------|-----|
| **Node.js 22+** | Runtime principal |
| **TypeScript 5.3** | Lenguaje tipado |
| **Mastra** | Orquestación de agentes |
| **Express.js** | API REST |
| **WebSocket** | Updates en tiempo real |

### Persistencia
| Tecnología | Uso |
|------------|-----|
| **SQLite** | Datos relacionales (runs, tasks, agents) |
| **sqlite-vec** | Embeddings vectoriales |
| **Memgraph/Neo4j** | Relaciones entre entidades |

### Integraciones
| Tecnología | Uso |
|------------|-----|
| **GitHub CLI** | Sync issues, projects, worktrees |
| **Octokit** | API GitHub |
| **BGE-M3** | Embeddings por defecto |

### Agentes Soportados
- 🎭 **Orchestrator**: Coordina la ejecución
- 📋 **Planner**: Descompone specs en tareas
- 💻 **Coder**: Implementa código
- 🧪 **Tester**: Genera y ejecuta tests
- ✅ **Validator**: Verifica contra specs originales
- 🔄 **Ralph**: Investigación profunda (ON/OFF)

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│  🎨 FRONTEND (Web UI)                                   │
│  • Kanban view de GitHub Projects                       │
│  • Dashboard de agentes en tiempo real                  │
│  • Autenticación simple por token                       │
├─────────────────────────────────────────────────────────┤
│  💻 CLI DUAL                                            │
│  • Human Mode: Interfaz paso a paso conversacional      │
│  • AI Mode: JSON/YAML estructurado para CI/CD           │
├─────────────────────────────────────────────────────────┤
│  🔧 BACKEND (Single Source of Truth)                    │
│  • Mastra Orchestrator                                  │
│  • GitHub Sync (Issues ↔ Tasks, Projects ↔ Kanban)      │
│  • Git Worktrees (rama aislada por tarea)               │
│  • Validación automática sin intervención               │
│  • Smart Merge (resolución de conflictos por specs)     │
└─────────────────────────────────────────────────────────┘
```

---

## 📖 Cómo Funciona

### 1. Lectura de PRD

Swarm CLI parsea archivos markdown con estructura específica:

```markdown
# Feature: Autenticación

## Descripción
Implementar login con JWT...

## Tareas
- [ ] Crear endpoint /login
- [ ] Validar credenciales
- [ ] Generar token JWT

## Criterios de Aceptación
- Login exitoso retorna token válido
- Token expira en 24h
```

### 2. Generación Automática

```bash
# Swarm CLI convierte el PRD en:
# 1. Issues de GitHub
# 2. Tareas atómicas
# 3. Git worktrees (ramas aisladas)
# 4. Asignación a agentes especializados

swarm-cli init --github owner/repo --specs feature/auth.md
```

### 3. Orquestación

```
Spec parseado
    ↓
Tasks atómicos creados
    ↓
[Paralelo] → Agentes simultáneos
[Secuencial] → Uno tras otro
    ↓
Validación automática (subagentes)
    ↓
Smart merge (basado en specs)
    ↓
PR listo para review
```

### 4. Memoria y Contexto

- **Progresivo**: Empieza con contexto limitado, expande según necesidad
- **Persistente**: SQLite + Vector + Graph mantienen estado entre runs
- **Configurable**: ArsContexta (default), Mem0, Graphiti, Obsidian

---

## ⚡ Quick Start

### 1. Instalar (elegir una opción)

```bash
# Opción A: Instalación global
npm install -g swarm-cli

# Opción B: Sin instalar
npx swarm-cli

# Opción C: Con Docker (zero install)
git clone https://github.com/Zurybr/swarm-cli.git
cd swarm-cli
./dev.sh start
```

### 2. Configurar

```bash
# Verificar instalación
swarm-cli --version

# Autenticar con GitHub (requerido para integraciones)
gh auth login

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tu GITHUB_TOKEN y otras credenciales
```

### 3. Usar

```bash
# Inicializar proyecto
swarm-cli init --github owner/repo --specs ./specs

# Ver estado
swarm-cli status

# Crear tarea desde spec
swarm-cli task create --spec feature/auth.md
```

---

## 🚀 Instalación

### Opción 1: Instalación Global (Recomendada)

Instala Swarm CLI globalmente para usarlo desde cualquier directorio:

```bash
# Instalar globalmente
npm install -g swarm-cli

# Verificar instalación
swarm-cli --version
# Output: 0.1.0

# Ver ayuda
swarm-cli --help
```

**Ventajas:**
- ✅ Disponible en todo el sistema
- ✅ Comandos más cortos (`swarm-cli` vs `npx swarm-cli`)
- ✅ Autocompletado en terminal (si lo configuras)
- ✅ Mejor rendimiento (no descarga cada vez)

### Opción 2: Usar con npx (Sin Instalar)

Ejecuta Swarm CLI directamente sin instalar nada:

```bash
# Ejecutar cualquier comando
npx swarm-cli --version
npx swarm-cli init --github owner/repo

# O entrar en modo interactivo
npx swarm-cli interactive
```

**Ventajas:**
- ✅ Sin instalación permanente
- ✅ Siempre usa la última versión
- ✅ Ideal para probar o CI/CD
- ✅ No ocupa espacio en disco

**Desventajas:**
- ⚠️  Más lento al iniciar (descarga si no está en caché)
- ⚠️  Requiere conexión a internet (primera vez)

### Opción 3: Instalación por Proyecto

Si prefieres tenerlo como dependencia de tu proyecto:

```bash
# En tu proyecto
npm install --save-dev swarm-cli

# Usar con npx (recomendado)
npx swarm-cli [comando]

# O agregar scripts en package.json
{
  "scripts": {
    "swarm": "swarm-cli",
    "swarm:init": "swarm-cli init",
    "swarm:status": "swarm-cli status"
  }
}
```

### Verificación Post-Instalación

```bash
# Comprobar que está instalado correctamente
which swarm-cli          # Muestra la ruta del binario
swarm-cli --version      # Muestra versión
swarm-cli doctor         # Verifica configuración y dependencias
```

---

## 📚 Uso

### Inicializar Proyecto

```bash
# Desde un repositorio existente
cd mi-proyecto
swarm-cli init --github owner/repo --specs specs/

# Swarm CLI creará:
# - Issues de GitHub desde tus specs
# - GitHub Project con Kanban
# - Configuración local (.swarmrc.yml)
```

### Crear Tarea desde Spec

```bash
# Crear tarea especificando profundidad
swarm-cli task create --spec "feature/auth.md" --depth 3

# Depth levels:
# 1: Overview only
# 2: Include subtasks
# 3: Full implementation details + tests
```

### Ver Estado

```bash
# Dashboard en terminal
swarm-cli status

# Ver runs activos
swarm-cli run list

# Ver logs de un run específico
swarm-cli run logs --id run-abc123
```

### Modo Interactivo

```bash
# Modo conversacional para humanos
swarm-cli interactive

# O modo AI para automatización
swarm-cli ai --config pipeline.yml
```

---

## 🛠️ Desarrollo

### Opción A: Desarrollo con Docker (Recomendado) 🐳

**Zero install** - No necesitas Node.js, npm ni TypeScript instalados. Todo corre en contenedores con **hot reload**.

```bash
# 1. Clonar el repo
git clone https://github.com/tu-usuario/swarm-cli.git
cd swarm-cli

# 2. Iniciar entorno de desarrollo
./dev.sh start

# Listo! 🎉
# - API disponible en http://localhost:3000
# - Hot reload activo (cambios en src/ se reflejan instantáneamente)
# - Debugging en puerto 9229
```

**Comandos útiles:**

```bash
./dev.sh start       # Iniciar con hot reload
./dev.sh stop        # Detener contenedores
./dev.sh restart     # Reiniciar
./dev.sh shell       # Entrar al contenedor
./dev.sh cli [cmd]   # Ejecutar comandos CLI
./dev.sh logs        # Ver logs en tiempo real
./dev.sh test        # Ejecutar tests
./dev.sh lint        # Ejecutar linter
./dev.sh clean       # Limpiar todo (⚠️ borra datos)
```

📖 **Ver documentación completa:** [DOCKER_DEV.md](DOCKER_DEV.md)

---

### Opción B: Desarrollo Local

Si prefieres desarrollar directamente en tu máquina:

#### Prerrequisitos

- Node.js >= 22.0 ([descargar](https://nodejs.org/))
- npm o yarn
- GitHub CLI (`gh`) autenticado
- Cuenta de GitHub

#### Setup Inicial

```bash
# 1. Fork y clone
git clone https://github.com/tu-usuario/swarm-cli.git
cd swarm-cli

# 2. Instalar dependencias
npm install

# 3. Configurar entorno
cp .env.example .env
# Editar .env con tus credenciales:
# - GITHUB_TOKEN=tu_token
# - OPENAI_API_KEY=tu_key (opcional)

# 4. Verificar instalación
npm run build
npm test

# 5. Iniciar en modo desarrollo
npm run dev
```

#### Scripts de Desarrollo

```bash
npm run dev          # Iniciar backend con ts-node
npm run cli          # Ejecutar CLI
npm run build        # Compilar TypeScript
npm run test         # Ejecutar tests
npm run lint         # Ejecutar ESLint
npm run test:watch   # Tests en modo watch
```

### Estructura del Proyecto

```
src/
├── agents/           # Agentes especializados (Planner, Coder, Tester, etc.)
│   ├── base-agent.ts
│   ├── agent-registry.ts
│   └── definitions/
├── backend/          # API REST y servidor
│   ├── api/
│   │   ├── server.ts
│   │   └── routes/
│   ├── index.ts
│   └── orchestrator-instance.ts
├── cli/              # Interfaz de línea de comandos
│   ├── index.ts      # Entry point
│   ├── ai/           # Modo AI (JSON/YAML)
│   └── human/        # Modo interactivo
├── core/             # Lógica core del orquestador
│   └── orchestrator.ts
├── github-sync/      # Integración con GitHub
│   ├── github-client.ts
│   ├── issue-sync.ts
│   ├── project-sync.ts
│   └── worktree-manager.ts
├── persistence/      # Persistencia de datos
│   └── sqlite/
└── utils/            # Utilidades
    ├── config-loader.ts
    └── logger.ts
```

### Flujo de Trabajo de Desarrollo

```bash
# 1. Crear rama de feature
git checkout -b feature/mi-nueva-feature

# 2. Desarrollar con hot reload activo
npm run dev
# O con Docker:
# ./dev.sh start

# 3. Ejecutar tests continuamente
npm run test:watch

# 4. Antes de commitear
npm run lint
npm run build
npm test

# 5. Commit siguiendo Conventional Commits
git commit -m "feat: add new agent type for code review"

# 6. Push y PR
git push origin feature/mi-nueva-feature
# Crear Pull Request en GitHub
```

### Guías de Contribución

1. **Crear un issue primero**: Describe el bug o feature
2. **Fork + Branch**: `git checkout -b feature/nueva-funcionalidad`
3. **Commits descriptivos**: Seguimos [Conventional Commits](https://www.conventionalcommits.org/)
4. **Tests obligatorios**: Toda nueva funcionalidad debe incluir tests
5. **Documentación**: Actualizar README.md si es necesario
6. **PR**: Crear pull request con descripción clara

### Reportar Bugs

Usa GitHub Issues con este formato:

```markdown
**Descripción**: Breve descripción del problema
**Pasos para reproducir**:
1. Paso 1
2. Paso 2
**Comportamiento esperado**: Qué debería pasar
**Comportamiento actual**: Qué pasa realmente
**Entorno**: Node version, OS, etc.
```

---

## 🐛 Debugging

### Debuggear con VS Code

1. **Instalar la extensión** [JavaScript Debugger](https://marketplace.visualstudio.com/items?itemName=ms-vscode.js-debug)

2. **Crear configuración** `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Backend",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "npx",
      "runtimeArgs": ["ts-node", "--transpile-only"],
      "args": ["src/backend/index.ts"],
      "env": {
        "NODE_ENV": "development",
        "DEBUG": "*"
      },
      "skipFiles": ["<node_internals>/**"],
      "console": "integratedTerminal"
    },
    {
      "name": "Debug CLI",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "npx",
      "runtimeArgs": ["ts-node"],
      "args": ["src/cli/index.ts", "${input:cliCommand}"],
      "console": "integratedTerminal"
    },
    {
      "name": "Attach to Docker",
      "type": "node",
      "request": "attach",
      "port": 9229,
      "address": "localhost",
      "localRoot": "${workspaceFolder}",
      "remoteRoot": "/app"
    }
  ],
  "inputs": [
    {
      "id": "cliCommand",
      "type": "promptString",
      "description": "Comando CLI a debuggear",
      "default": "status"
    }
  ]
}
```

3. **Presionar F5** para iniciar debugging

### Debuggear con Docker

```bash
# 1. Iniciar contenedor con debugger expuesto
./dev.sh start

# 2. En otra terminal, conectar debugger
node --inspect-brk=0.0.0.0:9229 src/backend/index.ts

# 3. Abrir Chrome DevTools
# chrome://inspect → Click "Open dedicated DevTools for Node"
# O usar VS Code con la config "Attach to Docker"
```

### Debuggear con Chrome DevTools

```bash
# Iniciar con inspector
node --inspect-brk -r ts-node/register src/backend/index.ts

# O en package.json agregar:
# "debug": "node --inspect-brk -r ts-node/register src/backend/index.ts"
npm run debug
```

Luego abre `chrome://inspect` en Chrome.

### Logs de Debug

```bash
# Habilitar logs verbose
DEBUG=* npm run dev

# Filtrar por namespace
DEBUG=swarm:* npm run dev
DEBUG=swarm:orchestrator npm run dev

# Con Docker
DEBUG=* ./dev.sh start
```

### Debuggear Tests

```bash
# Debuggear tests con Node inspector
node --inspect-brk node_modules/.bin/jest --runInBand

# O con npm
npm run test:debug
```

### Troubleshooting Común

| Problema | Solución |
|----------|----------|
| `Cannot find module` | Ejecutar `npm run build` o `npm install` |
| `Permission denied` | `chmod +x src/cli/index.ts` |
| Puerto 3000 ocupado | `lsof -ti:3000 \| xargs kill -9` o cambiar PORT en .env |
| Error de SQLite | Verificar permisos de escritura en `./data` |
| Hot reload no funciona | Verificar volumen montado: `docker-compose ps` |

### Variables de Entorno de Debug

```bash
# .env
NODE_ENV=development
DEBUG=swarm:*
DEBUG_COLORS=true
DEBUG_DEPTH=10
```

---

### Roadmap

Ver [ROADMAP.md](ROADMAP.md) para features planificados.

---

## 📚 Documentación Adicional

### Recursos y Referencias

| Recurso | Descripción | Link |
|---------|-------------|------|
| **OpenFang** | Documentación oficial de OpenFang | <https://www.openfang.sh/docs> |
| **Paperclip AI** | Framework de agentes para research | <https://github.com/paperclipai/paperclip> |
| **GSD (Get Shit Done)** | Framework de productividad con agentes | <https://github.com/gsd-build/get-shit-done> |

### Papers Relevantes

#### Agents of Chaos (arXiv:2602.20021)
Estudio de red-teaming exploratorio sobre agentes autónomos con memoria persistente, acceso a email, Discord, filesystem y ejecución de shell.

**Hallazgos clave:**
- 11 casos de estudio de fallos en sistemas agenticos
- Comportamientos observados: cumplimiento no autorizado, divulgación de información sensible, acciones destructivas, DoS, consumo descontrolado de recursos, spoofing de identidad
- Los agentes reportaban tareas completadas mientras el estado del sistema contradecía esos reportes

**Autores:** Natalie Shapira, Chris Wendler, Avery Yen, et al. (Northeastern University, Stanford, MIT, Harvard, etc.)

**Link:** <https://arxiv.org/pdf/2602.20021>

### Documentación Interna

- [Arquitectura Backend](docs/architecture/backend.md)
- [Diagramas (Excalidraw)](docs/architecture/diagrams/)
- [Plan de Implementación](docs/plans/)
- [API Reference](docs/api.md)

---

## 📄 Licencia

MIT License - ver [LICENSE](LICENSE)

---

*Built with ❤️ using Mastra, Symphony patterns, and OpenClaw principles*
