const selfsigned = require('selfsigned');
const fs = require('fs');
const path = require('path');

// Criar diretório de certificados se não existir
const certsDir = path.join(__dirname, 'certs');
if (!fs.existsSync(certsDir)) {
    fs.mkdirSync(certsDir);
}

// Gerar certificados
const attrs = [
    { name: 'commonName', value: 'iblogistica.ddns.net' },
    { name: 'countryName', value: 'BR' },
    { name: 'organizationName', value: 'IB Logistica' },
    { name: 'organizationalUnitName', value: 'IT' }
];

const pems = selfsigned.generate(attrs, {
    days: 365,
    keySize: 2048,
    algorithm: 'sha256'
});

// Salvar certificados
fs.writeFileSync(path.join(certsDir, 'server.key'), pems.private);
fs.writeFileSync(path.join(certsDir, 'server.crt'), pems.cert);

console.log('✨ Certificados SSL gerados com sucesso!');
console.log('📁 Local:', certsDir);
console.log('🔑 Arquivos gerados:');
console.log('   - server.key');
console.log('   - server.crt'); 