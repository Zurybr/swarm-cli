#!/bin/bash
# Script de conveniencia para desarrollo con Docker

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

show_help() {
    echo -e "${BLUE}🐳 Swarm CLI - Entorno de Desarrollo Docker${NC}"
    echo ""
    echo "Uso: ./dev.sh [comando]"
    echo ""
    echo "Comandos:"
    echo "  start       - Iniciar desarrollo con hot reload"
    echo "  stop        - Detener contenedores"
    echo "  restart     - Reiniciar contenedores"
    echo "  build       - Construir/reconstruir imagen"
    echo "  shell       - Entrar a shell interactivo"
    echo "  cli [args]  - Ejecutar comando del CLI"
    echo "  test        - Ejecutar tests"
    echo "  lint        - Ejecutar linter"
    echo "  logs        - Ver logs en tiempo real"
    echo "  status      - Ver estado de contenedores"
    echo "  clean       - Limpiar TODO (⚠️  borra datos)"
    echo ""
    echo "Ejemplos:"
    echo "  ./dev.sh start"
    echo "  ./dev.sh cli init"
    echo "  ./dev.sh cli task create"
    echo ""
}

cmd_start() {
    echo -e "${GREEN}🚀 Iniciando Swarm CLI con hot reload...${NC}"
    echo -e "${YELLOW}   Los cambios en src/ se reflejarán automáticamente${NC}"
    echo ""
    docker-compose up swarm-cli
}

cmd_stop() {
    echo -e "${YELLOW}🛑 Deteniendo contenedores...${NC}"
    docker-compose down
}

cmd_restart() {
    echo -e "${YELLOW}🔄 Reiniciando...${NC}"
    docker-compose restart swarm-cli
}

cmd_build() {
    echo -e "${BLUE}🔨 Construyendo imagen de desarrollo...${NC}"
    docker-compose build --no-cache
    echo -e "${GREEN}✅ Imagen construida${NC}"
}

cmd_shell() {
    echo -e "${BLUE}🐚 Abriendo shell...${NC}"
    docker-compose exec swarm-cli /bin/sh
}

cmd_cli() {
    echo -e "${GREEN}⚡ Ejecutando Swarm CLI...${NC}"
    docker-compose exec -T swarm-cli npx ts-node src/cli/index.ts "$@"
}

cmd_test() {
    echo -e "${BLUE}🧪 Ejecutando tests...${NC}"
    docker-compose exec swarm-cli npm test
}

cmd_lint() {
    echo -e "${BLUE}🔍 Ejecutando linter...${NC}"
    docker-compose exec swarm-cli npm run lint
}

cmd_logs() {
    echo -e "${BLUE}📋 Logs (Ctrl+C para salir)...${NC}"
    docker-compose logs -f swarm-cli
}

cmd_status() {
    echo -e "${BLUE}📊 Estado:${NC}"
    docker-compose ps
}

cmd_clean() {
    echo -e "${RED}⚠️  Esto eliminará todos los contenedores y volúmenes${NC}"
    read -p "¿Continuar? [y/N]: " confirm
    if [[ $confirm == [yY] || $confirm == [yY][eE][sS] ]]; then
        echo -e "${YELLOW}🧹 Limpiando...${NC}"
        docker-compose down -v --remove-orphans
        echo -e "${GREEN}✅ Limpieza completada${NC}"
    else
        echo "Cancelado"
    fi
}

# Main
case "${1:-}" in
    start|up)
        cmd_start
        ;;
    stop|down)
        cmd_stop
        ;;
    restart)
        cmd_restart
        ;;
    build)
        cmd_build
        ;;
    shell)
        cmd_shell
        ;;
    cli)
        shift
        cmd_cli "$@"
        ;;
    test)
        cmd_test
        ;;
    lint)
        cmd_lint
        ;;
    logs)
        cmd_logs
        ;;
    status|ps)
        cmd_status
        ;;
    clean)
        cmd_clean
        ;;
    help|--help|-h|"")
        show_help
        ;;
    *)
        echo -e "${RED}❌ Comando desconocido: $1${NC}"
        echo ""
        show_help
        exit 1
        ;;
esac
