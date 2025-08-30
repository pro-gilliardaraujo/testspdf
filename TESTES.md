# Testes da API de Tratativas

## Como Executar os Testes

Este projeto inclui um script automatizado para testar todas as rotas da API localmente. O script verifica se cada endpoint está funcionando corretamente e registra os resultados.

### Pré-requisitos

- Node.js instalado
- Dependências do projeto instaladas (`npm install`)
- Configuração do ambiente (.env) correta

### Executando os Testes

Para executar os testes, use o seguinte comando:

```bash
npm run test-api
```

O script irá:

1. Verificar se o servidor está rodando
2. Iniciar o servidor automaticamente se necessário
3. Executar testes em todas as rotas da API
4. Registrar os resultados no console e em um arquivo de texto

## Rotas Testadas

O script testa as seguintes rotas:

1. **GET /list** - Lista todas as tratativas
2. **GET /list-without-pdf** - Lista tratativas sem PDF
3. **POST /create** - Cria uma nova tratativa
4. **POST /pdftasks** - Gera PDFs para múltiplas tratativas
5. **POST /pdftasks/single** - Gera PDF para uma única tratativa
6. **POST /regenerate-pdf** - Regenera o PDF de uma tratativa
7. **DELETE /delete/:id** - Exclui uma tratativa

## Interpretando os Resultados

Após a execução, os resultados serão exibidos no console e salvos em um arquivo chamado `test-results.txt` na raiz do projeto.

Cada teste terá um dos seguintes resultados:

- **PASSOU ✅** - O endpoint respondeu corretamente
- **FALHOU ❌** - Ocorreu um erro ao acessar o endpoint

Ao final, um resumo mostrará quantos testes passaram e quantos falharam.

## Solução de Problemas

Se os testes falharem, verifique:

1. **Conexão com o banco de dados** - Certifique-se de que as credenciais do Supabase estão corretas no arquivo .env
2. **Serviços externos** - Verifique se as chaves de API para o serviço Doppio estão configuradas corretamente
3. **Permissões de arquivos** - Certifique-se de que o servidor tem permissão para criar e modificar arquivos nos diretórios temporários
4. **Logs do servidor** - Examine os logs do servidor para identificar erros específicos

## Personalizando os Testes

Você pode modificar o arquivo `test-api.js` para:

- Alterar os dados de exemplo usados nos testes
- Adicionar novos testes para endpoints específicos
- Modificar o comportamento dos testes existentes

## Notas Importantes

- Os testes criam dados reais no banco de dados
- Os IDs criados durante os testes são armazenados e usados para testes subsequentes
- O último teste exclui a tratativa criada para limpar o banco de dados