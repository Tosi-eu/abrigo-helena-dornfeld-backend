#!/bin/bash

# Script para inicializar os bancos de dados (criar se não existirem)

echo "🚀 Inicializando bancos de dados..."
echo ""

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para criar banco se não existir
create_database_if_not_exists() {
    local container_name=$1
    local db_name=$2
    local user=$3
    local password=$4
    
    echo -e "${BLUE}📦 Verificando banco '$db_name' em $container_name...${NC}"
    
    # Verificar se banco existe
    if docker exec "$container_name" psql -U "$user" -lqt | cut -d \| -f 1 | grep -qw "$db_name"; then
        echo -e "${GREEN}✓ Banco '$db_name' já existe${NC}"
    else
        echo -e "${YELLOW}⚠ Banco '$db_name' não existe. Criando...${NC}"
        
        # Criar banco
        if docker exec "$container_name" psql -U "$user" -c "CREATE DATABASE $db_name;" 2>&1; then
            echo -e "${GREEN}✓ Banco '$db_name' criado com sucesso!${NC}"
        else
            echo -e "${RED}❌ Erro ao criar banco '$db_name'${NC}"
            return 1
        fi
    fi
    
    # Verificar conexão
    if docker exec "$container_name" psql -U "$user" -d "$db_name" -c "SELECT 1;" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Conexão ao banco '$db_name' funcionando${NC}"
    else
        echo -e "${RED}❌ Não foi possível conectar ao banco '$db_name'${NC}"
        return 1
    fi
    
    echo ""
    return 0
}

# Verificar se containers estão rodando
if ! docker ps | grep -q "postgres$"; then
    echo -e "${YELLOW}⚠ Container postgres não está rodando. Iniciando...${NC}"
    docker-compose up -d postgres
    sleep 3
fi

if ! docker ps | grep -q "postgres_test"; then
    echo -e "${YELLOW}⚠ Container postgres_test não está rodando. Iniciando...${NC}"
    docker-compose up -d postgres_test
    sleep 3
fi

# Aguardar PostgreSQL ficar pronto
echo -e "${BLUE}⏳ Aguardando PostgreSQL ficar pronto...${NC}"
for i in {1..30}; do
    if docker exec postgres pg_isready -U postgres > /dev/null 2>&1 && \
       docker exec postgres_test pg_isready -U postgres > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PostgreSQL está pronto!${NC}"
        echo ""
        break
    fi
    echo -n "."
    sleep 1
done
echo ""

# Criar banco de produção
create_database_if_not_exists "postgres" "estoque_armarios" "postgres" "postgres"

# Criar banco de testes
create_database_if_not_exists "postgres_test" "estoque_armarios_test" "postgres" "postgres"

echo ""
echo -e "${GREEN}✅ Inicialização concluída!${NC}"
echo ""
echo "📊 Status final:"
docker-compose ps postgres postgres_test

