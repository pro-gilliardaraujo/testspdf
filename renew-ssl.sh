#!/bin/bash
# Script para renovar certificados Let's Encrypt

echo "🔄 Renovando certificados SSL..."

# Parar servidor
echo "⏸️  Parando servidor PM2..."
pm2 stop all

# Renovar certificados (certbot deve estar instalado)
echo "🔐 Renovando certificados Let's Encrypt..."
sudo certbot renew --force-renewal

# Copiar certificados para diretório do projeto
echo "📁 Copiando certificados..."
sudo cp /etc/letsencrypt/live/iblogistica.ddns.net/privkey.pem ./letsencrypt/
sudo cp /etc/letsencrypt/live/iblogistica.ddns.net/fullchain.pem ./letsencrypt/

# Ajustar permissões
sudo chown $USER:$USER ./letsencrypt/*.pem
chmod 600 ./letsencrypt/*.pem

echo "✅ Certificados renovados!"

# Restart servidor
echo "🚀 Iniciando servidor..."
pm2 start all

echo "🧪 Testando HTTPS..."
sleep 5
curl -I https://iblogistica.ddns.net:3000/api/tratativa/test-connection

echo "✅ SSL renovado e testado!"
