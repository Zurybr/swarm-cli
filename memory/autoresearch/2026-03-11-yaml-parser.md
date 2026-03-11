# Autoresearch — 2026-03-11 (Heartbeat 08:38)

## Tema: YAML Parser Libraries para Node.js/TypeScript

### Opciones Evaluadas

#### [js-yaml](https://github.com/nodeca/js-yaml)
- **Stars:** 4k+ | **Downloads:** 20M+/semana
- **Performance:** 403,658 ops/sec
- **Pros:** Industry standard, ligero, muy rápido, API simple
- **Cons:** Solo YAML 1.2 por defecto
- **Fit:** **ALTO** — Standard de facto, más usado

#### [yaml](https://www.npmjs.com/package/yaml)
- **Stars:** 1.3k+ | **Downloads:** 13M+/semana  
- **Performance:** 83,989 ops/sec
- **Pros:** Soporta YAML 1.1 y 1.2, mejor soporte TypeScript, maneja comments
- **Cons:** Más lento, API más compleja
- **Fit:** Medio — Bueno pero overkill para nuestro caso

#### [yaml-js](https://github.com/connec/yaml-js)
- **Performance:** 559,639 ops/sec (más rápido)
- **Pros:** Más seguro, pure JavaScript
- **Cons:** Menos popular, menos mantenido
- **Fit:** Bajo — No vale cambiar lo estándar

### Decisión

**Elegida: js-yaml**

Razones:
1. Industry standard — todo el mundo lo conoce
2. Performance suficiente (400k+ ops/sec)
3. API simple: `yaml.load()`, `yaml.dump()`
4. Tipos disponibles en @types/js-yaml
5. Mantiene backward compat con JSONL fácilmente

### Implementación

```typescript
import * as yaml from 'js-yaml';

// Cargar agente desde YAML
const agentConfig = yaml.load(fs.readFileSync('agent.yaml', 'utf8'));

// Soportar tanto .yaml como .yml
// Validar estructura contra schema existente
// Mantener compatibilidad con JSONL actual
```

### Acción

- [x] Instalar js-yaml → `npm install js-yaml`
- [x] Instalar tipos → `npm install -D @types/js-yaml`
- [ ] Implementar función loadYamlConfig()
- [ ] Agregar flag --config a CLI
- [ ] Tests básicos
