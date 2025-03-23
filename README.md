# Guia Completo - Sistema de Geração de Medidas Disciplinares

## 1. Para o Time de Backend

### 1.1. Limpeza e Instalação no Servidor

```bash
# 1. Parar todos os serviços
pm2 delete all

# 2. Limpar diretório (substitua /caminho/do/projeto pelo caminho real)
cd /caminho/do/projeto
rm -rf *

# 3. Clonar novo repositório
git clone seu_repositorio_git .

# 4. Instalar dependências
npm install

# 5. Criar diretórios necessários
mkdir logs
mkdir temp
mkdir certs

# 6. Gerar certificados SSL
npm run generate-cert

# 7. Iniciar servidor
./deploy.sh
```

### 1.2. Estrutura do Projeto
```
/pdf_generation_tests
├── /src
│   ├── /config
│   │   ├── cors.js
│   │   └── supabase.js
│   ├── /routes
│   │   └── tratativa.routes.js
│   ├── /services
│   │   ├── pdf.service.js
│   │   └── supabase.service.js
│   ├── /utils
│   │   └── logger.js
│   └── server.js
├── /logs
├── /temp
├── /certs
├── .env
├── deploy.sh
└── package.json
```

## 2. Para o Time de Frontend

### 2.1. Endpoints Disponíveis

#### 2.1.1. Teste de Conexão
```typescript
GET https://iblogistica.ddns.net:3000/api/tratativa/test-connection

// Resposta
{
  "status": "success",
  "message": "API is running"
}
```

#### 2.1.2. Listar Tratativas
```typescript
GET https://iblogistica.ddns.net:3000/api/tratativa/list

// Resposta
{
  "status": "success",
  "data": [/* array de tratativas */]
}
```

#### 2.1.3. Gerar Documento
```typescript
POST https://iblogistica.ddns.net:3000/api/tratativa/generate

// Body
{
  "id": "id_da_tratativa",
  "templateData": {
    // Dados comuns para ambas as folhas
    "DOP_NUMERO_DOCUMENTO": "1009",
    "DOP_NOME": "João da Silva Santos",
    "DOP_FUNCAO": "Motorista",
    "DOP_SETOR": "Logística",
    "DOP_DESCRICAO": "Excesso de Velocidade",
    "DOP_DATA": "28/02/2025",
    "DOP_HORA": "14:30",
    "DOP_CPF": "123.456.789-10",
    
    // Dados específicos Folha 1
    "DOP_DATA_EXTENSA": "sexta-feira, 28 de fevereiro de 2025",
    "DOP_CODIGO": "5",
    "DOP_GRAU": "P2",
    "DOP_PENALIDADE": "Advertência Escrita",
    "DOP_IMAGEM": "url_da_imagem",
    "DOP_LIDER": "Maria Oliveira Costa",
    
    // Dados específicos Folha 2
    "tipo_penalidade": "Advertência" // ou "Suspensão"
  }
}

// Resposta Sucesso
{
  "status": "success",
  "message": "Documento gerado e enviado com sucesso",
  "url": "url_do_documento_no_supabase"
}

// Resposta Erro
{
  "status": "error",
  "message": "Mensagem detalhada do erro"
}
```

### 2.2. Exemplo de Implementação

```typescript
interface TratativaData {
  id: string;
  numero_documento: string;
  nome: string;
  funcao: string;
  setor: string;
  // ... outros campos
}

const gerarDocumento = async (tratativa: TratativaData) => {
  try {
    const response = await fetch('https://iblogistica.ddns.net:3000/api/tratativa/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: tratativa.id,
        templateData: {
          DOP_NUMERO_DOCUMENTO: tratativa.numero_documento,
          DOP_NOME: tratativa.nome,
          DOP_DATA_EXTENSA: formatarDataExtensa(tratativa.data),
          DOP_FUNCAO: tratativa.funcao,
          DOP_SETOR: tratativa.setor,
          DOP_CODIGO: tratativa.codigo_infracao,
          DOP_DESCRICAO: tratativa.descricao_infracao,
          DOP_DATA: formatarData(tratativa.data_infracao),
          DOP_HORA: tratativa.hora_infracao,
          DOP_GRAU: tratativa.grau_penalidade,
          DOP_PENALIDADE: tratativa.descricao_penalidade,
          DOP_IMAGEM: tratativa.url_imagem,
          DOP_LIDER: tratativa.lider,
          DOP_CPF: tratativa.cpf,
          tipo_penalidade: tratativa.tipo_penalidade
        }
      })
    });

    const data = await response.json();
    
    if (data.status === 'success') {
      // Sucesso - URL do documento está em data.url
      return data.url;
    } else {
      throw new Error(data.message);
    }
  } catch (error) {
    console.error('Erro ao gerar documento:', error);
    throw error;
  }
};

// Função auxiliar para formatar data extensa
const formatarDataExtensa = (data: Date): string => {
  return data.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
};

// Função auxiliar para formatar data normal
const formatarData = (data: Date): string => {
  return data.toLocaleDateString('pt-BR');
};
```

### 2.3. Observações Importantes

1. **Campos Obrigatórios**
   - Todos os campos DOP_* são obrigatórios
   - O campo `tipo_penalidade` deve ser exatamente "Advertência" ou "Suspensão"
   - URLs de imagens devem ser públicas e acessíveis

2. **Tratamento de Erros**
   - Sempre verifique o status da resposta
   - Implemente retry em caso de falhas de rede
   - Mantenha um log de erros para debug

3. **Performance**
   - A geração do documento pode levar alguns segundos
   - Implemente um loading state na interface
   - Considere um timeout adequado nas chamadas

4. **Segurança**
   - Todas as chamadas são via HTTPS
   - Valide todos os dados antes de enviar
   - Não envie dados sensíveis além dos necessários

## 3. Variáveis de Ambiente Necessárias

Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:

```env
# Server Configuration
PORT=3000
HOST=iblogistica.ddns.net
ENVIRONMENT=production

# Supabase Configuration
SUPABASE_URL=sua_url_supabase
SUPABASE_KEY=sua_chave_supabase

# Doppio Configuration
DOPPIO_API_KEY_FOLHA1=sua_api_key_folha1
DOPPIO_TEMPLATE_ID_FOLHA1=seu_template_id_folha1
DOPPIO_API_KEY_FOLHA2=sua_api_key_folha2
DOPPIO_TEMPLATE_ID_FOLHA2=seu_template_id_folha2

# SSL Configuration
SSL_KEY_PATH=./certs/server.key
SSL_CERT_PATH=./certs/server.crt

# Paths Configuration
TEMP_DIR=./temp
```

## 4. Scripts Disponíveis

No `package.json`:

```json
{
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "setup": "npm install && npm run generate-cert",
    "generate-cert": "node generate-cert.js",
    "clean": "rimraf temp/* logs/*"
  }
}
```

## 5. Logs e Monitoramento

- Logs de erro: `logs/error.log`
- Logs completos: `logs/combined.log`
- Monitoramento PM2: `pm2 monit`
- Visualizar logs: `pm2 logs server-pdf`

## 6. Manutenção

### 6.1. Backup
- Faça backup regular do diretório `certs`
- Mantenha cópia das variáveis de ambiente

### 6.2. Limpeza
- Execute `npm run clean` periodicamente
- Monitore o espaço em disco

### 6.3. Atualização
- Use o script `deploy.sh` para atualizações
- Verifique os logs após cada atualização
- Mantenha um registro de versões deployadas 