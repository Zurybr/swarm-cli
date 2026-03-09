# Makefile para Swarm CLI - Desarrollo con Docker

.PHONY: help build up down shell cli logs clean rebuild

# Comando por defecto
help:
	@echo "🐳 Swarm CLI - Comandos de Desarrollo Docker"
	@echo "============================================="
	@echo ""
	@echo "  make build      - Construir imagen de desarrollo"
	@echo "  make up         - Iniciar contenedor con hot reload"
	@echo "  make down       - Detener contenedores"
	@echo "  make shell      - Entrar a shell interactivo"
	@echo "  make cli        - Ejecutar CLI de Swarm"
	@echo "  make logs       - Ver logs en tiempo real"
	@echo "  make test       - Ejecutar tests"
	@echo "  make lint       - Ejecutar linter"
	@echo "  make clean      - Limpiar contenedores y volúmenes"
	@echo "  make rebuild    - Reconstruir todo desde cero"
	@echo ""
	@echo "  make dev        - Alias de 'make up' (más rápido)"
	@echo ""

# Construir imagen
build:
	@echo "🔨 Construyendo imagen de desarrollo..."
	docker-compose build --no-cache

# Iniciar desarrollo con hot reload
up:
	@echo "🚀 Iniciando Swarm CLI con hot reload..."
	docker-compose up swarm-cli

# Iniciar en background
detach:
	@echo "🚀 Iniciando en segundo plano..."
	docker-compose up -d swarm-cli

# Detener contenedores
down:
	@echo "🛑 Deteniendo contenedores..."
	docker-compose down

# Shell interactivo
shell:
	@echo "🐚 Abriendo shell en el contenedor..."
	docker-compose exec swarm-cli /bin/sh

# Ejecutar CLI de Swarm
cli:
	@echo "⚡ Ejecutando Swarm CLI..."
	docker-compose exec swarm-cli npx ts-node src/cli/index.ts $(ARGS)

# Ver logs
logs:
	@echo "📋 Mostrando logs..."
	docker-compose logs -f swarm-cli

# Ejecutar tests
test:
	@echo "🧪 Ejecutando tests..."
	docker-compose exec swarm-cli npm test

# Ejecutar linter
lint:
	@echo "🔍 Ejecutando linter..."
	docker-compose exec swarm-cli npm run lint

# Limpiar todo
clean:
	@echo "🧹 Limpiando contenedores y volúmenes..."
	docker-compose down -v --remove-orphans
	docker system prune -f

# Reconstruir todo
rebuild:
	@echo "♻️  Reconstruyendo todo desde cero..."
	make clean
	make build
	make up

# Alias rápido
dev: up

# Comandos de desarrollo rápido
restart:
	@echo "🔄 Reiniciando contenedor..."
	docker-compose restart swarm-cli

status:
	@echo "📊 Estado de los contenedores:"
	docker-compose ps

# Comando para ejecutar cualquier script npm
npm:
	docker-compose exec swarm-cli npm $(CMD)
