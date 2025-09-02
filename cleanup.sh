#!/bin/bash

# Script de limpeza manual para arquivos temporários
# Pode ser executado independentemente do deploy

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🧹 Limpeza manual de arquivos temporários${NC}"
echo "=================================================="

cleaned_total=0

# 1. Limpar diretório temp/
if [ -d "temp" ]; then
    echo -e "${YELLOW}📁 Limpando diretório temp/...${NC}"
    temp_files=$(find temp/ -type f 2>/dev/null | wc -l)
    rm -rf temp/*.pdf 2>/dev/null || true
    rm -rf temp/*.tmp 2>/dev/null || true
    rm -rf temp/*.log 2>/dev/null || true
    rm -rf temp/*.json 2>/dev/null || true
    cleaned_total=$((cleaned_total + temp_files))
    echo "  • Removidos $temp_files arquivos temporários"
fi

# 2. Limpar logs antigos do PM2
if [ -d "$HOME/.pm2/logs" ]; then
    echo -e "${YELLOW}📋 Limpando logs antigos do PM2...${NC}"
    old_logs=$(find $HOME/.pm2/logs/ -name "*.log" -mtime +3 2>/dev/null | wc -l)
    find $HOME/.pm2/logs/ -name "*.log" -mtime +3 -delete 2>/dev/null || true
    cleaned_total=$((cleaned_total + old_logs))
    echo "  • Removidos $old_logs logs antigos"
fi

# 3. Limpar backups antigos do .env
if ls .env.backup.* 1> /dev/null 2>&1; then
    echo -e "${YELLOW}💾 Limpando backups antigos do .env...${NC}"
    old_backups=$(ls -t .env.backup.* 2>/dev/null | tail -n +6 | wc -l)
    ls -t .env.backup.* 2>/dev/null | tail -n +6 | xargs rm -f 2>/dev/null || true
    cleaned_total=$((cleaned_total + old_backups))
    echo "  • Removidos $old_backups backups antigos (mantidos os 5 mais recentes)"
fi

# 4. Limpar cache do node_modules
if [ -d "node_modules/.cache" ]; then
    echo -e "${YELLOW}🗂️  Limpando cache do Node.js...${NC}"
    cache_size=$(du -sh node_modules/.cache 2>/dev/null | cut -f1 || echo "0")
    rm -rf node_modules/.cache/* 2>/dev/null || true
    cleaned_total=$((cleaned_total + 1))
    echo "  • Cache removido ($cache_size)"
fi

# 5. Limpar arquivos de debug
if ls debug-*.js 1> /dev/null 2>&1; then
    echo -e "${YELLOW}🐛 Removendo arquivos de debug...${NC}"
    debug_files=$(ls debug-*.js 2>/dev/null | wc -l)
    rm -f debug-*.js 2>/dev/null || true
    cleaned_total=$((cleaned_total + debug_files))
    echo "  • Removidos $debug_files arquivos de debug"
fi

# 6. Limpar arquivos de teste temporários
if ls test-*.js 1> /dev/null 2>&1; then
    echo -e "${YELLOW}🧪 Removendo arquivos de teste temporários...${NC}"
    test_files=$(ls test-*.js 2>/dev/null | wc -l)
    rm -f test-*.js 2>/dev/null || true
    rm -f test-results.txt 2>/dev/null || true
    cleaned_total=$((cleaned_total + test_files))
    echo "  • Removidos $test_files arquivos de teste"
fi

echo ""
echo "=================================================="
echo -e "${GREEN}✅ Limpeza concluída!${NC}"
echo -e "${BLUE}📊 Total: $cleaned_total arquivos/diretórios removidos${NC}"

# Mostrar espaço liberado
if command -v du &> /dev/null; then
    current_size=$(du -sh . 2>/dev/null | cut -f1 || echo "N/A")
    echo -e "${BLUE}💽 Tamanho atual do projeto: $current_size${NC}"
fi
