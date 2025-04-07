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
                await fs.access(tempDir);
            } catch (err) {
                logger.info('Criando diretório temporário para download', {
                    operation: 'Download PDF',
                    tempDir
                });
                await fs.mkdir(tempDir, { recursive: true });
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
            
            await fs.writeFile(filePath, response.data);
            
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

            // Verificar e criar diretório temp se necessário
            const tempDir = path.join(process.cwd(), 'temp');
            try {
                await fs.access(tempDir);
            } catch (err) {
                logger.info('Criando diretório temporário para merge', {
                    operation: 'Merge PDFs',
                    tempDir
                });
                await fs.mkdir(tempDir, { recursive: true });
            }

            // Garantir caminho completo para o arquivo de saída
            const outputPath = outputFilename.includes(path.sep) 
                ? outputFilename 
                : path.join(tempDir, outputFilename);

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
            await fs.writeFile(outputPath, mergedPdfBytes);
            
            logger.info('Merge de PDFs concluído', {
                operation: 'Merge PDFs',
                outputPath,
                exists: await this._fileExists(outputPath)
            });

            return outputPath;
        } catch (error) {
            logger.error('Erro no merge de PDFs', {
                operation: 'Merge PDFs',
                error: {
                    message: error.message,
                    stack: error.stack
                },
                details: { 
                    files,
                    outputFilename
                }
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

            const sucessos = [];
            const falhas = [];

            for (const file of files) {
                try {
                    if (await this._fileExists(file)) {
                        await fs.unlink(file);
                        logger.info('Arquivo deletado', {
                            operation: 'Cleanup Files',
                            file
                        });
                        sucessos.push(file);
                    } else {
                        logger.warn('Arquivo não encontrado para deleção', {
                            operation: 'Cleanup Files',
                            file
                        });
                        falhas.push({ file, reason: 'not_found' });
                    }
                } catch (fileError) {
                    logger.error('Erro ao deletar arquivo', {
                        operation: 'Cleanup Files',
                        file,
                        error: fileError.message
                    });
                    falhas.push({ file, reason: 'error', message: fileError.message });
                }
            }

            logger.info('Limpeza de arquivos concluída', {
                operation: 'Cleanup Files',
                sucessos,
                falhas,
                totalSuccess: sucessos.length,
                totalFailed: falhas.length
            });
        } catch (error) {
            logger.error('Erro na limpeza de arquivos', {
                operation: 'Cleanup Files',
                error: {
                    message: error.message,
                    stack: error.stack
                },
                files
            });
            // Não relançamos o erro para não interromper o fluxo principal
        }
    }

    // Método auxiliar para verificar existência de arquivo
    async _fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch (err) {
            return false;
        }
    }
}

module.exports = new PDFService(); 