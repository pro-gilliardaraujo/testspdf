/**
 * Script para iniciar o servidor em modo de desenvolvimento local
 */
require('dotenv').config();
const { spawn } = require('child_process');
const path = require('path');

// Configurar variáveis de ambiente para desenvolvimento
process.env.USE_HTTPS = 'false';
process.env.ENVIRONMENT = 'development';
process.env.PORT = process.env.PORT || 3000;

console.log('🔧 Iniciando servidor em modo de desenvolvimento...');
console.log(`🌐 Servidor estará disponível em: http://localhost:${process.env.PORT}`);

// Iniciar o servidor
const server = spawn('node', [path.join(__dirname, 'src', 'server.js')], {
  stdio: 'inherit',
  env: process.env
});

// Lidar com sinais de encerramento
process.on('SIGINT', () => {
  console.log('\n🛑 Encerrando servidor de desenvolvimento...');
  server.kill('SIGINT');
  process.exit(0);
});

server.on('close', (code) => {
  console.log(`\n🚪 Servidor encerrado com código: ${code}`);
});