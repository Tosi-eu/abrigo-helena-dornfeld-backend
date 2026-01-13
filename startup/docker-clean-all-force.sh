#!/bin/bash

# Script para limpeza COMPLETA do Docker (SEM CONFIRMAÇÃO)
# ⚠️ ATENÇÃO: Este script remove TUDO sem pedir confirmação!
# Use apenas se tiver CERTEZA ABSOLUTA!

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${RED}⚠️  LIMPEZA COMPLETA DO DOCKER (SEM CONFIRMAÇÃO)${NC}"
echo -e "${BLUE}🚀 Iniciando limpeza...${NC}"
echo ""

# Parar e remover todos os containers
echo "📦 Parando e removendo containers..."
docker stop $(docker ps -aq) 2>/dev/null
docker rm -f $(docker ps -aq) 2>/dev/null

# Remover todas as imagens
echo "🖼️  Removendo imagens..."
docker rmi -f $(docker images -q) 2>/dev/null

# Remover todos os volumes
echo "💾 Removendo volumes..."
docker volume rm $(docker volume ls -q) 2>/dev/null

# Remover redes customizadas
echo "🌐 Removendo redes..."
docker network prune -f 2>/dev/null

# Limpeza final
echo "🧹 Limpeza final..."
docker system prune -af --volumes 2>/dev/null
docker builder prune -af 2>/dev/null

echo ""
echo -e "${GREEN}✅ Limpeza completa concluída!${NC}"

