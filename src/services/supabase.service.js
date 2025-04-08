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
            logger.info('Iniciando upload de arquivo', {
                operation: 'Upload File',
                details: {
                    path,
                    fileSize: file.length,
                    destinationBucket: 'tratativas',
                    fullPath: `storage/tratativas/${path}`
                }
            });

            // Verificar se o arquivo já existe
            const { data: existingFile } = await supabase
                .storage
                .from('tratativas')
                .list(path.split('/').slice(0, -1).join('/'));

            const fileName = path.split('/').pop();
            const fileExists = existingFile?.some(f => f.name === fileName);

            if (fileExists) {
                logger.info('Arquivo já existe, será substituído', {
                    operation: 'Upload File',
                    details: {
                        path,
                        fileName,
                        action: 'replace'
                    }
                });
            }

            const { data, error } = await supabase
                .storage
                .from('tratativas')
                .upload(path, file, {
                    cacheControl: '3600',
                    upsert: true,
                    contentType: 'application/pdf'
                });

            if (error) throw error;

            const { data: urlData } = await supabase
                .storage
                .from('tratativas')
                .createSignedUrl(path, 31536000, {
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
                    path,
                    fileName,
                    destinationBucket: 'tratativas',
                    fullPath: `storage/tratativas/${path}`,
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
                    documentPath: path,
                    accessUrl: urlData.signedUrl,
                    bucket: 'tratativas',
                    storagePath: `storage/tratativas/${path}`,
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
                    destinationBucket: 'tratativas',
                    attemptedFullPath: `storage/tratativas/${path}`,
                    fileSize: file.length
                }
            });
            throw error;
        }
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
            logger.error('Erro ao limpar arquivos temporários no bucket', {
                operation: 'Cleanup Temp Files',
                error: error.message,
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
}

module.exports = new SupabaseService(); 