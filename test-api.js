/**
 * Script para testar todas as rotas da API localmente
 */
require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Configuração
const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}/api/tratativa`;
const RESULTS_FILE = path.join(__dirname, 'test-results.txt');

// Configuração do axios para depuração
axios.interceptors.request.use(request => {
  console.log('🔍 Enviando requisição para:', request.url);
  console.log('📦 Dados:', request.data || 'Sem dados');
  return request;
});

axios.interceptors.response.use(
  response => {
    console.log('✅ Resposta recebida:', response.status);
    console.log('📄 Dados da resposta:', typeof response.data === 'object' ? JSON.stringify(response.data).substring(0, 100) + '...' : response.data);
    return response;
  },
  error => {
    console.error('❌ Erro na requisição:', error.message);
    if (error.response) {
      console.error('📄 Dados do erro:', error.response.data);
      console.error('🔢 Status:', error.response.status);
    }
    return Promise.reject(error);
  }
);

// Dados de exemplo para testes
const SAMPLE_TRATATIVA = {
  nome: "Funcionário Teste",
  funcao: "Função Teste",
  setor: "Setor Teste",
  descricao_infracao: "Descrição de teste para infração",
  data_infracao: new Date().toISOString().split('T')[0], // Data atual no formato YYYY-MM-DD
  hora_infracao: "10:30",
  codigo_infracao: "T123",
  tipo_penalidade: "P1 - Advertência Verbal",
  descricao_penalidade: "Descrição da penalidade de teste",
  lider: "Líder Teste",
  cpf: "123.456.789-00",
  numero_documento: `DOC-${Math.floor(Math.random() * 10000)}`,
  valor_registrado: "100",
  metrica: "km/h",
  valor_limite: "80",
  url_imagem: "https://example.com/placeholder.jpg",
  numero_tratativa: `TEST-${Math.floor(Math.random() * 10000)}`,
  status: "pendente",
  texto_advertencia: "O colaborador foi advertido conforme as normas da empresa."
};

// Armazenar IDs criados durante os testes
let createdIds = [];

// Função para registrar resultados
const logResult = (testName, passed, details = '') => {
  const result = passed ? 'PASSOU ✅' : 'FALHOU ❌';
  const logMessage = `[${result}] ${testName}${details ? ` - ${details}` : ''}`;
  
  console.log(logMessage);
  fs.appendFileSync(RESULTS_FILE, logMessage + '\n');
};

// Iniciar arquivo de resultados
const initResultsFile = () => {
  const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
  fs.writeFileSync(RESULTS_FILE, `RESULTADOS DOS TESTES DE API - ${timestamp}\n\n`);
  console.log(`Resultados serão salvos em: ${RESULTS_FILE}\n`);
};

// Testes
const tests = [
  // 1. Listar todas as tratativas
  async () => {
    try {
      const response = await axios.get(`${BASE_URL}/list`);
      
      // Verificar se a resposta foi bem-sucedida
      if (response.status === 200) {
        // Verificar a estrutura da resposta
        console.log('Estrutura da resposta:', JSON.stringify(response.data).substring(0, 200));
        
        // Verificar se a resposta é um array ou tem uma propriedade que contém um array
        let dataArray;
        if (Array.isArray(response.data)) {
          dataArray = response.data;
        } else if (response.data && typeof response.data === 'object') {
          // Procurar por uma propriedade que contenha um array
          const arrayProps = Object.keys(response.data).filter(key => Array.isArray(response.data[key]));
          if (arrayProps.length > 0) {
            dataArray = response.data[arrayProps[0]];
          }
        }
        
        if (dataArray) {
          logResult('GET /list', true, `${dataArray.length} tratativas encontradas`);
          return true;
        } else {
          logResult('GET /list', false, 'Resposta não contém um array de tratativas');
          return false;
        }
      } else {
        logResult('GET /list', false, `Status inesperado: ${response.status}`);
        return false;
      }
    } catch (error) {
      logResult('GET /list', false, error.message);
      return false;
    }
  },
  
  // 2. Listar tratativas sem PDF
  async () => {
    try {
      const response = await axios.get(`${BASE_URL}/list-without-pdf`);
      
      // Verificar se a resposta foi bem-sucedida
      if (response.status === 200) {
        // Verificar a estrutura da resposta
        console.log('Estrutura da resposta:', JSON.stringify(response.data).substring(0, 200));
        
        // Verificar se a resposta é um array ou tem uma propriedade que contém um array
        let dataArray;
        if (Array.isArray(response.data)) {
          dataArray = response.data;
        } else if (response.data && typeof response.data === 'object') {
          // Procurar por uma propriedade que contenha um array
          const arrayProps = Object.keys(response.data).filter(key => Array.isArray(response.data[key]));
          if (arrayProps.length > 0) {
            dataArray = response.data[arrayProps[0]];
          }
        }
        
        if (dataArray) {
          logResult('GET /list-without-pdf', true, `${dataArray.length} tratativas sem PDF encontradas`);
          return true;
        } else {
          logResult('GET /list-without-pdf', false, 'Resposta não contém um array de tratativas');
          return false;
        }
      } else {
        logResult('GET /list-without-pdf', false, `Status inesperado: ${response.status}`);
        return false;
      }
    } catch (error) {
      logResult('GET /list-without-pdf', false, error.message);
      return false;
    }
  },
  
  // 3. Criar nova tratativa
  async () => {
    try {
      console.log('Enviando dados para criação:', JSON.stringify(SAMPLE_TRATATIVA));
      
      const response = await axios.post(`${BASE_URL}/create`, SAMPLE_TRATATIVA);
      
      // Verificar se a resposta foi bem-sucedida
      if (response.status === 200) {
        console.log('Resposta completa da criação:', JSON.stringify(response.data));
        
        // Verificar se a resposta contém um ID
        let id;
        if (response.data && response.data.id) {
          id = response.data.id;
        } else if (response.data && typeof response.data === 'object') {
          // Procurar por uma propriedade que possa conter o ID
          const possibleIdProps = ['id', 'tratativa_id', 'tratativaId'];
          for (const prop of possibleIdProps) {
            if (response.data[prop]) {
              id = response.data[prop];
              break;
            }
          }
        }
        
        if (id) {
          createdIds.push(id);
          logResult('POST /create', true, `ID criado: ${id}`);
          return true;
        } else {
          logResult('POST /create', false, 'Resposta não contém ID identificável');
          return false;
        }
      } else {
        logResult('POST /create', false, `Status inesperado: ${response.status}`);
        return false;
      }
    } catch (error) {
      console.error('Erro detalhado na criação:', error);
      logResult('POST /create', false, `${error.message} - ${error.response?.data ? JSON.stringify(error.response.data) : 'Sem detalhes adicionais'}`);
      return false;
    }
  },
  
  // 4. Gerar PDFs para múltiplas tratativas
  async () => {
    if (createdIds.length === 0) {
      // Se não temos IDs criados, vamos tentar obter da lista
      try {
        const listResponse = await axios.get(`${BASE_URL}/list`);
        if (listResponse.status === 200) {
          let items = [];
          if (Array.isArray(listResponse.data)) {
            items = listResponse.data;
          } else if (listResponse.data && typeof listResponse.data === 'object') {
            // Procurar por uma propriedade que contenha um array
            const arrayProps = Object.keys(listResponse.data).filter(key => Array.isArray(listResponse.data[key]));
            if (arrayProps.length > 0) {
              items = listResponse.data[arrayProps[0]];
            }
          }
          
          if (items.length > 0) {
            // Extrair IDs dos primeiros 2 itens
            const ids = items.slice(0, 2).map(item => item.id || item.tratativa_id);
            if (ids.filter(id => id).length > 0) {
              createdIds = ids.filter(id => id);
              console.log(`Obtidos ${createdIds.length} IDs da lista para teste`);
            }
          }
        }
      } catch (error) {
        console.error('Erro ao obter IDs da lista:', error.message);
      }
      
      if (createdIds.length === 0) {
        logResult('POST /pdftasks', false, 'Nenhum ID disponível para teste');
        return false;
      }
    }
    
    try {
      // Processar um ID por vez em vez de enviar um array
      console.log(`Processando geração de PDF para ID: ${createdIds[0]}`);
      const response = await axios.post(`${BASE_URL}/pdftasks`, {
        id: createdIds[0]
      });
      
      const success = response.status === 200;
      logResult('POST /pdftasks', success, `Geração de PDF iniciada para ID ${createdIds[0]}`);
      return success;
    } catch (error) {
      logResult('POST /pdftasks', false, error.message);
      return false;
    }
  },
  
  // 5. Gerar PDF para uma única tratativa
  async () => {
    if (createdIds.length === 0) {
      // Se não temos IDs criados, vamos tentar obter da lista
      try {
        const listResponse = await axios.get(`${BASE_URL}/list`);
        if (listResponse.status === 200) {
          let items = [];
          if (Array.isArray(listResponse.data)) {
            items = listResponse.data;
          } else if (listResponse.data && typeof listResponse.data === 'object') {
            // Procurar por uma propriedade que contenha um array
            const arrayProps = Object.keys(listResponse.data).filter(key => Array.isArray(listResponse.data[key]));
            if (arrayProps.length > 0) {
              items = listResponse.data[arrayProps[0]];
            }
          }
          
          if (items.length > 0) {
            // Extrair ID do primeiro item
            const id = items[0].id || items[0].tratativa_id;
            if (id) {
              createdIds.push(id);
              console.log(`Obtido ID ${id} da lista para teste`);
            }
          }
        }
      } catch (error) {
        console.error('Erro ao obter ID da lista:', error.message);
      }
      
      if (createdIds.length === 0) {
        logResult('POST /pdftasks/single', false, 'Nenhum ID disponível para teste');
        return false;
      }
    }
    
    try {
      console.log(`Enviando requisição para gerar PDF para ID: ${createdIds[0]}`);
      const response = await axios.post(`${BASE_URL}/pdftasks/single`, {
        id: createdIds[0]
      });
      
      const success = response.status === 200;
      logResult('POST /pdftasks/single', success, `PDF solicitado para ID: ${createdIds[0]}`);
      return success;
    } catch (error) {
      logResult('POST /pdftasks/single', false, error.message);
      return false;
    }
  },
  
  // 6. Regenerar PDF
  async () => {
    if (createdIds.length === 0) {
      // Se não temos IDs criados, vamos tentar obter da lista
      try {
        const listResponse = await axios.get(`${BASE_URL}/list`);
        if (listResponse.status === 200) {
          let items = [];
          if (Array.isArray(listResponse.data)) {
            items = listResponse.data;
          } else if (listResponse.data && typeof listResponse.data === 'object') {
            // Procurar por uma propriedade que contenha um array
            const arrayProps = Object.keys(listResponse.data).filter(key => Array.isArray(listResponse.data[key]));
            if (arrayProps.length > 0) {
              items = listResponse.data[arrayProps[0]];
            }
          }
          
          if (items.length > 0) {
            // Extrair ID do primeiro item
            const id = items[0].id || items[0].tratativa_id;
            if (id) {
              createdIds.push(id);
              console.log(`Obtido ID ${id} da lista para teste`);
            }
          }
        }
      } catch (error) {
        console.error('Erro ao obter ID da lista:', error.message);
      }
      
      if (createdIds.length === 0) {
        logResult('POST /regenerate-pdf', false, 'Nenhum ID disponível para teste');
        return false;
      }
    }
    
    try {
      console.log(`Enviando requisição para regenerar PDF para ID: ${createdIds[0]}`);
      const response = await axios.post(`${BASE_URL}/regenerate-pdf`, {
        id: createdIds[0]
      });
      
      const success = response.status === 200;
      logResult('POST /regenerate-pdf', success, `Regeneração solicitada para ID: ${createdIds[0]}`);
      return success;
    } catch (error) {
      logResult('POST /regenerate-pdf', false, error.message);
      return false;
    }
  },
  
  // 7. Excluir tratativa
  async () => {
    if (createdIds.length === 0) {
      // Se não temos IDs criados, vamos tentar obter da lista
      try {
        const listResponse = await axios.get(`${BASE_URL}/list`);
        if (listResponse.status === 200) {
          let items = [];
          if (Array.isArray(listResponse.data)) {
            items = listResponse.data;
          } else if (listResponse.data && typeof listResponse.data === 'object') {
            // Procurar por uma propriedade que contenha um array
            const arrayProps = Object.keys(listResponse.data).filter(key => Array.isArray(listResponse.data[key]));
            if (arrayProps.length > 0) {
              items = listResponse.data[arrayProps[0]];
            }
          }
          
          if (items.length > 0) {
            // Extrair ID do primeiro item
            const id = items[0].id || items[0].tratativa_id;
            if (id) {
              createdIds.push(id);
              console.log(`Obtido ID ${id} da lista para teste de exclusão`);
            }
          }
        }
      } catch (error) {
        console.error('Erro ao obter ID da lista:', error.message);
      }
      
      if (createdIds.length === 0) {
        logResult('DELETE /delete/:id', false, 'Nenhum ID disponível para teste');
        return false;
      }
    }
    
    const idToDelete = createdIds.pop();
    
    try {
      console.log(`Enviando requisição para excluir tratativa com ID: ${idToDelete}`);
      const response = await axios.delete(`${BASE_URL}/delete/${idToDelete}`);
      const success = response.status === 200;
      logResult('DELETE /delete/:id', success, `ID excluído: ${idToDelete}`);
      return success;
    } catch (error) {
      logResult('DELETE /delete/:id', false, error.message);
      return false;
    }
  }
];

// Função principal para executar os testes
const runTests = async () => {
  console.log('🧪 Iniciando testes da API...');
  initResultsFile();
  
  let passedCount = 0;
  let failedCount = 0;
  
  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    const passed = await test();
    
    if (passed) {
      passedCount++;
    } else {
      failedCount++;
    }
    
    // Pequena pausa entre os testes
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Resumo final
  const summary = `\nRESUMO: ${passedCount} testes passaram, ${failedCount} testes falharam.`;
  console.log(summary);
  fs.appendFileSync(RESULTS_FILE, summary);
  
  console.log(`\n📝 Resultados completos salvos em: ${RESULTS_FILE}`);
};

// Verificar se o servidor está rodando
const checkServerRunning = async () => {
  try {
    await axios.get(`http://localhost:3000`);
    return true;
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      return false;
    }
    // Se receber qualquer resposta HTTP, mesmo de erro, significa que o servidor está rodando
    return true;
  }
};

// Iniciar servidor se necessário e executar testes
const startServerAndRunTests = async () => {
  const isServerRunning = await checkServerRunning();
  
  if (isServerRunning) {
    console.log('🌐 Servidor já está rodando. Executando testes...');
    runTests();
    return;
  }
  
  console.log('🚀 Iniciando servidor para testes...');
  
  // Iniciar o servidor em modo de desenvolvimento
  const server = spawn('node', ['dev.js'], {
    stdio: 'pipe',
    env: process.env
  });
  
  let serverStarted = false;
  
  server.stdout.on('data', (data) => {
    const output = data.toString();
    console.log(`[Servidor]: ${output.trim()}`);
    
    // Verificar se o servidor iniciou
    if (output.includes('Servidor estará disponível') && !serverStarted) {
      serverStarted = true;
      
      // Aguardar um pouco para o servidor inicializar completamente
      setTimeout(() => {
        runTests();
      }, 3000);
    }
  });
  
  server.stderr.on('data', (data) => {
    console.error(`[Erro Servidor]: ${data.toString().trim()}`);
  });
  
  server.on('close', (code) => {
    console.log(`\n🛑 Servidor encerrado com código: ${code}`);
  });
  
  // Lidar com sinais de encerramento
  process.on('SIGINT', () => {
    console.log('\n🛑 Encerrando testes e servidor...');
    server.kill('SIGINT');
    process.exit(0);
  });
};

// Iniciar o processo
startServerAndRunTests();