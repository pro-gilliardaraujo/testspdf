const express = require('express');
const router = express.Router();
const axios = require('axios');
const path = require('path');
const fs = require('fs').promises;
const logger = require('../utils/logger');
const pdfService = require('../services/pdf.service');
const supabaseService = require('../services/supabase.service');
const tratativaService = require('../services/tratativa.service');

// Função auxiliar para preparar dados da folha 2
const prepararDadosFolha2 = (templateData) => {
    return {
        ...templateData,
        DOP_ADVERTIDO: templateData.tipo_penalidade === 'Advertência' ? 'X' : '.',
        DOP_SUSPENSO: templateData.tipo_penalidade === 'Suspensão' ? 'X' : '.'
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
        logger.logRequest(req, 'Criação de Tratativa e Documento');
        
        // Criar tratativa e obter dados formatados
        const { id, templateData } = await tratativaService.criarTratativa(req.body);

        // Log do início da geração do PDF
        logger.info('Iniciando geração dos PDFs', {
            operation: 'Geração de PDFs',
            documentData: {
                id,
                numeroDocumento: templateData.DOP_NUMERO_DOCUMENTO
            }
        });

        // Gerar Folha 1
        logger.info('Gerando Folha 1', {
            operation: 'Geração Folha 1',
            templateId: process.env.DOPPIO_TEMPLATE_ID_FOLHA1
        });

        const responseFolha1 = await axios({
            method: 'POST',
            url: 'https://api.doppio.sh/v1/template/direct',
            headers: {
                'Authorization': `Bearer ${process.env.DOPPIO_API_KEY_FOLHA1}`,
                'Content-Type': 'application/json'
            },
            data: {
                templateId: process.env.DOPPIO_TEMPLATE_ID_FOLHA1,
                templateData
            }
        });

        if (!responseFolha1.data || !responseFolha1.data.url) {
            throw new Error('Falha ao gerar Folha 1');
        }

        // Gerar Folha 2
        logger.info('Gerando Folha 2', {
            operation: 'Geração Folha 2',
            templateId: process.env.DOPPIO_TEMPLATE_ID_FOLHA2
        });

        const dadosFolha2 = prepararDadosFolha2(templateData);
        const responseFolha2 = await axios({
            method: 'POST',
            url: 'https://api.doppio.sh/v1/template/direct',
            headers: {
                'Authorization': `Bearer ${process.env.DOPPIO_API_KEY_FOLHA2}`,
                'Content-Type': 'application/json'
            },
            data: {
                templateId: process.env.DOPPIO_TEMPLATE_ID_FOLHA2,
                templateData: dadosFolha2
            }
        });

        if (!responseFolha2.data || !responseFolha2.data.url) {
            throw new Error('Falha ao gerar Folha 2');
        }

        // Download dos PDFs
        const filename1 = `${templateData.DOP_NUMERO_DOCUMENTO}_folha1_${Date.now()}.pdf`;
        const filename2 = `${templateData.DOP_NUMERO_DOCUMENTO}_folha2_${Date.now()}.pdf`;
        
        logger.info('Iniciando download dos PDFs', {
            operation: 'Download PDFs',
            files: [filename1, filename2]
        });

        const [file1, file2] = await Promise.all([
            pdfService.downloadPDF(responseFolha1.data.url, filename1),
            pdfService.downloadPDF(responseFolha2.data.url, filename2)
        ]);

        // Merge dos PDFs
        const mergedFilename = `${templateData.DOP_NUMERO_DOCUMENTO}_completo_${Date.now()}.pdf`;
        logger.info('Iniciando merge dos PDFs', {
            operation: 'Merge PDFs',
            files: [file1, file2],
            output: mergedFilename
        });

        const mergedFile = await pdfService.mergePDFs([file1, file2], mergedFilename);

        // Upload para o Supabase
        logger.info('Iniciando upload para o Supabase', {
            operation: 'Upload Supabase',
            filename: mergedFilename
        });

        const fileContent = await fs.readFile(mergedFile);
        const supabasePath = `documentos/${mergedFilename}`;
        const publicUrl = await supabaseService.uploadFile(fileContent, supabasePath);

        // Atualizar URL do documento na tratativa
        logger.info('Atualizando URL do documento na tratativa', {
            operation: 'Atualização URL',
            id,
            url: publicUrl
        });

        await supabaseService.updateDocumentUrl(id, publicUrl);

        // Limpar arquivos temporários
        logger.info('Limpando arquivos temporários', {
            operation: 'Limpeza',
            files: [file1, file2, mergedFile]
        });

        await pdfService.cleanupFiles([file1, file2, mergedFile]);

        const response = {
            status: 'success',
            message: 'Tratativa criada e documento gerado com sucesso',
            id,
            url: publicUrl
        };

        res.json(response);
        logger.logResponse('Criação de Tratativa e Documento Concluída', response);

    } catch (error) {
        logger.logError('Erro na Criação de Tratativa e Documento', error, req);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

module.exports = router; 