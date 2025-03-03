const express = require('express');
const router = express.Router();
const axios = require('axios');
const path = require('path');
const fs = require('fs').promises;
const logger = require('../utils/logger');
const pdfService = require('../services/pdf.service');
const supabaseService = require('../services/supabase.service');
const tratativaService = require('../services/tratativa.service');

// Função auxiliar para formatar nome do documento
const formatarNomeDocumento = (tratativa, tipo) => {
    const data = new Date();
    const timestamp = data.toISOString().replace(/[:.]/g, '-');
    const numeroDoc = tratativa.numero_tratativa || 'sem-numero';
    const funcionario = tratativa.funcionario ? tratativa.funcionario.replace(/\s+/g, '_').toLowerCase() : 'sem-nome';
    
    switch(tipo) {
        case 'folha1':
            return `DOC_${numeroDoc}_FOLHA1_${funcionario}_${timestamp}.pdf`;
        case 'folha2':
            return `DOC_${numeroDoc}_FOLHA2_${funcionario}_${timestamp}.pdf`;
        case 'completo':
            return `TRATATIVA_${numeroDoc}_${funcionario}_${timestamp}.pdf`;
        default:
            return `documento_${timestamp}.pdf`;
    }
};

// Função auxiliar para preparar dados da folha 2
const prepararDadosFolha2 = (templateData) => {
    return {
        ...templateData,
        DOP_ADVERTIDO: templateData.tipo_penalidade === 'Advertido' ? 'X' : ' ',
        DOP_SUSPENSO: templateData.tipo_penalidade === 'Suspenso' ? 'X' : ' '
    };
};

// Rota de teste de conexão
router.get('/test-connection', (req, res) => {
    logger.logRequest(req, 'Teste de Conexão');
    res.json({ status: 'success', message: 'API is running' });
    logger.logResponse('Teste de Conexão', { status: 'success', message: 'API is running' });
});

// Rota para listar tratativas
router.get('/list', async (req, res) => {
    try {
        logger.logRequest(req, 'Listagem de Tratativas');
        
        const tratativas = await supabaseService.listTratativas();
        
        const response = { status: 'success', data: tratativas };
        res.json(response);
        
        logger.logResponse('Listagem de Tratativas', response);
    } catch (error) {
        logger.logError('Erro na Listagem de Tratativas', error, req);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Rota para criar tratativa e gerar documento
router.post('/create', async (req, res) => {
    try {
        const dadosRecebidos = req.body;

        // Log detalhado dos dados recebidos
        logger.info('Dados recebidos do front-end', {
            operation: 'Validação de Dados',
            dados_frontend: {
                ...dadosRecebidos,
                cpf: 'REDACTED'
            }
        });

        // Mapeamento esperado dos dados
        const dadosEsperados = {
            numero_documento: dadosRecebidos.numero_documento,
            nome_funcionario: dadosRecebidos.nome_funcionario,
            cpf: dadosRecebidos.cpf,
            funcao: dadosRecebidos.funcao,
            setor: dadosRecebidos.setor,
            data_infracao: dadosRecebidos.data_infracao,
            hora_infracao: dadosRecebidos.hora_infracao,
            codigo_infracao: dadosRecebidos.codigo_infracao,
            infracao_cometida: dadosRecebidos.infracao_cometida,
            penalidade: dadosRecebidos.penalidade,
            nome_lider: dadosRecebidos.nome_lider,
            metrica: dadosRecebidos.metrica,
            valor_praticado: dadosRecebidos.valor_praticado,
            valor_limite: dadosRecebidos.valor_limite,
            texto_infracao: dadosRecebidos.texto_infracao,
            texto_limite: dadosRecebidos.texto_limite,
            url_imagem: dadosRecebidos.url_imagem,
            status: dadosRecebidos.status
        };

        // Verificar campos undefined ou null
        const camposVazios = Object.entries(dadosEsperados)
            .filter(([key, value]) => value === undefined || value === null)
            .map(([key]) => key);

        // Log da comparação
        logger.info('Comparação dos dados', {
            operation: 'Validação de Dados',
            comparacao: {
                campos_recebidos: Object.keys(dadosRecebidos),
                campos_esperados: Object.keys(dadosEsperados),
                campos_vazios: camposVazios,
                valores_recebidos: {
                    ...dadosRecebidos,
                    cpf: 'REDACTED'
                },
                valores_mapeados: {
                    ...dadosEsperados,
                    cpf: 'REDACTED'
                }
            }
        });

        // Resposta com a comparação dos dados
        res.json({
            status: 'success',
            message: camposVazios.length > 0 ? 'Dados recebidos com campos vazios' : 'Dados recebidos com sucesso',
            comparacao: {
                campos_recebidos: Object.keys(dadosRecebidos),
                campos_esperados: Object.keys(dadosEsperados),
                campos_vazios: camposVazios,
                dados_recebidos: {
                    ...dadosRecebidos,
                    cpf: 'REDACTED'
                },
                dados_mapeados: {
                    ...dadosEsperados,
                    cpf: 'REDACTED'
                }
            }
        });

    } catch (error) {
        logger.error('Erro ao processar dados recebidos', {
            operation: 'Validação de Dados',
            erro: {
                mensagem: error.message,
                stack: error.stack
            }
        });
        res.status(500).json({
            status: 'error',
            message: 'Erro ao processar dados',
            error: error.message
        });
    }
});

// Rota para processar geração de PDF
router.post('/pdftasks', async (req, res) => {
    try {
        const { id } = req.body;

        if (!id) {
            throw new Error('ID da tratativa não fornecido');
        }

        logger.info('Iniciando processamento de PDF', {
            operation: 'PDF Task',
            tratativa_id: id
        });

        // Buscar dados da tratativa
        const { data: tratativa, error: fetchError } = await supabaseService.getTratativaById(id);

        if (fetchError) {
            throw new Error(`Erro ao buscar tratativa: ${fetchError.message}`);
        }

        if (!tratativa) {
            throw new Error('Tratativa não encontrada');
        }

        // Log dos dados recuperados
        logger.info('Dados da tratativa recuperados', {
            operation: 'PDF Task - Dados',
            tratativa: {
                ...tratativa,
                cpf: 'REDACTED'
            }
        });

        // Preparar dados para Folha 1
        const templateDataFolha1 = {
            DOP_NUMERO_DOCUMENTO: tratativa.numero_tratativa,
            DOP_NOME: tratativa.funcionario,
            DOP_FUNCAO: tratativa.funcao,
            DOP_SETOR: tratativa.setor,
            DOP_DESC_INFRACAO: tratativa.descricao_infracao,
            DOP_DATA_INFRACAO: tratativa.data_infracao,
            DOP_HORA_INFRACAO: tratativa.hora_infracao,
            DOP_VALOR_REGISTRADO: tratativa.valor_praticado,
            DOP_METRICA: tratativa.metrica,
            DOP_VALOR_LIMITE: tratativa.texto_limite,
            DOP_DATA_EXTENSA: new Date(tratativa.data_infracao).toLocaleDateString('pt-BR', { 
                day: '2-digit', 
                month: 'long', 
                year: 'numeric' 
            }),
            DOP_COD_INFRACAO: tratativa.codigo_infracao,
            DOP_GRAU_PENALIDADE: tratativa.grau_penalidade,
            DOP_DESC_PENALIDADE: tratativa.texto_infracao,
            DOP_IMAGEM: tratativa.imagem_evidencia1,
            DOP_LIDER: tratativa.lider,
            DOP_CPF: tratativa.cpf
        };

        // Validar campos obrigatórios Folha 1
        const camposObrigatoriosFolha1 = [
            'DOP_NUMERO_DOCUMENTO',
            'DOP_NOME',
            'DOP_FUNCAO',
            'DOP_SETOR',
            'DOP_DESC_INFRACAO',
            'DOP_DATA_INFRACAO',
            'DOP_HORA_INFRACAO',
            'DOP_VALOR_REGISTRADO',
            'DOP_METRICA',
            'DOP_VALOR_LIMITE',
            'DOP_COD_INFRACAO',
            'DOP_GRAU_PENALIDADE',
            'DOP_DESC_PENALIDADE',
            'DOP_LIDER',
            'DOP_CPF'
        ];

        const camposVaziosFolha1 = camposObrigatoriosFolha1.filter(
            campo => !templateDataFolha1[campo]
        );

        if (camposVaziosFolha1.length > 0) {
            logger.error('Campos obrigatórios ausentes na Folha 1', {
                operation: 'PDF Task - Validação Folha 1',
                campos_ausentes: camposVaziosFolha1,
                dados_template: {
                    ...templateDataFolha1,
                    DOP_CPF: 'REDACTED'
                }
            });
            throw new Error(`Campos obrigatórios ausentes na Folha 1: ${camposVaziosFolha1.join(', ')}`);
        }

        // Log dos dados mapeados Folha 1
        logger.info('Dados mapeados para template - Folha 1', {
            operation: 'PDF Task - Template Folha 1',
            template_data: {
                ...templateDataFolha1,
                DOP_CPF: 'REDACTED'
            }
        });

        // Gerar Folha 1
        logger.info('Gerando Folha 1', {
            operation: 'PDF Task - Folha 1',
            templateId: process.env.DOPPIO_TEMPLATE_ID_FOLHA1
        });

        let responseFolha1;
        try {
            responseFolha1 = await axios({
                method: 'POST',
                url: 'https://api.doppio.sh/v1/template/direct',
                headers: {
                    'Authorization': `Bearer ${process.env.DOPPIO_API_KEY_FOLHA1}`,
                    'Content-Type': 'application/json'
                },
                data: {
                    templateId: process.env.DOPPIO_TEMPLATE_ID_FOLHA1,
                    templateData: templateDataFolha1
                }
            });

            logger.info('Resposta da API Doppio - Folha 1', {
                operation: 'PDF Task - Folha 1',
                response: responseFolha1.data
            });

        } catch (error) {
            const errorMessage = error.response?.data?.message || error.message;
            logger.error('Erro na chamada da API Doppio - Folha 1', {
                operation: 'PDF Task - Folha 1',
                error: {
                    message: errorMessage,
                    response: error.response?.data,
                    template_data: {
                        ...templateDataFolha1,
                        DOP_CPF: 'REDACTED'
                    }
                }
            });
            throw new Error(`Falha ao gerar Folha 1: ${errorMessage}`);
        }

        if (!responseFolha1.data || !responseFolha1.data.url) {
            throw new Error('Falha ao gerar Folha 1: URL não retornada');
        }

        // Preparar dados para Folha 2
        const templateDataFolha2 = {
            ...templateDataFolha1,
            DOP_ADVERTIDO: tratativa.advertido === 'Advertido' ? 'X' : ' ',
            DOP_SUSPENSO: tratativa.advertido === 'Suspenso' ? 'X' : ' '
        };

        // Validar campos obrigatórios Folha 2
        const camposObrigatoriosFolha2 = [
            ...camposObrigatoriosFolha1,
            'DOP_ADVERTIDO',
            'DOP_SUSPENSO'
        ];

        const camposVaziosFolha2 = camposObrigatoriosFolha2.filter(
            campo => templateDataFolha2[campo] === undefined || templateDataFolha2[campo] === null
        );

        if (camposVaziosFolha2.length > 0) {
            logger.error('Campos obrigatórios ausentes na Folha 2', {
                operation: 'PDF Task - Validação Folha 2',
                campos_ausentes: camposVaziosFolha2,
                dados_template: {
                    ...templateDataFolha2,
                    DOP_CPF: 'REDACTED'
                }
            });
            throw new Error(`Campos obrigatórios ausentes na Folha 2: ${camposVaziosFolha2.join(', ')}`);
        }
        
        logger.info('Gerando Folha 2', {
            operation: 'PDF Task - Folha 2',
            templateId: process.env.DOPPIO_TEMPLATE_ID_FOLHA2,
            template_data: {
                ...templateDataFolha2,
                DOP_CPF: 'REDACTED'
            }
        });

        let responseFolha2;
        try {
            responseFolha2 = await axios({
                method: 'POST',
                url: 'https://api.doppio.sh/v1/template/direct',
                headers: {
                    'Authorization': `Bearer ${process.env.DOPPIO_API_KEY_FOLHA2}`,
                    'Content-Type': 'application/json'
                },
                data: {
                    templateId: process.env.DOPPIO_TEMPLATE_ID_FOLHA2,
                    templateData: templateDataFolha2
                }
            });

            logger.info('Resposta da API Doppio - Folha 2', {
                operation: 'PDF Task - Folha 2',
                response: responseFolha2.data
            });

        } catch (error) {
            const errorMessage = error.response?.data?.message || error.message;
            logger.error('Erro na chamada da API Doppio - Folha 2', {
                operation: 'PDF Task - Folha 2',
                error: {
                    message: errorMessage,
                    response: error.response?.data,
                    template_data: {
                        ...templateDataFolha2,
                        DOP_CPF: 'REDACTED'
                    }
                }
            });
            throw new Error(`Falha ao gerar Folha 2: ${errorMessage}`);
        }

        if (!responseFolha2.data || !responseFolha2.data.url) {
            throw new Error('Falha ao gerar Folha 2: URL não retornada');
        }

        // Download dos PDFs
        const filename1 = formatarNomeDocumento(tratativa, 'folha1');
        const filename2 = formatarNomeDocumento(tratativa, 'folha2');
        
        logger.info('Iniciando download dos PDFs', {
            operation: 'PDF Task - Download',
            files: [filename1, filename2]
        });

        const [file1, file2] = await Promise.all([
            pdfService.downloadPDF(responseFolha1.data.url, filename1),
            pdfService.downloadPDF(responseFolha2.data.url, filename2)
        ]);

        // Merge dos PDFs
        const mergedFilename = formatarNomeDocumento(tratativa, 'completo');
        logger.info('Iniciando merge dos PDFs', {
            operation: 'PDF Task - Merge',
            files: [file1, file2],
            output: mergedFilename
        });

        const mergedFile = await pdfService.mergePDFs([file1, file2], mergedFilename);

        // Upload para o Supabase
        logger.info('Iniciando upload para o Supabase', {
            operation: 'PDF Task - Upload',
            filename: mergedFilename
        });

        const fileContent = await fs.readFile(mergedFile);
        const supabasePath = `documentos/${tratativa.numero_tratativa}/${mergedFilename}`;
        const publicUrl = await supabaseService.uploadFile(fileContent, supabasePath);

        // Atualizar URL do documento na tratativa
        logger.info('Atualizando URL do documento na tratativa', {
            operation: 'PDF Task - Update URL',
            id,
            url: publicUrl
        });

        await supabaseService.updateDocumentUrl(id, publicUrl);

        // Limpar arquivos temporários
        logger.info('Limpando arquivos temporários', {
            operation: 'PDF Task - Cleanup',
            files: [file1, file2, mergedFile]
        });

        await pdfService.cleanupFiles([file1, file2, mergedFile]);

        // Resposta de sucesso
        const response = {
            status: 'success',
            message: 'Documento PDF gerado e atualizado com sucesso',
            id,
            url: publicUrl
        };

        res.json(response);
        logger.info('Processamento de PDF concluído', {
            operation: 'PDF Task - Concluído',
            response
        });

    } catch (error) {
        logger.error('Erro no processamento do PDF', {
            operation: 'PDF Task - Erro',
            erro: {
                mensagem: error.message,
                stack: error.stack
            }
        });
        res.status(500).json({
            status: 'error',
            message: 'Erro ao processar PDF',
            error: error.message
        });
    }
});

module.exports = router; 