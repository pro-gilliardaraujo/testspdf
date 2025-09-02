// Script para comparar dados enviados pelo nosso sistema vs dados que funcionam no Postman
const axios = require('axios');

async function testPDFGeneration() {
    console.log('🔍 COMPARAÇÃO: DADOS QUE FUNCIONAM vs DADOS DO NOSSO SISTEMA\n');
    
    // 1. DADOS QUE FUNCIONAM (do seu teste no Postman)
    const dadosFuncionando = {
        templateId: "d4dfc5fd-f7ed-498e-8630-878d78310091",
        templateData: {
            DOP_NUMERO_DOCUMENTO: "9999",
            DOP_NOME: "MATHEUS SILVA MAIA",
            DOP_DATA_EXTENSA: "sexta-feira, 04 de abril de 2025.",
            DOP_FUNCAO: "OPERADOR DE MAQUIINAS PESADAS",
            DOP_SETOR: "ITURAMA COLHEITA/PLANTIO",
            DOP_CODIGO: "5",
            DOP_DESCRICAO: "Excesso de Velocidade",
            DOP_DATA: "04/04/2025",
            DOP_HORA: "10:25",
            DOP_GRAU: "P2",
            DOP_PENALIDADE: "Advertência Escrita",
            DOP_IMAGEM: "https://kjlwqezxzqjfhacmjhbh.supabase.co/storage/v1/object/public/tratativas/1743776285043-Matheus%20silva%20maia%20(1).jpeg",
            DOP_LIDER: "JOSIAS BATISTA DA SILVA"
        }
    };

    console.log('✅ DADOS QUE FUNCIONAM NO POSTMAN:');
    console.log(JSON.stringify(dadosFuncionando, null, 2));

    // 2. Simular uma busca de tratativa para ver o que nosso sistema recupera
    try {
        console.log('\n🔍 TESTANDO BUSCA DE TRATATIVA EXISTENTE...');
        const response = await axios.get('http://localhost:3000/api/tratativa/list');
        
        if (response.data.status === 'success' && response.data.data.length > 0) {
            const primeiraTratatriva = response.data.data[0];
            console.log('\n📋 DADOS DE UMA TRATATIVA REAL NO BANCO:');
            console.log(JSON.stringify({
                id: primeiraTratatriva.id,
                numero_tratativa: primeiraTratatriva.numero_tratativa,
                funcionario: primeiraTratatriva.funcionario,
                funcao: primeiraTratatriva.funcao,
                setor: primeiraTratatriva.setor,
                codigo_infracao: primeiraTratatriva.codigo_infracao,
                descricao_infracao: primeiraTratatriva.descricao_infracao,
                data_infracao: primeiraTratatriva.data_infracao,
                hora_infracao: primeiraTratatriva.hora_infracao,
                penalidade: primeiraTratatriva.penalidade,
                texto_infracao: primeiraTratatriva.texto_infracao,
                imagem_evidencia1: primeiraTratatriva.imagem_evidencia1,
                lider: primeiraTratatriva.lider,
                cpf: primeiraTratatriva.cpf,
                advertido: primeiraTratatriva.advertido
            }, null, 2));

            // 3. Simular o que nosso código faria com esses dados APÓS AS CORREÇÕES
            console.log('\n🔧 SIMULANDO O QUE NOSSO CÓDIGO GERARIA (CORRIGIDO):');
            
            // Extrair grau da penalidade (simular função extrairGrauPenalidade)
            const grauPenalidade = primeiraTratatriva.penalidade?.match(/P[1-4]/)?.[0] || 'P1';
            const descricaoPenalidade = primeiraTratatriva.penalidade || 'Penalidade não especificada';
            
            // Simular formatação de data (ISO para DD/MM/YYYY)
            const formatarDataBrasileira = (dataISO) => {
                if (!dataISO) return '';
                const [ano, mes, dia] = dataISO.split('-');
                return `${dia}/${mes}/${ano}`;
            };
            
            const templateDataNosso = {
                DOP_NUMERO_DOCUMENTO: primeiraTratatriva.numero_tratativa,
                DOP_NOME: primeiraTratatriva.funcionario,
                DOP_FUNCAO: primeiraTratatriva.funcao,
                DOP_SETOR: primeiraTratatriva.setor,
                DOP_DESCRICAO: primeiraTratatriva.descricao_infracao,
                DOP_DATA: formatarDataBrasileira(primeiraTratatriva.data_infracao), // CORRIGIDO: DD/MM/YYYY
                DOP_HORA: primeiraTratatriva.hora_infracao,
                DOP_CODIGO: primeiraTratatriva.codigo_infracao,
                DOP_GRAU: grauPenalidade,
                DOP_PENALIDADE: primeiraTratatriva.texto_infracao || descricaoPenalidade,
                DOP_IMAGEM: primeiraTratatriva.imagem_evidencia1 || process.env.URL_IMAGEM_PADRAO || 'https://via.placeholder.com/400x300',
                DOP_LIDER: primeiraTratatriva.lider,
                DOP_CPF: primeiraTratatriva.cpf,
                DOP_DATA_EXTENSA: 'Data formatada seria aqui',
                // CORRIGIDO: Baseado no grau da penalidade
                DOP_ADVERTIDO: (['P1', 'P2'].includes(grauPenalidade) || primeiraTratatriva.advertido === 'Advertido') ? 'X' : '',
                DOP_SUSPENSO: (['P3', 'P4'].includes(grauPenalidade) || primeiraTratatriva.advertido === 'Suspenso') ? 'X' : '',
                // CORRIGIDO: Texto baseado na infração
                DOP_TEXTO_ADVERTENCIA: primeiraTratatriva.texto_infracao || `Ter ${primeiraTratatriva.descricao_infracao?.toLowerCase() || 'cometido infração'}`
            };

            console.log(JSON.stringify({
                templateId: process.env.DOPPIO_TEMPLATE_ID_FOLHA1 || "TEMPLATE_ID_NAO_DEFINIDO",
                templateData: templateDataNosso
            }, null, 2));

            // 4. COMPARAÇÃO DOS PROBLEMAS
            console.log('\n❌ PROBLEMAS IDENTIFICADOS:');
            console.log('1. DOP_DATA formato:', {
                funcionando: dadosFuncionando.templateData.DOP_DATA, // "04/04/2025"
                nosso: templateDataNosso.DOP_DATA // "2025-04-04"
            });
            
            console.log('2. DOP_IMAGEM:', {
                funcionando: dadosFuncionando.templateData.DOP_IMAGEM?.substring(0, 50) + '...',
                nosso: templateDataNosso.DOP_IMAGEM?.substring(0, 50) + '...'
            });
            
            console.log('3. DOP_PENALIDADE:', {
                funcionando: dadosFuncionando.templateData.DOP_PENALIDADE,
                nosso: templateDataNosso.DOP_PENALIDADE
            });

        } else {
            console.log('❌ Nenhuma tratativa encontrada no banco');
        }

    } catch (error) {
        console.error('❌ Erro no teste:', error.message);
    }
}

testPDFGeneration();
