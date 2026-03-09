#!/bin/sh
# Script de entrada para desarrollo con hot reload

set -e

echo "🐳 Swarm CLI - Modo Desarrollo"
echo "================================"

# Verificar que el volumen esté montado
if [ ! -f "/app/src/cli/index.ts" ]; then
    echo "⚠️  Volumen no montado correctamente. Esperando..."
    sleep 2
fi

# Si hay cambios en package.json, reinstalar dependencias
if [ -f "/app/package.json" ]; then
    if [ ! -d "/app/node_modules" ] || [ "/app/package.json" -nt "/app/node_modules/.install-timestamp" ]; then
        echo "📦 Instalando dependencias..."
        cd /app && npm install
        touch /app/node_modules/.install-timestamp
        echo "✅ Dependencias instaladas"
    fi
fi

# Crear directorios necesarios si no existen
mkdir -p /app/data
mkdir -p /app/logs

echo "🚀 Iniciando en modo desarrollo con hot reload..."
echo "   - Cambios en src/ se reflejan automáticamente"
echo "   - API disponible en http://localhost:3000"
echo ""

# Ejecutar el comando proporcionado
exec "$@"
