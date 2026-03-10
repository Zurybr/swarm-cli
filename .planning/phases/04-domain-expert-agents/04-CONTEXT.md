# Phase 04: Domain Expert Agents - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Crear 3 agentes especializados de dominio usando el sistema de composición de la Fase 3:
- Security Review Agent: escaneo de secretos, vulnerabilidades, patrones inseguros
- Performance Agent: análisis de complejidad, detección de cuellos de botella
- Documentation Agent: generación de docs JSDoc, detección de drift, README

Los agentes expertos complementan (no reemplazan) los 61 agency agents existentes.
Las definiciones viven en `src/skills/expert-definitions/`.

</domain>

<decisions>
## Implementation Decisions

### Estructura del Agente
- Extender el patrón AgencyAgent existente agregando el campo `skills[]`
- Ubicación: `src/skills/expert-definitions/` (cerca de las definiciones de skills)
- Los expertos USAN el SkillRegistry para obtener sus skills (no se registran como skills)
- Propiedades adicionales: `skills[]` + `capabilities[]` + `expertiseLevel`

### Granularidad de Skills
- Skills monolíticos: un skill principal por agente experto
- Configuración vía parámetros de entrada del task (task input define comportamiento)
- Internamente el skill puede usar otros skills como subrutinas (composición interna)
- En caso de fallo parcial: retornar resultado parcial con findings + lista de errores

### Capacidades de los Expertos

**Security Review Agent:**
- Detectar secretos (API keys, passwords, tokens)
- Escanear dependencias contra base de datos de vulnerabilidades (CVEs)
- Análisis de patrones inseguros (SQL injection, XSS)
- Escaneo de configuraciones
- Evaluación de riesgos

**Performance Agent:**
- Métricas básicas: complejidad ciclomática, funciones largas
- Identificar patrones ineficientes: nested loops, N+1 queries, memory leaks

**Documentation Agent:**
- Generar JSDoc para funciones/clases sin documentación
- Detectar documentación desactualizada (drift)
- Generar README de módulos
- Ejemplos de uso
- Mantener wiki actualizada

### Invocación de Expertos
- Enfoque híbrido: CLI + API interna
- CLI: comandos específicos (`swarm security-scan`, `swarm perf-analyze`)
- La CLI llama a una API interna
- Otros agentes también invocan expertos vía la misma API

### Modo de Integración
- Los expertos COMPLEMENTAN a los agency agents (no reemplazan)
- El agency agent USA el experto como herramienta especializada
- Algunos expertos son atómicos, otros pueden estar compuestos
- Formatos de salida: JSON estructurado (para agency agents) + Markdown (para humanos)

### Claude's Discretion
- Implementación específica de la API interna de expertos
- Detalles de cómo los skills monolíticos llaman internamente a sub-skills
- Estructura exacta de los reportes Markdown
- Cómo se detecta documentación desactualizada (drift detection)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AgentBuilder` (`src/agents/builder/agent-builder.ts`): Fluent API para componer skills
- `ComposedAgent` (`src/agents/builder/composed-agent.ts`): Clase base para agentes con skill chain
- `SkillChain` + `SkillChainExecutor`: Ejecución secuencial de skills con data flow
- AgencyAgent pattern (`src/agents/definitions/agency-agents.ts`): 61 agentes definidos con id, name, personality, tools, workflow
- Categories de skills: 'security' | 'performance' | 'documentation' | 'testing' | 'general'

### Established Patterns
- Agregar campo `skills[]` a AgencyAgent mantiene compatibilidad hacia atrás
- Skills con categoría específica (security, performance, documentation) para descubrimiento
- ComposedAgent extiende BaseAgent para integración con orquestador existente

### Integration Points
- CLI en `src/agents/cli.ts` para agregar comandos de expertos
- `src/skills/expert-definitions/` - directorio nuevo para definiciones de expertos
- SkillRegistry ya tiene métodos para buscar skills por categoría

</code_context>

<specifics>
## Specific Ideas

- securityEngineer agency agent (existente) usará Security Review Expert como herramienta
- Los expertos producen output dual: JSON para procesamiento + Markdown para humanos
- Skills monolíticos con composición interna permiten flexibilidad sin exponer complejidad

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope

</deferred>

---

*Phase: 04-domain-expert-agents*
*Context gathered: 2026-03-10*
