const express = require('express');
const router = express.Router();
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const util = require('util');
const logger = require('../utils/logger');
const pdfService = require('../services/pdf.service');
const supabaseService = require('../services/supabase.service');

// Promisify fs functions
const writeFile = util.promisify(fs.writeFile);
const mkdir = util.promisify(fs.mkdir);
const readFile = util.promisify(fs.readFile);

// Função auxiliar para garantir que um diretório existe
const ensureDirectoryExists = async (dirPath) => {
    try {
        logger.info('Verificando diretório temporário', {
            operation: 'Directory Check',
            dirPath: dirPath
        });
        
        // Verificar se o diretório existe
        try {
            await fs.promises.access(dirPath);
            logger.info('Diretório temporário já existe', {
                operation: 'Directory Check',
                dirPath: dirPath
            });
        } catch (accessError) {
            // Se não existir, tentar criar
            logger.info('Criando diretório temporário', {
                operation: 'Directory Creation',
                dirPath: dirPath
            });
            
            await mkdir(dirPath, { recursive: true });
            
            logger.info('Diretório temporário criado com sucesso', {
                operation: 'Directory Creation',
                dirPath: dirPath
            });
        }
        
        // Verificar permissões (tentar criar um arquivo de teste)
        const testFilePath = path.join(dirPath, '.test_write_access');
        try {
            await fs.promises.writeFile(testFilePath, 'test');
            await fs.promises.unlink(testFilePath);
            
            logger.info('Diretório temporário tem permissões de escrita', {
                operation: 'Directory Permission Check',
                dirPath: dirPath
            });
        } catch (permError) {
            logger.error('Erro de permissão no diretório temporário', {
                operation: 'Directory Permission Check',
                dirPath: dirPath,
                error: permError.message
            });
            throw new Error(`Sem permissão para escrever no diretório temporário: ${dirPath}`);
        }
    } catch (error) {
        logger.error('Erro ao garantir existência do diretório', {
            operation: 'Directory Check',
            dirPath: dirPath,
            error: error.message,
            stack: error.stack
        });
        
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
    
    // Sanitização dos campos para remover caracteres problemáticos
    const funcionario = (tratativa.funcionario || 'SEM NOME')
        .toUpperCase()
        .replace(/[\/\\:*?"<>|]/g, '_'); // Remover caracteres especiais
    
    const setor = (tratativa.setor || 'SEM SETOR')
        .toUpperCase()
        .replace(/[\/\\:*?"<>|]/g, '_'); // Remover caracteres especiais
    
    // Limitar o tamanho do nome para evitar caminhos muito longos
    const funcionarioTruncado = funcionario.length > 30 ? funcionario.substring(0, 30) : funcionario;
    const setorTruncado = setor.length > 20 ? setor.substring(0, 20) : setor;
    
    // Construir o nome do arquivo com base no tipo
    let nomeArquivo;
    switch(tipo) {
        case 'folha1':
            nomeArquivo = `${numeroDoc}_${funcionarioTruncado}_${setorTruncado}_${dataFormatada}_FOLHA1.pdf`;
            break;
        case 'folha2':
            nomeArquivo = `${numeroDoc}_${funcionarioTruncado}_${setorTruncado}_${dataFormatada}_FOLHA2.pdf`;
            break;
        case 'completo':
            nomeArquivo = `${numeroDoc}_${funcionarioTruncado}_${setorTruncado}_${dataFormatada}.pdf`;
            break;
        default:
            nomeArquivo = `DOCUMENTO_${dataFormatada}.pdf`;
    }
    
    // Substituir espaços por underscores para evitar problemas
    return nomeArquivo.replace(/\s+/g, '_');
};

// Função auxiliar para extrair grau da penalidade do campo penalidade
const extrairGrauPenalidade = (penalidade) => {
    if (!penalidade) return null;
    const match = penalidade.match(/^([P\d]+)\s*-/);
    return match ? match[1] : null;
};

// Função auxiliar para extrair descrição da penalidade
const extrairDescricaoPenalidade = (penalidade) => {
    if (!penalidade) return null;
    const match = penalidade.match(/^[P\d]+\s*-\s*(.+)$/);
    return match ? match[1] : null;
};

// Função auxiliar para formatar data extensa
const formatarDataExtensa = (data) => {
    if (!data) return null;
    
    let dia, mes, ano;
    
    // Verificar o formato da data
    if (data.includes('-')) {
        // Formato YYYY-MM-DD
        [ano, mes, dia] = data.split('-');
    } else {
        // Formato DD/MM/YYYY
        [dia, mes, ano] = data.split('/');
    }
    
    // Converter para números
    dia = parseInt(dia);
    mes = parseInt(mes);
    ano = parseInt(ano);
    
    // Criar objeto Date (mes - 1 porque em JS os meses vão de 0-11)
    const dataObj = new Date(ano, mes - 1, dia);
    
    // Array com os nomes dos dias da semana
    const diasSemana = [
        'domingo', 'segunda-feira', 'terça-feira', 'quarta-feira',
        'quinta-feira', 'sexta-feira', 'sábado'
    ];
    
    // Array com os nomes dos meses
    const meses = [
        'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
        'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
    ];
    
    // Formatar a data extensa
    return `${diasSemana[dataObj.getDay()]}, ${dia} de ${meses[dataObj.getMonth()]} de ${ano}`;
};

// Função auxiliar para formatar data no formato brasileiro (DD/MM/YYYY)
const formatarDataBrasileira = (data) => {
    if (!data) return null;
    const dataObj = new Date(data);
    return dataObj.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
};

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

// Rota para processar geração de PDF
router.post('/pdftasks', async (req, res) => {
    // Array to track temporary files for cleanup
    const tempFiles = [];
    const startTime = Date.now();
    
    try {
        // Log detalhado da requisição recebida
        logger.info('Requisição para geração de PDF recebida - DETALHES COMPLETOS', {
            operation: 'PDF Task - Request Analysis',
            headers: req.headers,
            body: JSON.stringify(req.body),
            query: req.query,
            method: req.method,
            url: req.url,
            timestamp: new Date().toISOString()
        });
        
        const { id, numero_tratativa, folhaUnica } = req.body;

        // Verificar se pelo menos um identificador foi fornecido
        if (!id && !numero_tratativa) {
            throw new Error('É necessário fornecer ID ou número da tratativa');
        }

        // Log informando o tipo de identificador e se é geração de folha única
        logger.info('Iniciando processamento de PDF', {
            operation: 'PDF Task',
            identificador: id ? `ID: ${id}` : `Número da tratativa: ${numero_tratativa}`,
            tipo: folhaUnica ? 'Folha Única' : 'Documento Completo',
            request_body: {
                ...req.body,
                cpf: 'REDACTED' // Proteger dados sensíveis
            },
            timestamp: new Date().toISOString()
        });

        // Definir diretório temporário no início do processamento
        const tempDir = path.join(process.cwd(), 'temp');
        
        // Garantir que o diretório temp existe
        await ensureDirectoryExists(tempDir);

        // Buscar dados da tratativa (por ID ou por número da tratativa)
        let tratativaResult;
        if (id) {
            tratativaResult = await supabaseService.getTratativaById(id);
        } else {
            tratativaResult = await supabaseService.getTratativaByNumeroTratativa(numero_tratativa);
        }

        const { data: tratativa, error: fetchError } = tratativaResult;

        if (fetchError) {
            const errorMsg = id 
                ? `Erro ao buscar tratativa pelo ID: ${fetchError.message}` 
                : `Erro ao buscar tratativa pelo número: ${fetchError.message}`;
            throw new Error(errorMsg);
        }

        if (!tratativa) {
            const errorMsg = id 
                ? `Tratativa com ID ${id} não encontrada` 
                : `Tratativa com número ${numero_tratativa} não encontrada`;
            throw new Error(errorMsg);
        }

        // Log dos dados recuperados
        logger.info('Dados da tratativa recuperados', {
            operation: 'PDF Task',
            tratativa_id: tratativa.id,
            numero_tratativa: tratativa.numero_tratativa,
            dados_tratativa: {
                ...tratativa,
                cpf: 'REDACTED',
                grau_penalidade: extrairGrauPenalidade(tratativa.penalidade) || 'NÃO DEFINIDO'
            }
        });

        // Validar se o grau_penalidade existe
        const grauPenalidade = extrairGrauPenalidade(tratativa.penalidade);
        const descricaoPenalidade = extrairDescricaoPenalidade(tratativa.penalidade);

        if (!grauPenalidade) {
            logger.error('Campo grau_penalidade ausente', {
                operation: 'PDF Task - Validação',
                tratativa_id: tratativa.id,
                dados_tratativa: {
                    ...tratativa,
                    cpf: 'REDACTED'
                }
            });
            throw new Error('Campo grau_penalidade é obrigatório para gerar o PDF');
        }

        if (!descricaoPenalidade) {
            logger.error('Campo descrição da penalidade ausente', {
                operation: 'PDF Task - Validação',
                tratativa_id: tratativa.id,
                dados_tratativa: {
                    ...tratativa,
                    cpf: 'REDACTED'
                }
            });
            throw new Error('Campo descrição da penalidade é obrigatório para gerar o PDF');
        }

        // Preparar dados para Folha 1
        const templateDataFolha1 = {
            DOP_NUMERO_DOCUMENTO: tratativa.numero_tratativa,
            DOP_NOME: tratativa.funcionario,
            DOP_FUNCAO: tratativa.funcao,
            DOP_SETOR: tratativa.setor,
            DOP_DESCRICAO: tratativa.descricao_infracao,
            DOP_DATA: formatarDataBrasileira(tratativa.data_infracao),
            DOP_HORA: tratativa.hora_infracao,
            DOP_CODIGO: tratativa.codigo_infracao,
            DOP_GRAU: grauPenalidade,
            DOP_PENALIDADE: descricaoPenalidade,
            DOP_IMAGEM: tratativa.imagem_evidencia1,
            DOP_LIDER: tratativa.lider,
            DOP_CPF: tratativa.cpf,
            DOP_DATA_EXTENSA: formatarDataExtensa(tratativa.data_infracao)
        };

        // Validar campos obrigatórios Folha 1
        const camposObrigatoriosFolha1 = [
            'DOP_NUMERO_DOCUMENTO',
            'DOP_NOME',
            'DOP_FUNCAO',
            'DOP_SETOR',
            'DOP_DESCRICAO',
            'DOP_DATA',
            'DOP_HORA',
            'DOP_CODIGO',
            'DOP_GRAU',
            'DOP_PENALIDADE',
            'DOP_IMAGEM',
            'DOP_LIDER',
            'DOP_CPF',
            'DOP_DATA_EXTENSA'
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
            // Log detalhado dos parâmetros enviados para a API Doppio
            logger.info('Chamando API Doppio para geração da Folha 1 - Parâmetros', {
                operation: 'Doppio API Call - Folha 1',
                templateId: process.env.DOPPIO_TEMPLATE_ID_FOLHA1,
                apiKey: process.env.DOPPIO_API_KEY_FOLHA1 ? 'Configurado' : 'NÃO CONFIGURADO',
                templateData: {
                    ...templateDataFolha1,
                    DOP_CPF: 'REDACTED' // Proteger dados sensíveis
                }
            });
            
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

            // Log da resposta recebida da API Doppio
            logger.info('Resposta da API Doppio recebida para Folha 1', {
                operation: 'Doppio API Response - Folha 1',
                status: doppioResponse.status,
                statusText: doppioResponse.statusText,
                headers: doppioResponse.headers,
                dataSize: doppioResponse.data ? doppioResponse.data.length : 0
            });

            if (!doppioResponse.data) {
                throw new Error('Resposta da API sem dados');
            }

            // Salvar o PDF recebido
            const filename1 = formatarNomeDocumento(tratativa, 'folha1');
            const tempPath1 = path.join(tempDir, filename1);
            tempFiles.push(tempPath1); // Track temporary file
            
            // Salvar o PDF
            await writeFile(tempPath1, doppioResponse.data);

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
            let errorMessage;
            if (error.response) {
                if (error.response.data instanceof Buffer) {
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

        // Se folhaUnica for true, pular a geração da folha 2 e o merge
        if (folhaUnica) {
            logger.info('Modo Folha Única ativado, pulando geração da Folha 2', {
                operation: 'PDF Task',
                details: {
                    folhaUnica: true,
                    tratativa_id: tratativa.id
                }
            });

            // Download do PDF
            const filename1 = formatarNomeDocumento(tratativa, 'folha1');
            
            logger.info('Iniciando processamento final do documento (Folha Única)', {
                operation: 'PDF Task Single Page',
                details: {
                    filename: filename1,
                    tempDir: tempDir
                }
            });

            const file1 = await pdfService.downloadPDF(responseFolha1.data.documentUrl, filename1);
            tempFiles.push(file1);

            // Adicionar log para verificar o arquivo
            try {
                const fileStats = await fs.promises.stat(file1);
                logger.info('Arquivo PDF baixado com sucesso', {
                    operation: 'PDF Task',
                    details: {
                        filePath: file1,
                        fileSize: fileStats.size,
                        exists: true
                    }
                });
            } catch (statError) {
                logger.error('Erro ao verificar arquivo baixado', {
                    operation: 'PDF Task',
                    error: statError.message,
                    filePath: file1
                });
                // Continue mesmo com erro, para ver se conseguimos identificar o problema
            }

            // Upload para o Supabase (usando a Folha 1 diretamente)
            const fileContent = await readFile(file1);
            
            // Usar nome de arquivo que indique que é apenas a primeira folha
            const singlePageFilename = formatarNomeDocumento(tratativa, 'folha1');
            
            // Log do início do upload
            logger.info('Iniciando upload do documento (Folha Única)', {
                operation: 'PDF Upload Single Page',
                details: {
                    filename: singlePageFilename,
                    fileSize: fileContent.length,
                    tratativa_id: tratativa.id,
                    numero_tratativa: tratativa.numero_tratativa
                }
            });

            const supabasePath = `tratativas/enviadas/${tratativa.numero_tratativa}/${singlePageFilename}`;
            const publicUrl = await supabaseService.uploadFile(fileContent, supabasePath);

            // Atualizar URL do documento na tratativa
            await supabaseService.updateDocumentUrl(tratativa.id, publicUrl);

            // Log do processo completo (Folha Única)
            const processingTime = Date.now() - startTime;
            logger.info('Processo de geração e upload concluído (Folha Única)', {
                operation: 'PDF Task Complete Single Page',
                details: {
                    tratativa_id: tratativa.id,
                    numero_tratativa: tratativa.numero_tratativa,
                    processingTimeMs: processingTime,
                    documentPath: supabasePath,
                    publicUrl: publicUrl,
                    fileSize: fileContent.length,
                    tempFilesCreated: tempFiles.length,
                    folhaUnica: true,
                    status: 'success'
                }
            });

            // Limpar arquivos temporários
            try {
                await pdfService.cleanupFiles(tempFiles);
            } catch (cleanupError) {
                logger.error('Erro ao limpar arquivos temporários', {
                    operation: 'PDF Task - Cleanup Single Page',
                    error: cleanupError.message
                });
            }

            // Resposta de sucesso para Folha Única
            const response = {
                status: 'success',
                message: 'Documento PDF (Folha Única) gerado com sucesso',
                id: tratativa.id,
                url: publicUrl,
                folhaUnica: true,
                processingTime: `${(processingTime / 1000).toFixed(2)}s`
            };

            return res.json(response);
        }

        // Continue com a geração da folha 2 apenas se folhaUnica não for true
        // Preparar dados para Folha 2
        const templateDataFolha2 = {
            ...templateDataFolha1,
            DOP_ADVERTIDO: tratativa.advertido === 'Advertido' ? 'X' : ' ',
            DOP_SUSPENSO: tratativa.advertido === 'Suspenso' ? 'X' : ' ',
            DOP_TEXTO_ADVERTENCIA: tratativa.texto_advertencia
        };

        // Log para debug do campo advertido
        logger.info('Valores dos campos de penalidade', {
            operation: 'PDF Task - Debug Penalidade',
            tratativa_id: tratativa.id,
            dados: {
                penalidade: tratativa.penalidade,
                advertido: tratativa.advertido,
                DOP_ADVERTIDO: templateDataFolha2.DOP_ADVERTIDO,
                DOP_SUSPENSO: templateDataFolha2.DOP_SUSPENSO
            }
        });

        // Validar campos obrigatórios Folha 2
        const camposObrigatoriosFolha2 = [
            ...camposObrigatoriosFolha1,
            'DOP_ADVERTIDO',
            'DOP_SUSPENSO',
            'DOP_TEXTO_ADVERTENCIA'
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
            // Log detalhado dos parâmetros enviados para a API Doppio - Folha 2
            logger.info('Chamando API Doppio para geração da Folha 2 - Parâmetros', {
                operation: 'Doppio API Call - Folha 2',
                templateId: process.env.DOPPIO_TEMPLATE_ID_FOLHA2,
                apiKey: process.env.DOPPIO_API_KEY_FOLHA2 ? 'Configurado' : 'NÃO CONFIGURADO',
                templateData: {
                    ...templateDataFolha2,
                    DOP_CPF: 'REDACTED' // Proteger dados sensíveis
                }
            });
            
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
            
            // Log da resposta recebida da API Doppio - Folha 2
            logger.info('Resposta da API Doppio recebida para Folha 2', {
                operation: 'Doppio API Response - Folha 2',
                status: doppioResponse.status,
                statusText: doppioResponse.statusText,
                headers: doppioResponse.headers,
                dataSize: doppioResponse.data ? doppioResponse.data.length : 0
            });

            if (!doppioResponse.data) {
                throw new Error('Resposta da API sem dados');
            }

            // Salvar o PDF recebido
            const filename2 = formatarNomeDocumento(tratativa, 'folha2');
            const tempPath2 = path.join(tempDir, filename2);
            tempFiles.push(tempPath2); // Track temporary file
            
            // Salvar o PDF
            await writeFile(tempPath2, doppioResponse.data);

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
            let errorMessage;
            if (error.response) {
                if (error.response.data instanceof Buffer) {
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
        tempFiles.push(mergedFile);

        // Log do arquivo mesclado
        logger.info('PDFs mesclados com sucesso', {
            operation: 'PDF Merge',
            details: {
                originalFiles: [filename1, filename2],
                mergedFile: mergedFilename,
                fileSize: (await fs.promises.stat(mergedFile)).size
            }
        });

        // Upload para o Supabase
        const fileContent = await readFile(mergedFile);
        
        // Log do início do upload
        logger.info('Iniciando upload do documento final', {
            operation: 'PDF Upload',
            details: {
                filename: mergedFilename,
                fileSize: fileContent.length,
                tratativa_id: tratativa.id,
                numero_tratativa: tratativa.numero_tratativa
            }
        });

        const supabasePath = `tratativas/enviadas/${tratativa.numero_tratativa}/${mergedFilename}`;
        const publicUrl = await supabaseService.uploadFile(fileContent, supabasePath);

        // Atualizar URL do documento na tratativa
        await supabaseService.updateDocumentUrl(tratativa.id, publicUrl);

        // Log do processo completo
        const processingTime = Date.now() - startTime;
        logger.info('Processo de geração e upload concluído', {
            operation: 'PDF Task Complete',
            details: {
                tratativa_id: tratativa.id,
                numero_tratativa: tratativa.numero_tratativa,
                processingTimeMs: processingTime,
                documentPath: supabasePath,
                publicUrl: publicUrl,
                fileSize: fileContent.length,
                tempFilesCreated: tempFiles.length,
                status: 'success'
            }
        });

        // Resposta de sucesso
        const response = {
            status: 'success',
            message: 'Documento PDF gerado com sucesso',
            id: tratativa.id,
            url: publicUrl,
            processingTime: `${(processingTime / 1000).toFixed(2)}s`
        };

        res.json(response);

    } catch (error) {
        const processingTime = Date.now() - startTime;
        logger.error('Erro no processamento do documento', {
            operation: 'PDF Task Error',
            error: {
                message: error.message,
                stack: error.stack
            },
            details: {
                identificador: id ? `ID: ${id}` : numero_tratativa ? `Número da tratativa: ${numero_tratativa}` : 'Não fornecido',
                processingTimeMs: processingTime,
                tempFilesCount: tempFiles.length,
                status: 'error'
            }
        });

        // Tentar limpar arquivos temporários mesmo em caso de erro
        try {
            if (tempFiles.length > 0) {
                await pdfService.cleanupFiles(tempFiles);
            }
        } catch (cleanupError) {
            logger.error('Erro ao limpar arquivos temporários após falha', {
                operation: 'PDF Task - Error Cleanup',
                error: cleanupError.message
            });
        }

        res.status(500).json({
            status: 'error',
            message: 'Erro ao processar PDF',
            error: error.message
        });
    }
});

// Rota específica para processar geração de PDF de folha única
router.post('/pdftasks/single', async (req, res) => {
    const { id, numero_tratativa } = req.body;
    
    // Log mais detalhado para diagnóstico
    logger.info('Requisição para geração de PDF de folha única recebida com parâmetros', {
        operation: 'PDF Single Page Request',
        parameters: {
            id: id,
            numero_tratativa: numero_tratativa,
            tipo_numero_tratativa: typeof numero_tratativa,
            body_completo: req.body
        }
    });
    
    // Verificar se pelo menos um identificador foi fornecido
    if (!id && !numero_tratativa) {
        return res.status(400).json({
            status: 'error',
            message: 'É necessário fornecer ID ou número da tratativa'
        });
    }
    
    logger.info('Requisição para geração de PDF de folha única recebida', {
        operation: 'PDF Single Page Request',
        identificador: id ? `ID: ${id}` : `Número da tratativa: ${numero_tratativa}`
    });
    
    // Adicionar o parâmetro folhaUnica e repassar para a rota principal
    req.body.folhaUnica = true;
    
    // Em vez de tentar redirecionar internamente,
    // vamos executar a mesma lógica da rota pdftasks
    // Array to track temporary files for cleanup
    const tempFiles = [];
    const startTime = Date.now();
    
    try {
        // O resto do código pode continuar igual ao da rota /pdftasks
        // já que adicionamos o parâmetro folhaUnica = true e modificamos
        // para aceitar tanto ID quanto número de tratativa
        
        logger.info('Iniciando processamento de PDF (Folha Única)', {
            operation: 'PDF Task',
            tratativa_id: id,
            tipo: 'Folha Única',
            request_body: {
                ...req.body,
                cpf: 'REDACTED' // Proteger dados sensíveis
            },
            timestamp: new Date().toISOString()
        });

        // Definir diretório temporário no início do processamento
        const tempDir = path.join(process.cwd(), 'temp');
        
        // Garantir que o diretório temp existe
        await ensureDirectoryExists(tempDir);

        // Buscar dados da tratativa (por ID ou por número da tratativa)
        let tratativaResult;
        if (id) {
            tratativaResult = await supabaseService.getTratativaById(id);
        } else {
            tratativaResult = await supabaseService.getTratativaByNumeroTratativa(numero_tratativa);
        }

        const { data: tratativa, error: fetchError } = tratativaResult;

        if (fetchError) {
            const errorMsg = id 
                ? `Erro ao buscar tratativa pelo ID: ${fetchError.message}` 
                : `Erro ao buscar tratativa pelo número: ${fetchError.message}`;
            throw new Error(errorMsg);
        }

        if (!tratativa) {
            const errorMsg = id 
                ? `Tratativa com ID ${id} não encontrada` 
                : `Tratativa com número ${numero_tratativa} não encontrada`;
            throw new Error(errorMsg);
        }

        // Log dos dados recuperados
        logger.info('Dados da tratativa recuperados (Folha Única)', {
            operation: 'PDF Task Single',
            tratativa_id: id,
            dados_tratativa: {
                ...tratativa,
                cpf: 'REDACTED',
                grau_penalidade: extrairGrauPenalidade(tratativa.penalidade) || 'NÃO DEFINIDO'
            }
        });

        // Validar se o grau_penalidade existe
        const grauPenalidade = extrairGrauPenalidade(tratativa.penalidade);
        const descricaoPenalidade = extrairDescricaoPenalidade(tratativa.penalidade);

        if (!grauPenalidade) {
            throw new Error('Campo grau_penalidade é obrigatório para gerar o PDF');
        }

        if (!descricaoPenalidade) {
            throw new Error('Campo descrição da penalidade é obrigatório para gerar o PDF');
        }

        // Preparar dados para Folha 1
        const templateDataFolha1 = {
            DOP_NUMERO_DOCUMENTO: tratativa.numero_tratativa,
            DOP_NOME: tratativa.funcionario,
            DOP_FUNCAO: tratativa.funcao,
            DOP_SETOR: tratativa.setor,
            DOP_DESCRICAO: tratativa.descricao_infracao,
            DOP_DATA: formatarDataBrasileira(tratativa.data_infracao),
            DOP_HORA: tratativa.hora_infracao,
            DOP_CODIGO: tratativa.codigo_infracao,
            DOP_GRAU: grauPenalidade,
            DOP_PENALIDADE: descricaoPenalidade,
            DOP_IMAGEM: tratativa.imagem_evidencia1,
            DOP_LIDER: tratativa.lider,
            DOP_CPF: tratativa.cpf,
            DOP_DATA_EXTENSA: formatarDataExtensa(tratativa.data_infracao)
        };

        // Validar campos obrigatórios Folha 1
        const camposObrigatoriosFolha1 = [
            'DOP_NUMERO_DOCUMENTO',
            'DOP_NOME',
            'DOP_FUNCAO',
            'DOP_SETOR',
            'DOP_DESCRICAO',
            'DOP_DATA',
            'DOP_HORA',
            'DOP_CODIGO',
            'DOP_GRAU',
            'DOP_PENALIDADE',
            'DOP_IMAGEM',
            'DOP_LIDER',
            'DOP_CPF',
            'DOP_DATA_EXTENSA'
        ];

        const camposVaziosFolha1 = camposObrigatoriosFolha1.filter(
            campo => !templateDataFolha1[campo]
        );

        if (camposVaziosFolha1.length > 0) {
            throw new Error(`Campos obrigatórios ausentes na Folha 1: ${camposVaziosFolha1.join(', ')}`);
        }

        // Log dos dados mapeados Folha 1
        logger.info('Iniciando geração da Folha 1 (Modo Folha Única)', {
            operation: 'PDF Task Single',
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
            const tempPath1 = path.join(tempDir, filename1);
            tempFiles.push(tempPath1); // Track temporary file
            
            // Salvar o PDF
            await writeFile(tempPath1, doppioResponse.data);

            // Criar URL completo para o arquivo
            const serverUrl = `https://${req.get('host')}`;
            const localUrl = `${serverUrl}/temp/${filename1}`;
            
            responseFolha1 = {
                data: {
                    documentUrl: localUrl
                }
            };

            logger.info('Folha 1 gerada com sucesso (Modo Folha Única)', {
                operation: 'PDF Task Single',
                folha: 1
            });
        } catch (error) {
            let errorMessage;
            if (error.response) {
                if (error.response.data instanceof Buffer) {
                    errorMessage = error.response.data.toString();
                } else {
                    errorMessage = error.response.data?.message || error.response.statusText;
                }
            } else if (error.request) {
                errorMessage = 'Sem resposta do servidor Doppio';
            } else {
                errorMessage = error.message || 'Erro desconhecido ao gerar PDF';
            }
            throw new Error(`Falha ao gerar Folha 1: ${errorMessage}`);
        }

        if (!responseFolha1.data || !responseFolha1.data.documentUrl) {
            throw new Error('Falha ao gerar Folha 1: URL do documento não retornada');
        }

        // Download do PDF
        const filename1 = formatarNomeDocumento(tratativa, 'folha1');
        logger.info('Iniciando processamento final do documento (Folha Única)', {
            operation: 'PDF Task Single Page',
            details: {
                filename: filename1,
                tempDir: tempDir
            }
        });

        const file1 = await pdfService.downloadPDF(responseFolha1.data.documentUrl, filename1);
        tempFiles.push(file1);

        // Adicionar log para verificar o arquivo
        try {
            const fileStats = await fs.promises.stat(file1);
            logger.info('Arquivo PDF baixado com sucesso', {
                operation: 'PDF Task Single',
                details: {
                    filePath: file1,
                    fileSize: fileStats.size,
                    exists: true
                }
            });
        } catch (statError) {
            logger.error('Erro ao verificar arquivo baixado', {
                operation: 'PDF Task Single',
                error: statError.message,
                filePath: file1
            });
            // Continue mesmo com erro, para ver se conseguimos identificar o problema
        }

        // Upload para o Supabase (usando a Folha 1 diretamente)
        const fileContent = await readFile(file1);
        
        // Usar nome de arquivo que indique que é apenas a primeira folha
        const singlePageFilename = formatarNomeDocumento(tratativa, 'folha1');
        
        // Log do início do upload
        logger.info('Iniciando upload do documento (Folha Única)', {
            operation: 'PDF Upload Single Page',
            details: {
                filename: singlePageFilename,
                fileSize: fileContent.length,
                tratativa_id: id,
                numero_tratativa: tratativa.numero_tratativa
            }
        });

        const supabasePath = `tratativas/enviadas/${tratativa.numero_tratativa}/${singlePageFilename}`;
        const publicUrl = await supabaseService.uploadFile(fileContent, supabasePath);

        // Atualizar URL do documento na tratativa
        await supabaseService.updateDocumentUrl(tratativa.id, publicUrl);

        // Log do processo completo (Folha Única)
        const processingTime = Date.now() - startTime;
        logger.info('Processo de geração e upload concluído (Folha Única)', {
            operation: 'PDF Task Complete Single Page',
            details: {
                tratativa_id: id,
                numero_tratativa: tratativa.numero_tratativa,
                processingTimeMs: processingTime,
                documentPath: supabasePath,
                publicUrl: publicUrl,
                fileSize: fileContent.length,
                tempFilesCreated: tempFiles.length,
                folhaUnica: true,
                status: 'success'
            }
        });

        // Limpar arquivos temporários
        try {
            await pdfService.cleanupFiles(tempFiles);
        } catch (cleanupError) {
            logger.error('Erro ao limpar arquivos temporários', {
                operation: 'PDF Task - Cleanup Single Page',
                error: cleanupError.message
            });
        }

        // Resposta de sucesso para Folha Única
        const response = {
            status: 'success',
            message: 'Documento PDF (Folha Única) gerado com sucesso',
            id: tratativa.id,
            url: publicUrl,
            folhaUnica: true,
            processingTime: `${(processingTime / 1000).toFixed(2)}s`
        };

        return res.json(response);
    } catch (error) {
        const processingTime = Date.now() - startTime;
        logger.error('Erro no processamento do documento (Folha Única)', {
            operation: 'PDF Task Error Single',
            error: {
                message: error.message,
                stack: error.stack
            },
            details: {
                identificador: id ? `ID: ${id}` : numero_tratativa ? `Número da tratativa: ${numero_tratativa}` : 'Não fornecido',
                processingTimeMs: processingTime,
                tempFilesCount: tempFiles.length,
                status: 'error'
            }
        });

        // Tentar limpar arquivos temporários mesmo em caso de erro
        try {
            if (tempFiles.length > 0) {
                await pdfService.cleanupFiles(tempFiles);
            }
        } catch (cleanupError) {
            logger.error('Erro ao limpar arquivos temporários após falha (Folha Única)', {
                operation: 'PDF Task - Error Cleanup Single',
                error: cleanupError.message
            });
        }

        return res.status(500).json({
            status: 'error',
            message: 'Erro ao processar PDF (Folha Única)',
            error: error.message
        });
    }
});

module.exports = router; 