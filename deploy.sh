#!/bin/bash

echo "🚀 Iniciando deploy do servidor PDF..."
echo "──────────────────────────────────────"

# Parar todas as aplicações PM2
echo "🛑 Parando aplicações existentes..."
pm2 delete all

# Atualizar código do repositório
echo "📥 Atualizando código do repositório..."
git pull

# Instalar dependências
echo "📦 Instalando dependências..."
npm install

# Verificar se os certificados existem
if [ ! -f "./certs/server.key" ] || [ ! -f "./certs/server.crt" ]; then
    echo "🔒 Gerando novos certificados SSL..."
    npm run generate-cert
else
    echo "✅ Certificados SSL já existem"
fi

# Criar diretórios necessários se não existirem
echo "📁 Verificando diretórios necessários..."
mkdir -p logs
mkdir -p temp
mkdir -p certs

# Limpar arquivos temporários
echo "🧹 Limpando arquivos temporários..."
npm run clean

# Iniciar servidor com PM2
echo "🚀 Iniciando servidor..."
pm2 start src/server.js --name "server-pdf" --time

# Limpar a tela após 2 segundos
echo "⏳ Preparando logs..."
sleep 2
clear

# Mostrar logs
echo "📋 Exibindo logs do servidor:"
echo "──────────────────────────────────"
pm2 logs server-pdf 