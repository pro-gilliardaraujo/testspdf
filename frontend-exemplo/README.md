# Regeneração de Documentos PDF para Tratativas

Este diretório contém exemplos de componentes React para adicionar a funcionalidade de regeneração de documentos PDF para tratativas que não possuem documentos gerados.

## Componentes Disponíveis

1. **TratativasSemDocumento.jsx** - Página/componente completo que lista todas as tratativas sem documento e permite regenerá-los.
2. **BotaoRegenerarPDF.jsx** - Botão que pode ser adicionado à tabela de tratativas existente.

## Como Integrar

### Opção 1: Adicionar uma Nova Página

1. Copie o arquivo `TratativasSemDocumento.jsx` para seu projeto.
2. Adicione a rota para a nova página no seu arquivo de rotas:

```jsx
import TratativasSemDocumento from './caminho/para/TratativasSemDocumento';

// No seu componente de rotas
<Route path="/tratativas-sem-documento" element={<TratativasSemDocumento />} />
```

3. Adicione um link para esta página no seu menu ou onde for apropriado:

```jsx
<Menu.Item>
  <Link to="/tratativas-sem-documento">Tratativas sem Documento</Link>
</Menu.Item>
```

### Opção 2: Adicionar Botão às Tabelas Existentes

1. Copie o arquivo `BotaoRegenerarPDF.jsx` para seu projeto.
2. Importe e use o componente na sua tabela de tratativas existente:

```jsx
import BotaoRegenerarPDF from './caminho/para/BotaoRegenerarPDF';

// Na definição das colunas da sua tabela
const columns = [
  // ... suas colunas existentes
  {
    title: 'Ações',
    key: 'acoes',
    render: (_, record) => (
      <div>
        {/* Seus botões existentes */}
        <BotaoRegenerarPDF 
          tratativa={record} 
          onDocumentoGerado={() => {
            // Função para atualizar a lista após um documento ser gerado
            fetchTratativas(); // ou qualquer outra função que você usa para recarregar os dados
          }} 
        />
      </div>
    ),
  },
];
```

## API Necessária

O backend já foi atualizado com os seguintes endpoints:

1. `GET /api/tratativa/list-without-pdf` - Lista todas as tratativas sem documento
2. `POST /api/tratativa/regenerate-pdf` - Regenera o PDF para uma tratativa específica

Os componentes React estão configurados para utilizar esses endpoints automaticamente. 