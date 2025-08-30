#!/bin/bash
# Script para corrigir SSL na AWS

echo "🔍 Verificando certificados SSL..."

# Verificar se certificados existem
if [ -f "./letsencrypt/privkey.pem" ] && [ -f "./letsencrypt/fullchain.pem" ]; then
    echo "✅ Certificados encontrados"
    
    # Verificar validade
    echo "📅 Verificando validade dos certificados..."
    openssl x509 -in ./letsencrypt/fullchain.pem -text -noout | grep "Not After"
    
    # Testar se estão válidos
    echo "🧪 Testando certificados..."
    openssl verify ./letsencrypt/fullchain.pem
    
else
    echo "❌ Certificados não encontrados em ./letsencrypt/"
    echo "🔧 Configurando para usar HTTP..."
    
    # Backup do .env atual
    cp .env .env.backup
    
    # Forçar HTTP
    echo "USE_HTTP=true" >> .env
    echo "PORT=3000" >> .env
    
    echo "✅ Configurado para HTTP"
fi

echo "🔄 Reiniciando PM2..."
pm2 restart all

echo "🧪 Testando servidor..."
sleep 3
curl -I http://localhost:3000/api/tratativa/test-connection

echo "✅ Script concluído!"
echo "📋 Teste agora:"
echo "   HTTP:  http://iblogistica.ddns.net:3000/api/tratativa/list"
echo "   HTTPS: https://iblogistica.ddns.net:3000/api/tratativa/list"
