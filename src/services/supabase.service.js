const supabase = require('../config/supabase');
const logger = require('../utils/logger');

class SupabaseService {
    async listTratativas() {
        try {
            logger.info('Buscando lista de tratativas', {
                operation: 'List Tratativas',
                source: 'Supabase'
            });

            const { data, error } = await supabase
                .from('tratativas')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            
            logger.info('Lista de tratativas recuperada', {
                operation: 'List Tratativas',
                details: {
                    count: data.length,
                    firstItem: data[0]?.id,
                    lastItem: data[data.length - 1]?.id
                }
            });

            return data;
        } catch (error) {
            logger.logError('Erro ao listar tratativas', error, {
                operation: 'List Tratativas',
                source: 'Supabase'
            });
            throw error;
        }
    }

    async updateDocumentUrl(id, url) {
        try {
            // Verificar se os parâmetros são válidos
            if (!id) {
                logger.error('ID nulo ou indefinido na atualização de URL', {
                    operation: 'Update Document URL',
                    details: {
                        id,
                        url,
                        error: 'ID inválido'
                    }
                });
                throw new Error('ID da tratativa é obrigatório para atualização da URL do documento');
            }

            if (!url) {
                logger.error('URL nula ou indefinida na atualização', {
                    operation: 'Update Document URL',
                    details: {
                        id,
                        url,
                        error: 'URL inválida'
                    }
                });
                throw new Error('URL do documento é obrigatória para atualização');
            }

            logger.info('Atualizando URL do documento', {
                operation: 'Update Document URL',
                details: {
                    id,
                    url
                }
            });

            const { data, error } = await supabase
                .from('tratativas')
                .update({ url_documento_enviado: url })
                .eq('id', id)
                .select();

            if (error) throw error;

            logger.info('URL do documento atualizada', {
                operation: 'Update Document URL',
                details: {
                    id,
                    success: true,
                    updatedData: data[0]
                }
            });

            return data[0];
        } catch (error) {
            logger.logError('Erro ao atualizar URL do documento', error, {
                operation: 'Update Document URL',
                details: { id, url }
            });
            throw error;
        }
    }

    async uploadFile(file, path) {
        try {
            // Sanitizar o caminho do arquivo
            const sanitizedPath = this._sanitizePath(path);
            
            logger.info('Iniciando upload de arquivo', {
                operation: 'Upload File',
                details: {
                    path: sanitizedPath,
                    originalPath: path,
                    fileSize: file.length,
                    destinationBucket: 'tratativas',
                    fullPath: `storage/tratativas/${sanitizedPath}`
                }
            });

            // Verificar se o arquivo já existe
            const folderPath = sanitizedPath.split('/').slice(0, -1).join('/');
            const fileName = sanitizedPath.split('/').pop();
            
            // Verificar se a pasta existe para evitar erros
            try {
                const { data: folderExists } = await supabase
                    .storage
                    .from('tratativas')
                    .list(folderPath);
                
                if (!folderExists) {
                    logger.info('Pasta não existe, criando estrutura', {
                        operation: 'Upload File',
                        details: {
                            folderPath
                        }
                    });
                }
            } catch (folderError) {
                logger.info('Pasta não existe, será criada automaticamente', {
                    operation: 'Upload File',
                    details: {
                        folderPath,
                        error: folderError.message
                    }
                });
            }

            const { data, error } = await supabase
                .storage
                .from('tratativas')
                .upload(sanitizedPath, file, {
                    cacheControl: '3600',
                    upsert: true,
                    contentType: 'application/pdf'
                });

            if (error) throw error;

            const { data: urlData } = await supabase
                .storage
                .from('tratativas')
                .createSignedUrl(sanitizedPath, 31536000, {
                    download: false,
                    transform: {
                        metadata: {
                            'Content-Type': 'application/pdf',
                            'Content-Disposition': 'inline'
                        }
                    }
                });

            // Log detalhado do sucesso do upload
            logger.info('Arquivo enviado com sucesso', {
                operation: 'Upload File',
                details: {
                    status: 'success',
                    path: sanitizedPath,
                    fileName,
                    destinationBucket: 'tratativas',
                    fullPath: `storage/tratativas/${sanitizedPath}`,
                    fileSize: file.length,
                    publicUrl: urlData.signedUrl,
                    uploadResponse: data,
                    signedUrlExpiration: '1 ano',
                    contentType: 'application/pdf',
                    disposition: 'inline'
                }
            });

            // Log específico para rastreamento do documento
            logger.info('Documento disponível para visualização', {
                operation: 'Document Tracking',
                details: {
                    documentPath: sanitizedPath,
                    accessUrl: urlData.signedUrl,
                    bucket: 'tratativas',
                    storagePath: `storage/tratativas/${sanitizedPath}`,
                    expirationDate: new Date(Date.now() + 31536000 * 1000).toISOString()
                }
            });

            return urlData.signedUrl;
        } catch (error) {
            logger.error('Erro no upload do arquivo', {
                operation: 'Upload File',
                error: {
                    message: error.message,
                    code: error.code,
                    details: error.details
                },
                details: {
                    path,
                    sanitizedPath: this._sanitizePath(path),
                    destinationBucket: 'tratativas',
                    attemptedFullPath: `storage/tratativas/${path}`,
                    fileSize: file.length
                }
            });
            throw error;
        }
    }

    // Método auxiliar para sanitizar caminhos
    _sanitizePath(path) {
        if (!path) return '';
        
        // Remover caracteres especiais e acentos
        const sanitized = path.normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')  // Remove acentos
            .replace(/[çÇáàãâéêíóôõúüÁÀÃÂÉÊÍÓÔÕÚÜ]/g, '_')  // Substitui caracteres especiais
            .replace(/[^\w\-\/\.]/g, '_');  // Substitui qualquer outro caractere inválido
        
        return sanitized;
    }

    async getTratativaById(id) {
        try {
            logger.info('Buscando tratativa por ID', {
                operation: 'Get Tratativa',
                details: { id }
            });

            const { data, error } = await supabase
                .from('tratativas')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;

            logger.info('Tratativa recuperada', {
                operation: 'Get Tratativa',
                details: {
                    id,
                    found: !!data
                }
            });

            return { data, error: null };
        } catch (error) {
            logger.logError('Erro ao buscar tratativa', error, {
                operation: 'Get Tratativa',
                details: { id }
            });
            return { data: null, error };
        }
    }

    async cleanupTempFiles(tratativaNumero) {
        try {
            logger.info('Iniciando limpeza de arquivos temporários no bucket', {
                operation: 'Cleanup Temp Files',
                details: {
                    tratativa: tratativaNumero
                }
            });

            // Listar arquivos na pasta temp relacionados a esta tratativa
            const { data: files, error: listError } = await supabase
                .storage
                .from('tratativas')
                .list(`temp/${tratativaNumero}`);

            if (listError) {
                throw listError;
            }

            if (files && files.length > 0) {
                // Criar array de paths para deletar
                const filesToDelete = files.map(file => `temp/${tratativaNumero}/${file.name}`);

                // Deletar arquivos
                const { error: deleteError } = await supabase
                    .storage
                    .from('tratativas')
                    .remove(filesToDelete);

                if (deleteError) {
                    throw deleteError;
                }

                logger.info('Arquivos temporários removidos com sucesso', {
                    operation: 'Cleanup Temp Files',
                    details: {
                        tratativa: tratativaNumero,
                        filesRemoved: filesToDelete
                    }
                });
            } else {
                logger.info('Nenhum arquivo temporário encontrado para limpeza', {
                    operation: 'Cleanup Temp Files',
                    details: {
                        tratativa: tratativaNumero
                    }
                });
            }
        } catch (error) {
            // Melhorar o tratamento de erros para garantir uma mensagem válida
            const errorMessage = error?.message || 'Erro desconhecido (sem mensagem)';
            const errorDetails = {
                name: error?.name,
                code: error?.code,
                stack: error?.stack
            };
            
            logger.error('Erro ao limpar arquivos temporários no bucket', {
                operation: 'Cleanup Temp Files',
                error: errorMessage,
                errorDetails,
                details: {
                    tratativa: tratativaNumero
                }
            });
            throw error;
        }
    }

    async getTratativaByNumeroTratativa(numeroTratativa) {
        try {
            logger.info('Buscando tratativa por número da tratativa', {
                operation: 'Get Tratativa By Number',
                details: { numeroTratativa }
            });

            // Verificar se o número da tratativa é válido
            if (!numeroTratativa) {
                logger.error('Número da tratativa indefinido ou vazio', {
                    operation: 'Get Tratativa By Number',
                    details: { numeroTratativa }
                });
                return { data: null, error: new Error('Número da tratativa indefinido ou vazio') };
            }

            // Converter para string para garantir consistência na comparação
            const numeroTratativaStr = String(numeroTratativa);

            const { data, error } = await supabase
                .from('tratativas')
                .select('*')
                .eq('numero_tratativa', numeroTratativaStr)
                .single();

            if (error) throw error;

            logger.info('Tratativa recuperada por número da tratativa', {
                operation: 'Get Tratativa By Number',
                details: {
                    numeroTratativa,
                    found: !!data,
                    tratativaId: data?.id
                }
            });

            return { data, error: null };
        } catch (error) {
            logger.error('Erro ao buscar tratativa por número da tratativa', {
                operation: 'Get Tratativa By Number',
                error: {
                    message: error.message,
                    stack: error.stack
                },
                details: { numeroTratativa }
            });
            return { data: null, error };
        }
    }

    async listTrataticasSemDocumento() {
        try {
            logger.info('Buscando lista de tratativas sem documento', {
                operation: 'List Tratativas Without Document',
                source: 'Supabase'
            });

            // Buscar tratativas onde url_documento_enviado é nulo ou vazio
            const { data, error } = await supabase
                .from('tratativas')
                .select('*')
                .or('url_documento_enviado.is.null,url_documento_enviado.eq.')
                .order('created_at', { ascending: false });

            if (error) throw error;
            
            logger.info('Lista de tratativas sem documento recuperada', {
                operation: 'List Tratativas Without Document',
                details: {
                    count: data.length,
                    firstItem: data[0]?.id,
                    lastItem: data[data.length - 1]?.id
                }
            });

            return data;
        } catch (error) {
            logger.error('Erro ao listar tratativas sem documento', {
                operation: 'List Tratativas Without Document',
                error: {
                    message: error.message,
                    stack: error.stack
                }
            });
            throw error;
        }
    }

    async deleteTratativa(id) {
        try {
            logger.info('Iniciando exclusão de tratativa', {
                operation: 'Delete Tratativa',
                details: { id }
            });

            // Primeiro, buscar a tratativa para verificar se existe e obter o número da tratativa
            const { data: tratativa, error: fetchError } = await this.getTratativaById(id);
            
            if (fetchError) {
                throw fetchError;
            }
            
            if (!tratativa) {
                logger.error('Tratativa não encontrada para exclusão', {
                    operation: 'Delete Tratativa',
                    details: { id }
                });
                return { success: false, error: { message: `Tratativa com ID ${id} não encontrada` } };
            }
            
            // Se a tratativa tiver documentos no storage, excluir também
            if (tratativa.url_documento_enviado) {
                try {
                    // Extrair o caminho do arquivo no storage a partir da URL
                    const urlPartes = tratativa.url_documento_enviado.split('?')[0];
                    const caminho = urlPartes.split('/storage/tratativas/')[1];
                    
                    if (caminho) {
                        logger.info('Removendo documento do storage', {
                            operation: 'Delete Tratativa - Storage',
                            details: { 
                                id, 
                                caminho,
                                url: tratativa.url_documento_enviado
                            }
                        });
                        
                        // Remover documento do storage
                        const { error: storageError } = await supabase
                            .storage
                            .from('tratativas')
                            .remove([caminho]);
                            
                        if (storageError) {
                            logger.warn('Erro ao remover documento do storage, continuando com a exclusão da tratativa', {
                                operation: 'Delete Tratativa - Storage Error',
                                error: storageError.message,
                                details: { id, caminho }
                            });
                        } else {
                            logger.info('Documento removido do storage com sucesso', {
                                operation: 'Delete Tratativa - Storage Success',
                                details: { id, caminho }
                            });
                        }
                    }
                } catch (storageError) {
                    logger.warn('Erro ao processar exclusão do documento, continuando com a exclusão da tratativa', {
                        operation: 'Delete Tratativa - Storage Processing Error',
                        error: storageError.message,
                        details: { id, url: tratativa.url_documento_enviado }
                    });
                }
            }
            
            // Excluir a tratativa
            const { error: deleteError } = await supabase
                .from('tratativas')
                .delete()
                .eq('id', id);
                
            if (deleteError) {
                throw deleteError;
            }
            
            logger.info('Tratativa excluída com sucesso', {
                operation: 'Delete Tratativa',
                details: { 
                    id, 
                    numero_tratativa: tratativa.numero_tratativa,
                    funcionario: tratativa.funcionario 
                }
            });
            
            return { success: true };
        } catch (error) {
            logger.error('Erro ao excluir tratativa', {
                operation: 'Delete Tratativa',
                error: {
                    message: error.message,
                    code: error.code,
                    stack: error.stack
                },
                details: { id }
            });
            
            return { 
                success: false, 
                error: { 
                    message: error.message || 'Erro desconhecido ao excluir tratativa',
                    code: error.code 
                } 
            };
        }
    }
}

module.exports = new SupabaseService(); 