# 🐳 Desarrollo con Docker - Hot Reload

Desarrolla **sin instalar nada** en tu máquina. Node.js, TypeScript y todas las dependencias corren dentro del contenedor.

## 🚀 Inicio Rápido

```bash
# 1. Iniciar desarrollo con hot reload
./dev.sh start

# Listo! La API está en http://localhost:3000
# Cualquier cambio en src/ se refleja automáticamente
```

## 📋 Comandos Disponibles

### Opción 1: Script `dev.sh` (recomendado)

```bash
./dev.sh start      # Iniciar con hot reload
./dev.sh stop       # Detener
./dev.sh restart    # Reiniciar
./dev.sh build      # Reconstruir imagen
./dev.sh shell      # Shell interactivo
./dev.sh logs       # Ver logs
./dev.sh status     # Estado de contenedores
./dev.sh clean      # Limpiar TODO
```

### Opción 2: Makefile

```bash
make dev        # Iniciar
make down       # Detener
make shell      # Shell interactivo
make cli        # Ejecutar CLI
make test       # Tests
make lint       # Linter
make logs       # Logs
make clean      # Limpiar
```

### Opción 3: Docker Compose directo

```bash
docker-compose up swarm-cli           # Iniciar
docker-compose down                   # Detener
docker-compose exec swarm-cli /bin/sh # Shell
```

## ⚡ Usando el CLI

```bash
# Inicializar proyecto
./dev.sh cli init

# Crear tarea
./dev.sh cli task create

# Ver estado
./dev.sh cli status

# O entrar al shell y ejecutar comandos manualmente
./dev.sh shell
# Dentro del contenedor:
npx ts-node src/cli/index.ts [comando]
```

## 🔥 Hot Reload

Los cambios en los archivos se reflejan **instantáneamente**:

| Archivo | Acción |
|---------|--------|
| `src/**/*.ts` | Reinicio automático del servidor |
| `package.json` | Reinstala dependencias automáticamente |
| `tsconfig.json` | Recarga configuración |

## 📁 Estructura de Volúmenes

```
./src        → /app/src        (código fuente, hot reload)
./package.json → /app/package.json (dependencias)
./tsconfig.json → /app/tsconfig.json (config)
node_modules (volumen) → /app/node_modules (persistido)
swarm-data (volumen) → /app/data (SQLite, datos persistentes)
./logs       → /app/logs       (logs del sistema)
```

## 🔧 Variables de Entorno

Crea un archivo `.env` en la raíz:

```env
NODE_ENV=development
PORT=3000
DEBUG=true
GITHUB_TOKEN=tu_token_aqui
OPENAI_API_KEY=tu_key_aqui
```

## 🐛 Debugging

El contenedor expone el puerto `9229` para debugging con Node.js:

```bash
# Conectar debugger (VS Code, Chrome DevTools, etc)
# La configuración ya está en docker-compose.yml
```

## 💡 Tips

1. **Primera vez**: El build inicial puede tardar 1-2 minutos
2. **Cambios en dependencias**: El contenedor detecta cambios en `package.json` y reinstala automáticamente
3. **Datos persistentes**: SQLite y configuración se guardan en el volumen `swarm-data`
4. **Logs**: Usa `./dev.sh logs` para ver logs en tiempo real
5. **Problemas**: Usa `./dev.sh clean` y luego `./dev.sh start` para empezar de cero

## 🧹 Limpieza

```bash
# Limpiar contenedores y volúmenes
./dev.sh clean

# O manualmente:
docker-compose down -v
docker system prune -f
```

## 📦 Requisitos

- Docker Engine 20.10+
- Docker Compose 2.0+
- **Nada más** (ni Node.js, ni npm, ni TypeScript)

---

✨ Desarrollo 100% containerizado con hot reload!
