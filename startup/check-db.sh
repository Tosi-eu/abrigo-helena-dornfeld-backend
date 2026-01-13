#!/bin/bash

# Script para verificar se os bancos de dados estão prontos

echo "🔍 Verificando status dos bancos de dados..."
echo ""

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Função para verificar banco
check_database() {
    local container_name=$1
    local db_name=$2
    local port=$3
    
    echo "📊 Verificando $container_name (porta $port)..."
    
    # Verificar se container está rodando
    if ! docker ps | grep -q "$container_name"; then
        echo -e "${RED}❌ Container $container_name não está rodando!${NC}"
        return 1
    fi
    
    # Verificar se PostgreSQL está pronto
    if docker exec "$container_name" pg_isready -U postgres > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PostgreSQL está pronto${NC}"
    else
        echo -e "${RED}❌ PostgreSQL não está pronto${NC}"
        return 1
    fi
    
    # Tentar conectar ao banco
    if docker exec "$container_name" psql -U postgres -lqt | cut -d \| -f 1 | grep -qw "$db_name"; then
        echo -e "${GREEN}✓ Banco de dados '$db_name' existe${NC}"
    else
        echo -e "${YELLOW}⚠ Banco de dados '$db_name' não encontrado (pode ser criado automaticamente)${NC}"
    fi
    
    # Testar conexão
    if docker exec "$container_name" psql -U postgres -d "$db_name" -c "SELECT 1;" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Conexão ao banco '$db_name' funcionando${NC}"
    else
        echo -e "${YELLOW}⚠ Não foi possível conectar ao banco '$db_name' (pode ser normal se ainda não foi criado)${NC}"
    fi
    
    echo ""
    return 0
}

# Verificar banco de produção
check_database "postgres" "estoque_armarios" "5433"

# Verificar banco de testes
check_database "postgres_test" "estoque_armarios_test" "5434"

echo "✅ Verificação concluída!"
echo ""
echo "💡 Dicas:"
echo "   - Se os containers não estão rodando: docker-compose up -d postgres postgres_test"
echo "   - Para ver logs: docker-compose logs postgres"
echo "   - Para reiniciar: docker-compose restart postgres postgres_test"

