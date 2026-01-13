#!/bin/bash

# Script para inicializar e verificar os bancos de dados

echo "🚀 Inicializando bancos de dados..."
echo ""

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para aguardar banco ficar pronto
wait_for_db() {
    local container_name=$1
    local max_attempts=30
    local attempt=0
    
    echo -e "${BLUE}⏳ Aguardando $container_name ficar pronto...${NC}"
    
    while [ $attempt -lt $max_attempts ]; do
        if docker exec "$container_name" pg_isready -U postgres > /dev/null 2>&1; then
            echo -e "${GREEN}✓ $container_name está pronto!${NC}"
            return 0
        fi
        
        attempt=$((attempt + 1))
        echo -n "."
        sleep 1
    done
    
    echo ""
    echo -e "${RED}❌ Timeout aguardando $container_name${NC}"
    return 1
}

# Verificar se Docker está rodando
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker não está rodando!${NC}"
    exit 1
fi

# Iniciar containers se não estiverem rodando
echo -e "${BLUE}📦 Verificando containers...${NC}"

if ! docker ps | grep -q "postgres$"; then
    echo "Iniciando postgres..."
    docker-compose up -d postgres
fi

if ! docker ps | grep -q "postgres_test"; then
    echo "Iniciando postgres_test..."
    docker-compose up -d postgres_test
fi

echo ""

# Aguardar bancos ficarem prontos
wait_for_db "postgres"
wait_for_db "postgres_test"

echo ""
echo -e "${GREEN}✅ Todos os bancos estão prontos!${NC}"
echo ""
echo "📊 Status dos containers:"
docker-compose ps postgres postgres_test

echo ""
echo "🔍 Testando conexões..."

# Testar banco de produção
if docker exec postgres psql -U postgres -d estoque_armarios -c "SELECT version();" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Banco de produção acessível${NC}"
else
    echo -e "${YELLOW}⚠ Banco de produção ainda não tem o banco criado (será criado na primeira conexão)${NC}"
fi

# Testar banco de testes
if docker exec postgres_test psql -U postgres -d estoque_armarios_test -c "SELECT version();" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Banco de testes acessível${NC}"
else
    echo -e "${YELLOW}⚠ Banco de testes ainda não tem o banco criado (será criado na primeira conexão)${NC}"
fi

echo ""
echo "✅ Setup concluído!"

