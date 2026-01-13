#!/bin/bash

# Script de startup simples para substituir Electron
# Roda docker compose up e mostra loading screen enquanto aguarda

FRONTEND_URL="http://localhost:8081"
CHECK_INTERVAL=2
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOADING_HTML="$PROJECT_ROOT/loading.html"

# Função para verificar se o frontend está pronto
check_frontend_ready() {
    curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL" | grep -q "200"
}

# Função para limpar ao sair
cleanup() {
    echo -e "\n\nEncerrando aplicação..."
    docker compose down
    exit 0
}

# Capturar Ctrl+C e outros sinais de término
trap cleanup SIGINT SIGTERM

# Iniciar Docker Compose
echo "Iniciando Docker Compose..."
docker compose up -d

# Abrir loading screen no navegador padrão
if command -v xdg-open &> /dev/null; then
    # Linux
    xdg-open "$LOADING_HTML" 2>/dev/null &
elif command -v open &> /dev/null; then
    # macOS
    open "$LOADING_HTML" 2>/dev/null &
elif command -v start &> /dev/null; then
    # Windows (Git Bash)
    start "$LOADING_HTML" 2>/dev/null &
fi

# Aguardar frontend ficar pronto
echo "Aguardando aplicação ficar pronta..."
while ! check_frontend_ready; do
    sleep $CHECK_INTERVAL
done

# Abrir aplicação no navegador
echo "Aplicação pronta! Abrindo navegador..."
if command -v xdg-open &> /dev/null; then
    xdg-open "$FRONTEND_URL" 2>/dev/null
elif command -v open &> /dev/null; then
    open "$FRONTEND_URL" 2>/dev/null
elif command -v start &> /dev/null; then
    start "$FRONTEND_URL" 2>/dev/null
fi

echo "Aplicação iniciada em $FRONTEND_URL"
echo "Pressione Ctrl+C para encerrar"

# Manter script rodando
wait

