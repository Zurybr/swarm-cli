# OpenCode Swarm Plugin

MCP (Model Context Protocol) server que proporciona herramientas Swarm CLI para integración con opencode.

## Instalación

### Opción 1: Instalación Global (Recomendada)

```bash
npm install -g opencode-swarm-plugin
```

### Opción 2: Instalación Local con Link

```bash
cd /ruta/al/proyecto/swarm-cli
npm link
```

Luego en cualquier proyecto:
```bash
npm link opencode-swarm-plugin
```

### Opción 3: Desarrollo

```bash
cd /ruta/al/proyecto/swarm-cli
npm run build
npm link
```

## Uso en OpenCode

Una vez instalado, el comando `/swarm` estará disponible en opencode.

## Herramientas MCP Disponibles

- `swarm_status` - Obtener estado del sistema swarm
- `hive_cells` - Listar celdas con filtros
- `hive_create` - Crear nueva celda
- `hive_update` - Actualizar celda existente
- `hive_start` - Marcar celda como en progreso
- `hive_close` - Completar/cerrar celda
- `hive_ready` - Obtener siguiente celda lista
- `hive_sync` - Sincronizar con git
- `swarm_review_feedback` - Enviar feedback de revisión

## Configuración

El plugin usa el directorio `.hive/` en el proyecto actual para almacenar las celdas.

## Desarrollo

```bash
# Construir
npm run build

# Modo desarrollo
npm run dev
```

## Licencia

MIT
