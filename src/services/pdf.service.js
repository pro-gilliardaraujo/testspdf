const PDFMerger = require('pdf-merger-js');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

class PDFService {
    constructor() {
        this.merger = new PDFMerger();
    }

    async downloadPDF(url, filename) {
        try {
            logger.info('Iniciando download do PDF', {
                operation: 'Download PDF',
                details: {
                    url,
                    filename
                }
            });

            const response = await axios({
                method: 'GET',
                url: url,
                responseType: 'arraybuffer'
            });

            await fs.writeFile(filename, response.data);
            
            logger.info('Download do PDF concluído', {
                operation: 'Download PDF',
                details: {
                    filename,
                    size: response.data.length
                }
            });

            return filename;
        } catch (error) {
            logger.logError('Erro no download do PDF', error, {
                url,
                filename
            });
            throw error;
        }
    }

    async mergePDFs(files, outputFilename) {
        try {
            logger.info('Iniciando merge de PDFs', {
                operation: 'Merge PDFs',
                details: {
                    files,
                    outputFilename
                }
            });

            for (const file of files) {
                await this.merger.add(file);
                logger.info('PDF adicionado ao merge', {
                    operation: 'Merge PDFs',
                    file
                });
            }
            
            await this.merger.save(outputFilename);
            
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
}

module.exports = new PDFService(); 