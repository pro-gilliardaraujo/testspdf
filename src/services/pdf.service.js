const { PDFDocument } = require('pdf-lib');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

class PDFService {
    async downloadPDF(url, filename) {
        try {
            logger.info('Iniciando download do PDF', {
                operation: 'Download PDF',
                details: { url, filename }
            });
            
            // Verificar e criar diretório temp se necessário
            const tempDir = path.join(process.cwd(), 'temp');
            try {
                await fs.promises.access(tempDir);
            } catch (err) {
                logger.info('Criando diretório temporário para download', {
                    operation: 'Download PDF',
                    tempDir
                });
                await fs.promises.mkdir(tempDir, { recursive: true });
            }
            
            // Aplicar o caminho completo para o arquivo
            const filePath = path.join(tempDir, filename);

            const response = await axios({
                method: 'GET',
                url: url,
                responseType: 'arraybuffer'
            });

            logger.info('Download do PDF concluído, salvando arquivo', {
                operation: 'Download PDF',
                details: {
                    filePath,
                    size: response.data.length
                }
            });
            
            await fs.promises.writeFile(filePath, response.data);
            
            logger.info('Arquivo PDF salvo com sucesso', {
                operation: 'Download PDF',
                details: {
                    filePath,
                    size: response.data.length,
                    exists: await this._fileExists(filePath)
                }
            });

            return filePath;
        } catch (error) {
            logger.error('Erro no download do PDF', {
                operation: 'Download PDF',
                error: {
                    message: error.message,
                    stack: error.stack,
                    code: error.code
                },
                details: { url, filename }
            });
            throw error;
        }
    }

    async mergePDFs(files, outputFilename) {
        try {
            logger.info('Iniciando merge de PDFs', {
                operation: 'Merge PDFs',
                details: { files, outputFilename }
            });

            // Criar novo documento PDF
            const mergedPdf = await PDFDocument.create();

            // Processar cada arquivo
            for (const file of files) {
                // Ler o arquivo PDF
                const pdfBytes = await fs.readFile(file);
                
                // Carregar o PDF
                const pdf = await PDFDocument.load(pdfBytes);
                
                // Copiar todas as páginas para o documento final
                const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
                copiedPages.forEach((page) => {
                    mergedPdf.addPage(page);
                });

                logger.info('PDF adicionado ao merge', {
                    operation: 'Merge PDFs',
                    file
                });
            }
            
            // Salvar o documento final
            const mergedPdfBytes = await mergedPdf.save();
            await fs.writeFile(outputFilename, mergedPdfBytes);
            
            logger.info('Merge de PDFs concluído', {
                operation: 'Merge PDFs',
                outputFilename
            });

            return outputFilename;
        } catch (error) {
            logger.logError('Erro no merge de PDFs', error, {
                files,
                outputFilename
            });
            throw error;
        }
    }

    async cleanupFiles(files) {
        try {
            logger.info('Iniciando limpeza de arquivos', {
                operation: 'Cleanup Files',
                files
            });

            for (const file of files) {
                await fs.unlink(file);
                logger.info('Arquivo deletado', {
                    operation: 'Cleanup Files',
                    file
                });
            }

            logger.info('Limpeza de arquivos concluída', {
                operation: 'Cleanup Files',
                filesRemoved: files.length
            });
        } catch (error) {
            logger.logError('Erro na limpeza de arquivos', error, {
                files
            });
            throw error;
        }
    }

    // Método auxiliar para verificar existência de arquivo
    async _fileExists(filePath) {
        try {
            await fs.promises.access(filePath);
            return true;
        } catch (err) {
            return false;
        }
    }
}

module.exports = new PDFService(); 