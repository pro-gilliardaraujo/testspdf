/**
 * Script para testar todas as rotas da API
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

// Lista de todas as rotas que deveriam existir
const routes = [
    { method: 'GET', path: '/api/tratativa/test-connection', description: 'Teste de conexão' },
    { method: 'GET', path: '/api/tratativa/list', description: 'Listar tratativas' },
    { method: 'GET', path: '/api/tratativa/list-without-pdf', description: 'Listar sem PDF' },
    { method: 'POST', path: '/api/tratativa/create', description: 'Criar tratativa', needsBody: true },
    { method: 'POST', path: '/api/tratativa/pdftasks', description: 'Gerar PDF (2 folhas)', needsBody: true },
    { method: 'POST', path: '/api/tratativa/pdftasks/single', description: 'Gerar PDF (1 folha)', needsBody: true },
    { method: 'POST', path: '/api/tratativa/regenerate-pdf', description: 'Regenerar PDF', needsBody: true },
    { method: 'DELETE', path: '/api/tratativa/delete/123', description: 'Excluir tratativa' }
];

// Corpo padrão para requests POST que precisam
const defaultBody = {
    id: 'test-id',
    numero_tratativa: 'TEST-001',
    numero_documento: 'TEST-001',
    nome: 'João Teste',
    funcao: 'Teste',
    setor: 'Teste',
    cpf: '123.456.789-00',
    descricao_infracao: 'Teste',
    data_infracao: '15/12/2024',
    hora_infracao: '10:00',
    valor_registrado: '0',
    metrica: 'ocorrências',
    valor_limite: '0',
    codigo_infracao: 'P1-001',
    tipo_penalidade: 'Advertência',
    descricao_penalidade: 'Teste',
    url_imagem: 'https://teste.jpg',
    lider: 'Teste Líder'
};

async function testRoute(route) {
    try {
        const config = {
            method: route.method,
            url: `${BASE_URL}${route.path}`,
            timeout: 5000
        };

        if (route.needsBody && (route.method === 'POST' || route.method === 'PUT')) {
            config.data = defaultBody;
            config.headers = { 'Content-Type': 'application/json' };
        }

        const response = await axios(config);
        
        console.log(`✅ ${route.method} ${route.path} - Status: ${response.status}`);
        return { route: route.path, status: 'OK', code: response.status };
        
    } catch (error) {
        if (error.response) {
            console.log(`❌ ${route.method} ${route.path} - Status: ${error.response.status} - ${error.response.statusText}`);
            return { route: route.path, status: 'ERROR', code: error.response.status, error: error.response.statusText };
        } else if (error.code === 'ECONNREFUSED') {
            console.log(`🔌 ${route.method} ${route.path} - Servidor não está rodando`);
            return { route: route.path, status: 'SERVER_DOWN', error: 'Connection refused' };
        } else {
            console.log(`❓ ${route.method} ${route.path} - Erro: ${error.message}`);
            return { route: route.path, status: 'UNKNOWN_ERROR', error: error.message };
        }
    }
}

async function testAllRoutes() {
    console.log(`🧪 Testando todas as rotas na API: ${BASE_URL}`);
    console.log('=' .repeat(60));
    
    const results = [];
    
    for (const route of routes) {
        const result = await testRoute(route);
        results.push(result);
        
        // Pequena pausa entre requests
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('\n📊 RESUMO DOS TESTES:');
    console.log('=' .repeat(60));
    
    const working = results.filter(r => r.status === 'OK');
    const errors = results.filter(r => r.status === 'ERROR');
    const serverDown = results.filter(r => r.status === 'SERVER_DOWN');
    
    console.log(`✅ Funcionando: ${working.length}`);
    console.log(`❌ Com erro: ${errors.length}`);
    console.log(`🔌 Servidor down: ${serverDown.length}`);
    
    if (errors.length > 0) {
        console.log('\n❌ ROTAS COM ERRO:');
        errors.forEach(e => console.log(`   ${e.route} - ${e.code} ${e.error}`));
    }
    
    if (serverDown.length > 0) {
        console.log('\n🔌 SERVIDOR NÃO ESTÁ RODANDO');
        console.log('   Execute: npm start');
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    testAllRoutes().catch(console.error);
}

module.exports = { testAllRoutes, routes };

