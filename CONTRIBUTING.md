# Contributing to Swarm CLI

¡Gracias por tu interés en contribuir a Swarm CLI! 🎉

## Código de Conducta

Este proyecto sigue un código de conducta básico: sé respetuoso, constructivo, y asume buenas intenciones.

## Cómo Contribuir

### Reportar Bugs

1. Verifica si el bug ya fue reportado en [Issues](https://github.com/Zurybr/swarm-cli/issues)
2. Si no existe, crea un nuevo issue con:
   - Título descriptivo
   - Descripción clara del problema
   - Pasos para reproducir
   - Comportamiento esperado vs actual
   - Tu entorno (OS, Node version, etc.)

### Sugerir Features

1. Abre un issue con el label `enhancement`
2. Describe el feature y su caso de uso
3. Explica por qué sería útil

### Pull Requests

1. **Fork** el repositorio
2. **Crea una rama** desde `master`:
   ```bash
   git checkout -b feature/nueva-funcionalidad
   # o
   git checkout -b fix/bug-corregido
   ```
3. **Haz commits** siguiendo [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` nueva funcionalidad
   - `fix:` corrección de bug
   - `docs:` cambios en documentación
   - `test:` añadir tests
   - `refactor:` refactorización de código
   - `chore:` tareas de mantenimiento
4. **Asegúrate de que los tests pasen**:
   ```bash
   npm test
   ```
5. **Actualiza documentación** si es necesario
6. **Crea el PR** con descripción clara

## Setup de Desarrollo

### Requisitos

- Node.js >= 22.0
- npm >= 10.0
- GitHub CLI (`gh`) instalado y autenticado

### Instalación

```bash
# Clonar
git clone https://github.com/Zurybr/swarm-cli.git
cd swarm-cli

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env

# Ejecutar tests
npm test

# Modo desarrollo
npm run dev
```

## Estructura del Proyecto

```
src/
├── backend/          # API, WebSocket, Core logic
│   ├── core/         # Orchestrator, State Manager
│   ├── agents/       # Agent implementations
│   ├── github-sync/  # GitHub integration
│   └── persistence/  # SQLite, Vector, Graph
├── cli/              # Command line interface
│   ├── human/        # Interactive mode
│   └── ai/           # Structured mode
└── frontend/         # Web UI (future)
```

## Estilo de Código

- **TypeScript**: Tipado estricto
- **ESLint**: Seguir configuración del proyecto
- **Prettier**: Formato automático
- **Tests**: Jest con cobertura mínima 80%

## Preguntas?

Abre un issue con el label `question` o contáctanos vía GitHub Discussions.

---

¡Gracias por contribuir! 🚀
