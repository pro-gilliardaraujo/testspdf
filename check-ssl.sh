#!/bin/bash

# Script para verificar status dos certificados SSL
# Uso: ./check-ssl.sh

echo "🔍 Verificando Certificados SSL"
echo "================================"

DOMAIN="iblogistica.ddns.net"
SSL_DIR="./letsencrypt"

# Verificar se certificados existem localmente
echo "📁 Verificando certificados locais..."
if [ -f "$SSL_DIR/fullchain.pem" ] && [ -f "$SSL_DIR/privkey.pem" ]; then
    echo "✅ Certificados encontrados em $SSL_DIR"
    
    # Verificar validade
    echo ""
    echo "📅 Informações do certificado:"
    openssl x509 -in "$SSL_DIR/fullchain.pem" -text -noout | grep -A 2 "Validity"
    
    # Verificar se expira em 30 dias
    if openssl x509 -checkend 2592000 -noout -in "$SSL_DIR/fullchain.pem"; then
        echo "✅ Certificado válido por mais de 30 dias"
    else
        echo "⚠️  Certificado expira em menos de 30 dias - RENOVAR!"
    fi
    
else
    echo "❌ Certificados não encontrados em $SSL_DIR"
    echo "💡 Execute: sudo certbot certonly --standalone -d $DOMAIN"
fi

echo ""
echo "🌐 Verificando certificado remoto..."
echo | openssl s_client -servername $DOMAIN -connect $DOMAIN:443 2>/dev/null | openssl x509 -noout -dates

echo ""
echo "🧪 Testando conectividade HTTPS..."
curl -I https://$DOMAIN:3000/api/tratativa/test-connection || echo "❌ Falha na conexão HTTPS"

echo ""
echo "📊 Status PM2:"
pm2 status
