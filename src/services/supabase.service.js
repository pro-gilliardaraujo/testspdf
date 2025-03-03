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
                    fileSize: file.length
                }
            });

            const { data, error } = await supabase
                .storage
                .from('tratativas')
                .upload(path, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) throw error;

            const { data: urlData } = supabase
                .storage
                .from('tratativas')
                .getPublicUrl(path);

            logger.info('Arquivo enviado com sucesso', {
                operation: 'Upload File',
                details: {
                    path,
                    publicUrl: urlData.publicUrl,
                    uploadResponse: data
                }
            });

            return urlData.publicUrl;
        } catch (error) {
            logger.logError('Erro no upload do arquivo', error, {
                operation: 'Upload File',
                details: { path }
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
}

module.exports = new SupabaseService(); 