const express = require('express');
const router = express.Router();
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const util = require('util');
const logger = require('../utils/logger');
const pdfService = require('../services/pdf.service');
const supabaseService = require('../services/supabase.service');
const tratativaService = require('../services/tratativa.service');

// Promisify fs functions
const writeFile = util.promisify(fs.writeFile);
const mkdir = util.promisify(fs.mkdir);
const readFile = util.promisify(fs.readFile);

// Função auxiliar para garantir que um diretório existe
const ensureDirectoryExists = async (dirPath) => {
    try {
        await mkdir(dirPath, { recursive: true });
    } catch (error) {
        if (error.code !== 'EEXIST') {
            throw error;
        }
    }
};

// Função auxiliar para formatar nome do documento
const formatarNomeDocumento = (tratativa, tipo) => {
    const data = new Date(tratativa.data_infracao);
    const dataFormatada = data.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    }).replace(/\//g, '-');
    
    const numeroDoc = tratativa.numero_tratativa || '0000';
    const funcionario = (tratativa.funcionario || 'SEM NOME').toUpperCase();
    const setor = (tratativa.setor || 'SEM SETOR').toUpperCase();
    
    switch(tipo) {
        case 'folha1':
            return `${numeroDoc} - ${funcionario} - ${setor} ${dataFormatada}_FOLHA1.pdf`;
        case 'folha2':
            return `${numeroDoc} - ${funcionario} - ${setor} ${dataFormatada}_FOLHA2.pdf`;
        case 'completo':
            return `${numeroDoc} - ${funcionario} - ${setor} ${dataFormatada}.pdf`;
        default:
            return `DOCUMENTO_${dataFormatada}.pdf`;
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

        // Definir diretório temporário no início do processamento
        const tempDir = path.join(process.cwd(), 'temp');
        
        // Garantir que o diretório temp existe
        await ensureDirectoryExists(tempDir);

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
            operation: 'PDF Task',
            tratativa_id: id
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
        logger.info('Iniciando geração da Folha 1', {
            operation: 'PDF Task',
            folha: 1
        });

        let responseFolha1;
        try {
            const doppioResponse = await axios({
                method: 'POST',
                url: 'https://api.doppio.sh/v1/template/direct',
                headers: {
                    'Authorization': `Bearer ${process.env.DOPPIO_API_KEY_FOLHA1}`,
                    'Content-Type': 'application/json'
                },
                data: {
                    templateId: process.env.DOPPIO_TEMPLATE_ID_FOLHA1,
                    templateData: templateDataFolha1
                },
                responseType: 'arraybuffer'
            });

            if (!doppioResponse.data) {
                throw new Error('Resposta da API sem dados');
            }

            // Salvar o PDF recebido
            const filename1 = formatarNomeDocumento(tratativa, 'folha1');
            const tempPath = path.join(tempDir, filename1);
            
            // Salvar o PDF
            await writeFile(tempPath, doppioResponse.data);

            // Criar URL completo para o arquivo
            const serverUrl = `https://${req.get('host')}`;
            const localUrl = `${serverUrl}/temp/${filename1}`;
            
            responseFolha1 = {
                data: {
                    documentUrl: localUrl
                }
            };

            logger.info('Folha 1 gerada com sucesso', {
                operation: 'PDF Task',
                folha: 1
            });

        } catch (error) {
            // Melhorar o tratamento do erro para capturar mais detalhes
            let errorMessage;
            if (error.response) {
                // Se temos uma resposta da API com erro
                if (error.response.data instanceof Buffer) {
                    // Se a resposta é um buffer, tentar converter para texto
                    errorMessage = error.response.data.toString();
                } else {
                    errorMessage = error.response.data?.message || error.response.statusText;
                }
                logger.error('Erro ao gerar Folha 1', {
                    operation: 'PDF Task',
                    folha: 1,
                    error: {
                        message: errorMessage,
                        status: error.response.status,
                        headers: error.response.headers
                    }
                });
            } else if (error.request) {
                // Se a requisição foi feita mas não houve resposta
                errorMessage = 'Sem resposta do servidor Doppio';
                logger.error('Erro ao gerar Folha 1', {
                    operation: 'PDF Task',
                    folha: 1,
                    error: {
                        message: errorMessage,
                        request: error.request
                    }
                });
            } else {
                // Erro na configuração da requisição
                errorMessage = error.message || 'Erro desconhecido ao gerar PDF';
                logger.error('Erro ao gerar Folha 1', {
                    operation: 'PDF Task',
                    folha: 1,
                    error: {
                        message: errorMessage,
                        stack: error.stack
                    }
                });
            }
            throw new Error(`Falha ao gerar Folha 1: ${errorMessage}`);
        }

        if (!responseFolha1.data || !responseFolha1.data.documentUrl) {
            logger.error('Erro: URL do documento não encontrada', {
                operation: 'PDF Task',
                folha: 1
            });
            throw new Error('Falha ao gerar Folha 1: URL do documento não retornada');
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
        
        logger.info('Iniciando geração da Folha 2', {
            operation: 'PDF Task',
            folha: 2
        });

        let responseFolha2;
        try {
            const doppioResponse = await axios({
                method: 'POST',
                url: 'https://api.doppio.sh/v1/template/direct',
                headers: {
                    'Authorization': `Bearer ${process.env.DOPPIO_API_KEY_FOLHA2}`,
                    'Content-Type': 'application/json'
                },
                data: {
                    templateId: process.env.DOPPIO_TEMPLATE_ID_FOLHA2,
                    templateData: templateDataFolha2
                },
                responseType: 'arraybuffer'
            });

            if (!doppioResponse.data) {
                throw new Error('Resposta da API sem dados');
            }

            // Salvar o PDF recebido
            const filename2 = formatarNomeDocumento(tratativa, 'folha2');
            const tempPath = path.join(tempDir, filename2);
            
            // Salvar o PDF
            await writeFile(tempPath, doppioResponse.data);

            // Criar URL completo para o arquivo
            const serverUrl = `https://${req.get('host')}`;
            const localUrl = `${serverUrl}/temp/${filename2}`;
            
            responseFolha2 = {
                data: {
                    documentUrl: localUrl
                }
            };

            logger.info('Folha 2 gerada com sucesso', {
                operation: 'PDF Task',
                folha: 2
            });

        } catch (error) {
            // Melhorar o tratamento do erro para capturar mais detalhes
            let errorMessage;
            if (error.response) {
                // Se temos uma resposta da API com erro
                if (error.response.data instanceof Buffer) {
                    // Se a resposta é um buffer, tentar converter para texto
                    errorMessage = error.response.data.toString();
                } else {
                    errorMessage = error.response.data?.message || error.response.statusText;
                }
                logger.error('Erro ao gerar Folha 2', {
                    operation: 'PDF Task',
                    folha: 2,
                    error: {
                        message: errorMessage,
                        status: error.response.status,
                        headers: error.response.headers
                    }
                });
            } else if (error.request) {
                // Se a requisição foi feita mas não houve resposta
                errorMessage = 'Sem resposta do servidor Doppio';
                logger.error('Erro ao gerar Folha 2', {
                    operation: 'PDF Task',
                    folha: 2,
                    error: {
                        message: errorMessage,
                        request: error.request
                    }
                });
            } else {
                // Erro na configuração da requisição
                errorMessage = error.message || 'Erro desconhecido ao gerar PDF';
                logger.error('Erro ao gerar Folha 2', {
                    operation: 'PDF Task',
                    folha: 2,
                    error: {
                        message: errorMessage,
                        stack: error.stack
                    }
                });
            }
            throw new Error(`Falha ao gerar Folha 2: ${errorMessage}`);
        }

        if (!responseFolha2.data || !responseFolha2.data.documentUrl) {
            logger.error('Erro: URL do documento não encontrada', {
                operation: 'PDF Task',
                folha: 2
            });
            throw new Error('Falha ao gerar Folha 2: URL do documento não retornada');
        }

        // Download dos PDFs
        const filename1 = formatarNomeDocumento(tratativa, 'folha1');
        const filename2 = formatarNomeDocumento(tratativa, 'folha2');
        
        logger.info('Iniciando processamento final do documento', {
            operation: 'PDF Task'
        });

        const [file1, file2] = await Promise.all([
            pdfService.downloadPDF(responseFolha1.data.documentUrl, filename1),
            pdfService.downloadPDF(responseFolha2.data.documentUrl, filename2)
        ]);

        // Merge dos PDFs
        const mergedFilename = formatarNomeDocumento(tratativa, 'completo');
        const mergedFile = await pdfService.mergePDFs([file1, file2], mergedFilename);

        // Upload para o Supabase
        const fileContent = await readFile(mergedFile);
        const supabasePath = `documentos/${tratativa.numero_tratativa}/${mergedFilename}`;
        const publicUrl = await supabaseService.uploadFile(fileContent, supabasePath);

        // Atualizar URL do documento na tratativa
        await supabaseService.updateDocumentUrl(id, publicUrl);

        // Limpar arquivos temporários
        await pdfService.cleanupFiles([file1, file2, mergedFile]);

        // Resposta de sucesso
        const response = {
            status: 'success',
            message: 'Documento PDF gerado com sucesso',
            id,
            url: publicUrl
        };

        res.json(response);
        logger.info('Documento gerado e salvo com sucesso', {
            operation: 'PDF Task',
            url: publicUrl
        });

    } catch (error) {
        logger.error('Erro no processamento do documento', {
            operation: 'PDF Task',
            error: error.message
        });
        res.status(500).json({
            status: 'error',
            message: 'Erro ao processar PDF',
            error: error.message
        });
    }
});

module.exports = router; 