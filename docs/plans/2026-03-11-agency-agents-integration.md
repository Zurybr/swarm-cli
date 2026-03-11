# Agency Agents Full Integration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrar completamente los 112+ agentes de agency-agents como agentes por defecto en swarm-cli, reemplazando/extendiendo las definiciones actuales.

**Architecture:** Expandir `src/agents/definitions/agency-agents.ts` para incluir todos los agentes organizados por división, crear sistema de activación por roles, y CLI para contratar/despedir agentes.

**Tech Stack:** TypeScript, Commander.js, sistema actual de agentes de swarm-cli

---

## Contexto Actual

- Ya existe `src/agents/definitions/agency-agents.ts` con ~12 agentes
- El CLI tiene comandos básicos de agentes
- Necesitamos expandir a 112+ agentes de agency-agents

---

### Task 1: Backup del archivo actual

**Files:**
- Backup: `src/agents/definitions/agency-agents.ts` → `src/agents/definitions/agency-agents.ts.backup`

**Step 1: Crear backup**

```bash
cp src/agents/definitions/agency-agents.ts src/agents/definitions/agency-agents.ts.backup
```

**Step 2: Verificar backup**

```bash
ls -la src/agents/definitions/
```

Expected: archivo backup creado

---

### Task 2: Crear definiciones completas de agentes

**Files:**
- Modify: `src/agents/definitions/agency-agents.ts`

**Step 1: Reemplazar con definiciones completas (60+ agentes principales)**

Escribir el archivo con:
- Todos los agentes de Engineering Division
- Todos los agentes de Testing Division
- Todos los agentes de Project Management Division
- Agentes clave de otras divisiones
- Interfaz AgencyAgent mejorada
- Funciones helper para filtrado

**Step 2: Verificar sintaxis TypeScript**

```bash
npx tsc --noEmit src/agents/definitions/agency-agents.ts
```

Expected: No errors

**Step 3: Commit**

```bash
git add src/agents/definitions/agency-agents.ts
git commit -m "feat(agents): add complete agency-agents definitions (60+ agents)"
```

---

### Task 3: Actualizar CLI de agentes

**Files:**
- Modify: `src/agents/cli.ts`

**Step 1: Agregar comandos para listar agentes por división**

Agregar:
- `swarm-cli agents:list` - listar todos
- `swarm-cli agents:list --division Engineering` - filtrar por división
- `swarm-cli agents:info <agent-id>` - info detallada
- `swarm-cli agents:hire <agent-id>` - activar para proyecto

**Step 2: Verificar build**

```bash
npm run build
```

Expected: Build exitoso

**Step 3: Commit**

```bash
git add src/agents/cli.ts
git commit -m "feat(agents): add CLI commands for agency agents management"
```

---

### Task 4: Crear sistema de activación de agentes

**Files:**
- Create: `src/agents/activation.ts`

**Step 1: Crear sistema de activación**

Implementar:
- `activateAgent(projectPath, agentId)` - activar agente en proyecto
- `deactivateAgent(projectPath, agentId)` - desactivar
- `getActiveAgents(projectPath)` - listar activos
- Guardar estado en `.swarm/agents.json`

**Step 2: Test básico**

```bash
npm test -- --testPathPattern=activation
```

Expected: Tests pasan

**Step 3: Commit**

```bash
git add src/agents/activation.ts
git commit -m "feat(agents): add agent activation system"
```

---

### Task 5: Actualizar index.ts de agentes

**Files:**
- Modify: `src/agents/index.ts`

**Step 1: Exportar nuevas funcionalidades**

Agregar exports:
- `AGENCY_AGENTS`
- `getAgentByRole`
- `getAgentsByDivision`
- Funciones de activation.ts

**Step 2: Verificar build**

```bash
npm run build
```

Expected: Sin errores

**Step 3: Commit**

```bash
git add src/agents/index.ts
git commit -m "feat(agents): export agency agents and activation system"
```

---

### Task 6: Agregar agentes por defecto al iniciar proyecto

**Files:**
- Modify: `src/cli/index.ts` o archivo de inicialización

**Step 1: Modificar init para incluir agentes por defecto**

Al crear nuevo proyecto, activar automáticamente:
- `architect` (coordinador)
- `coder` (implementación)
- `reviewer` (code review)
- `realityChecker` (quality gates)
- `testEngineer` (testing)

**Step 2: Commit**

```bash
git add src/cli/index.ts
git commit -m "feat(agents): auto-activate default agents on project init"
```

---

### Task 7: Documentación

**Files:**
- Create: `docs/agency-agents.md`

**Step 1: Crear documentación**

Incluir:
- Lista de todas las divisiones
- Cómo contratar agentes
- Cómo activar/desactivar
- Ejemplos de uso

**Step 2: Commit**

```bash
git add docs/agency-agents.md
git commit -m "docs: add agency agents documentation"
```

---

### Task 8: Commit de los issues

**Files:**
- Modify: `.hive/issues.jsonl`

**Step 1: Agregar issues nuevos**

Agregar entries para:
- Integración completa agency-agents
- Sistema de activación
- CLI mejorado

**Step 2: Commit**

```bash
git add .hive/issues.jsonl
git commit -m "chore(issues): add agency-agents integration issues"
```

---

### Task 9: Push de commits

**Step 1: Verificar commits**

```bash
git log --oneline -10
```

**Step 2: Push a origin**

```bash
git push origin master
```

---

### Task 10: Crear Pull Request

**Step 1: Crear PR via GitHub CLI**

```bash
gh pr create \
  --title "feat: integrate complete agency-agents (112+ specialized agents)" \
  --body "## 🎭 Agency Agents Integration

This PR adds 60+ specialized agents from agency-agents as default agents in swarm-cli.

### ✨ What's New

- **60+ Production-ready agents** organized by division
- **Engineering**: Frontend Dev, Backend Architect, DevOps, AI Engineer, Security
- **Testing**: Evidence Collector, Reality Checker, API Tester
- **Project Management**: Project Shepherd, Studio Producer
- **Marketing**: Growth Hacker, Content Creator
- **And more...**

### 🚀 Features

- List agents by division: 
  \`swarm-cli agents:list --division Engineering\`
- Activate agents for project: 
  \`swarm-cli agents:hire frontendDeveloper\`
- Auto-activation of core agents on project init

### 📁 Files Changed

- \`src/agents/definitions/agency-agents.ts\` - Complete agent definitions
- \`src/agents/cli.ts\` - New CLI commands
- \`src/agents/activation.ts\` - Agent activation system
- \`docs/agency-agents.md\` - Documentation

### 🔗 Source

https://github.com/msitarzewski/agency-agents (MIT License)" \
  --base master
```

**Expected:** PR creado exitosamente

---

## Post-Implementation

1. Verificar PR en GitHub
2. Asegurar que todos los checks pasen
3. Solicitar review si es necesario
