#!/bin/bash

# Deploy script com revalidação automática de certificados SSL
# Autor: Sistema de Deploy Automatizado
# Data: $(date)

set -e  # Parar execução em caso de erro

echo "🚀 Iniciando deploy com revalidação SSL..."
echo "=================================================="

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variáveis
DOMAIN="iblogistica.ddns.net"
PROJECT_DIR=$(pwd)
SSL_DIR="$PROJECT_DIR/letsencrypt"
APP_NAME="testspdf"

echo -e "${BLUE}📍 Diretório do projeto: $PROJECT_DIR${NC}"
echo -e "${BLUE}🌐 Domínio: $DOMAIN${NC}"
echo ""

# 1. Verificar se PM2 está instalado
echo -e "${YELLOW}🔍 Verificando PM2...${NC}"
if ! command -v pm2 &> /dev/null; then
    echo -e "${RED}❌ PM2 não encontrado. Instalando...${NC}"
    npm install -g pm2
else
    echo -e "${GREEN}✅ PM2 encontrado${NC}"
fi

# 2. Parar aplicação se estiver rodando
echo -e "${YELLOW}⏸️  Parando aplicação...${NC}"
pm2 stop $APP_NAME 2>/dev/null || echo "Aplicação não estava rodando"

# 2.1. Limpeza de arquivos temporários
echo -e "${YELLOW}🧹 Limpando arquivos temporários...${NC}"
cleanup_temp_files() {
    local cleaned=0
    
    # Limpar diretório temp/
    if [ -d "temp" ]; then
        local temp_files=$(find temp/ -type f -name "*.pdf" 2>/dev/null | wc -l)
        rm -rf temp/*.pdf 2>/dev/null || true
        rm -rf temp/*.tmp 2>/dev/null || true
        rm -rf temp/*.log 2>/dev/null || true
        cleaned=$((cleaned + temp_files))
    fi
    
    # Limpar logs antigos do PM2
    if [ -d "$HOME/.pm2/logs" ]; then
        local old_logs=$(find $HOME/.pm2/logs/ -name "*.log" -mtime +7 2>/dev/null | wc -l)
        find $HOME/.pm2/logs/ -name "*.log" -mtime +7 -delete 2>/dev/null || true
        cleaned=$((cleaned + old_logs))
    fi
    
    # Limpar backups antigos do .env (manter apenas os 5 mais recentes)
    if ls .env.backup.* 1> /dev/null 2>&1; then
        local old_backups=$(ls -t .env.backup.* 2>/dev/null | tail -n +6 | wc -l)
        ls -t .env.backup.* 2>/dev/null | tail -n +6 | xargs rm -f 2>/dev/null || true
        cleaned=$((cleaned + old_backups))
    fi
    
    # Limpar node_modules/.cache se existir
    if [ -d "node_modules/.cache" ]; then
        rm -rf node_modules/.cache/* 2>/dev/null || true
        cleaned=$((cleaned + 1))
    fi
    
    echo -e "${GREEN}✅ Dados temporários removidos ($cleaned arquivos)${NC}"
}

cleanup_temp_files

# 3. Backup do .env atual
echo -e "${YELLOW}💾 Fazendo backup do .env...${NC}"
if [ -f ".env" ]; then
    cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
    echo -e "${GREEN}✅ Backup criado${NC}"
else
    echo -e "${RED}❌ Arquivo .env não encontrado!${NC}"
    echo -e "${YELLOW}💡 Certifique-se de que o arquivo .env existe no diretório do projeto${NC}"
    exit 1
fi

# 5. Verificar e renovar certificados SSL
echo -e "${YELLOW}🔐 Verificando certificados SSL...${NC}"

# Criar diretório SSL se não existir
mkdir -p $SSL_DIR

# Verificar se certbot está instalado
if ! command -v certbot &> /dev/null; then
    echo -e "${RED}❌ Certbot não encontrado. Instalando...${NC}"
    sudo apt update
    sudo apt install -y certbot
fi

# Verificar validade dos certificados atuais
CERT_VALID=false
if [ -f "$SSL_DIR/fullchain.pem" ]; then
    echo -e "${BLUE}📅 Verificando validade do certificado atual...${NC}"
    
    # Verificar se expira em menos de 30 dias
    if openssl x509 -checkend 2592000 -noout -in "$SSL_DIR/fullchain.pem" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Certificado ainda válido por mais de 30 dias${NC}"
        CERT_VALID=true
    else
        echo -e "${YELLOW}⚠️  Certificado expira em menos de 30 dias${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Certificado não encontrado${NC}"
fi

# Renovar certificados se necessário
if [ "$CERT_VALID" = false ]; then
    echo -e "${YELLOW}🔄 Renovando certificados SSL...${NC}"
    
    # Parar nginx se estiver rodando (pode interferir)
    sudo systemctl stop nginx 2>/dev/null || true
    
    # Renovar certificado
    sudo certbot certonly \
        --standalone \
        --non-interactive \
        --agree-tos \
        --email admin@$DOMAIN \
        --domains $DOMAIN \
        --force-renewal
    
    # Copiar certificados para o projeto
    sudo cp /etc/letsencrypt/live/$DOMAIN/privkey.pem $SSL_DIR/
    sudo cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem $SSL_DIR/
    
    # Ajustar permissões
    sudo chown $USER:$USER $SSL_DIR/*.pem
    chmod 600 $SSL_DIR/*.pem
    
    # Restart nginx se estava rodando
    sudo systemctl start nginx 2>/dev/null || true
    
    echo -e "${GREEN}✅ Certificados SSL renovados!${NC}"
else
    echo -e "${GREEN}✅ Certificados SSL válidos${NC}"
fi

# 6. Garantir que as variáveis SSL estão configuradas corretamente
echo -e "${YELLOW}🔧 Verificando configuração SSL no .env...${NC}"

# Verificar se as variáveis SSL existem e estão corretas
if grep -q "SSL_KEY_PATH=" .env; then
    # Atualizar variável existente
    sed -i "s|SSL_KEY_PATH=.*|SSL_KEY_PATH=$SSL_DIR/privkey.pem|g" .env
else
    # Adicionar variável se não existir
    echo "SSL_KEY_PATH=$SSL_DIR/privkey.pem" >> .env
fi

if grep -q "SSL_CERT_PATH=" .env; then
    # Atualizar variável existente  
    sed -i "s|SSL_CERT_PATH=.*|SSL_CERT_PATH=$SSL_DIR/fullchain.pem|g" .env
else
    # Adicionar variável se não existir
    echo "SSL_CERT_PATH=$SSL_DIR/fullchain.pem" >> .env
fi

# Garantir que USE_HTTPS está habilitado
if grep -q "USE_HTTPS=" .env; then
    sed -i "s|USE_HTTPS=.*|USE_HTTPS=true|g" .env
elif grep -q "USE_HTTP=" .env; then
    sed -i "s|USE_HTTP=.*|USE_HTTPS=true|g" .env
else
    echo "USE_HTTPS=true" >> .env
fi

echo -e "${GREEN}✅ Configurações SSL atualizadas no .env${NC}"

# 7. Instalar/atualizar dependências
echo -e "${YELLOW}📦 Instalando dependências...${NC}"
npm install

# 8. Iniciar aplicação com PM2
echo -e "${YELLOW}🚀 Iniciando aplicação...${NC}"
pm2 start src/server.js --name $APP_NAME --env production

# 9. Salvar configuração PM2
pm2 save
pm2 startup

# 10. Teste de conectividade
echo -e "${YELLOW}🧪 Testando conectividade...${NC}"
sleep 5

test_connectivity() {
    local success=0
    
    # Teste HTTPS (silencioso)
    if curl -s -I --max-time 10 https://$DOMAIN:3000/api/tratativa/test-connection >/dev/null 2>&1; then
        echo -e "${GREEN}✅ HTTPS funcionando${NC}"
        success=1
    else
        # Fallback para HTTP se HTTPS falhar
        if curl -s -I --max-time 10 http://$DOMAIN:3000/api/tratativa/test-connection >/dev/null 2>&1; then
            echo -e "${YELLOW}⚠️  HTTP funcionando (HTTPS com problema)${NC}"
            success=1
        else
            echo -e "${RED}❌ Conectividade falhando${NC}"
            echo -e "${YELLOW}💡 Verificando logs do PM2...${NC}"
            pm2 logs $APP_NAME --lines 5 --nostream 2>/dev/null || echo "Logs não disponíveis"
        fi
    fi
    
    return $success
}

test_connectivity

echo ""
echo "=================================================="
echo -e "${GREEN}🎉 Deploy concluído com sucesso!${NC}"

# Status resumido
APP_STATUS=$(pm2 jlist | jq -r ".[] | select(.name==\"$APP_NAME\") | .pm2_env.status" 2>/dev/null || echo "unknown")
if [ "$APP_STATUS" = "online" ]; then
    echo -e "${GREEN}✅ Aplicação online${NC}"
else
    echo -e "${RED}❌ Aplicação com problema: $APP_STATUS${NC}"
fi

# URLs principais
echo -e "${BLUE}🔗 API Principal: https://$DOMAIN:3000/api/tratativa/${NC}"

echo ""
echo -e "${YELLOW}💡 Para monitorar:${NC} pm2 logs $APP_NAME"
echo -e "${YELLOW}💡 Para status:${NC} pm2 status"