# 🔧 CORREÇÕES NECESSÁRIAS NO FRONTEND

## 📋 **PROBLEMA ATUAL**

O frontend atual não está enviando todos os dados necessários para a geração correta do PDF. Baseado na análise do backend, identificamos os seguintes problemas:

### ❌ **DADOS FALTANDO:**

1. **Campo `advertido`** - Crítico para marcar checkboxes no PDF
2. **Campo `url_imagem`** - Para a imagem de evidência
3. **Campo `descricao_penalidade`** - Para o texto real da infração
4. **Fluxo automático** - Não gera PDF automaticamente após criar P1

## 🎯 **CORREÇÕES OBRIGATÓRIAS**

### **1. ESTRUTURA DE DADOS COMPLETA**

O frontend DEVE enviar esta estrutura completa para `/create`:

```javascript
const dadosParaBackend = {
  // Dados básicos (já estão corretos)
  numero_documento: "1234",
  nome: "José da Silva Santos", 
  funcao: "Motorista Carreteiro",
  setor: "Operacional",
  cpf: "123.456.789-00",
  lider: "Carlos Alberto Pereira",
  
  // Dados da infração (já estão corretos)
  descricao_infracao: "Excesso de velocidade",
  data_infracao: "2025-01-15", // YYYY-MM-DD para o backend
  hora_infracao: "10:30",
  codigo_infracao: "P1-001",
  
  // 🚨 CAMPOS QUE ESTÃO FALTANDO:
  tipo_penalidade: "P1 - Orientação Verbal",
  descricao_penalidade: "Orientação verbal por excesso de velocidade", // ⚠️ CRÍTICO
  url_imagem: "https://kjlwqezxzqjfhacmjhbh.supabase.co/storage/v1/object/public/tratativas/imagem.jpeg", // ⚠️ CRÍTICO
  advertido: "Advertido", // ⚠️ CRÍTICO para checkbox
  
  // Campos opcionais com valores padrão
  valor_registrado: "0",
  metrica: "ocorrências", 
  valor_limite: "0"
};
```

### **2. LÓGICA DO CAMPO `advertido`**

```javascript
// 🎯 REGRA PARA DETERMINAR ADVERTIDO/SUSPENSO:
const determinarAdvertido = (codigoInfracao) => {
  if (codigoInfracao.startsWith('P1') || codigoInfracao.startsWith('P2')) {
    return 'Advertido';
  } else if (codigoInfracao.startsWith('P3') || codigoInfracao.startsWith('P4')) {
    return 'Suspenso';
  }
  return 'Advertido'; // padrão
};

// Aplicar no envio:
const dadosCreate = {
  // ... outros campos
  advertido: determinarAdvertido(formData.codigo_infracao)
};
```

### **3. FLUXO AUTOMÁTICO P1 (DUAS FOLHAS)**

```javascript
const criarTratativaCompleta = async (dadosFormulario) => {
  try {
    // 1. Criar tratativa
    const responseCreate = await axios.post(`${API_URL}/create`, dadosFormulario);
    
    if (responseCreate.data.status === 'success') {
      const { id } = responseCreate.data;
      
      // 2. Verificar se é P1 para gerar duas folhas
      const isP1 = dadosFormulario.codigo_infracao?.startsWith('P1');
      
      if (isP1) {
        console.log('🎯 P1 detectado - gerando duas folhas automaticamente');
        
        // 3. Gerar PDF automaticamente
        const responsePDF = await axios.post(`${API_URL}/pdftasks`, {
          id: id,
          folhaUnica: false // false = duas folhas para P1
        });
        
        if (responsePDF.data.status === 'success') {
          // 4. Mostrar link para download
          window.open(responsePDF.data.url, '_blank');
          message.success('Tratativa P1 criada e PDF gerado com duas folhas!');
        }
      } else {
        // Para P2, P3, P4 - uma folha apenas
        message.success('Tratativa criada! Use o botão "Gerar PDF" para gerar documento.');
      }
    }
  } catch (error) {
    console.error('❌ Erro:', error);
    message.error('Erro ao processar tratativa');
  }
};
```

### **4. VALIDAÇÃO DE IMAGEM**

```javascript
// 🖼️ VALIDAR URL DA IMAGEM:
const validarUrlImagem = (url) => {
  // Deve ser uma URL do Supabase
  const isSupabaseUrl = url.includes('kjlwqezxzqjfhacmjhbh.supabase.co/storage/v1/object/public/tratativas/');
  
  if (!isSupabaseUrl) {
    message.error('A imagem deve estar hospedada no storage do Supabase');
    return false;
  }
  
  return true;
};

// Usar na validação do formulário:
const validarFormulario = (values) => {
  if (!validarUrlImagem(values.url_imagem)) {
    return false;
  }
  // ... outras validações
  return true;
};
```

## 🚀 **IMPLEMENTAÇÃO RECOMENDADA**

### **Opção 1: Componente Completo (Recomendado)**
Use o arquivo `FluxoCompletoTratativa.jsx` que criamos - ele já tem tudo correto:
- Todos os campos obrigatórios
- Fluxo automático para P1
- Validações corretas
- Interface de usuário clara

### **Opção 2: Corrigir Frontend Existente**

Se quiser manter o frontend atual, faça estas correções:

1. **Adicionar campos faltando no formulário:**
   - `descricao_penalidade` (textarea)
   - `url_imagem` (input URL)
   - Campo calculado `advertido` (hidden)

2. **Implementar lógica de envio completa:**
   ```javascript
   const enviarDados = async (formData) => {
     const dadosCompletos = {
       ...formData,
       advertido: determinarAdvertido(formData.codigo_infracao),
       data_infracao: formData.data_infracao.format('YYYY-MM-DD')
     };
     
     // Chamar create + pdftasks se P1
     await criarTratativaCompleta(dadosCompletos);
   };
   ```

3. **Adicionar feedback visual:**
   - Loading durante criação + PDF
   - Mensagens claras sobre P1 vs outras
   - Link direto para download

## 📋 **CHECKLIST DE VALIDAÇÃO**

Antes de considerar completo, verifique:

- [ ] ✅ Campo `url_imagem` sendo enviado
- [ ] ✅ Campo `descricao_penalidade` sendo enviado  
- [ ] ✅ Campo `advertido` sendo calculado e enviado
- [ ] ✅ P1 gera duas folhas automaticamente
- [ ] ✅ P2/P3/P4 geram uma folha
- [ ] ✅ Imagem aparece no PDF gerado
- [ ] ✅ Checkbox advertido/suspenso marcado corretamente
- [ ] ✅ Texto da infração real (não mockado)

## 🎯 **RESULTADO ESPERADO**

Após as correções:

1. **Create** → Backend salva dados + preserva originais
2. **Auto-detect P1** → Frontend automaticamente chama `/pdftasks`
3. **PDF Gerado** → Com imagem, checkbox e texto corretos
4. **Usuário** → Recebe link direto para download

**🚀 Com essas correções, o fluxo completo funcionará perfeitamente!**
