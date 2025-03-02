const supabase = require('../config/supabase');
const logger = require('../utils/logger');

class TratativaService {
    formatarDataParaBanco(data) {
        const [dia, mes, ano] = data.split('/');
        return `${ano}-${mes}-${dia}`;
    }

    formatarDataExtensa(data) {
        const [dia, mes, ano] = data.split('/');
        const dataObj = new Date(ano, mes - 1, dia);
        return dataObj.toLocaleDateString('pt-BR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    }

    async criarTratativa(dadosFormulario) {
        try {
            // Log inicial com dados recebidos
            logger.info('Iniciando criação de tratativa', {
                operation: 'Criar Tratativa - Início',
                dados_recebidos: {
                    ...dadosFormulario,
                    cpf: 'REDACTED' // Não logar CPF completo por segurança
                }
            });

            // Log do tratamento de valores numéricos
            logger.info('Processando valores numéricos', {
                operation: 'Criar Tratativa - Valores Numéricos',
                valores_originais: {
                    valor_registrado: dadosFormulario.valor_registrado,
                    valor_limite: dadosFormulario.valor_limite,
                    metrica: dadosFormulario.metrica
                }
            });

            // Garantir que valores numéricos não sejam nulos
            const valor_praticado = dadosFormulario.valor_registrado || '0';
            const texto_limite = dadosFormulario.valor_limite || '0';

            // Log após tratamento de valores numéricos
            logger.info('Valores numéricos processados', {
                operation: 'Criar Tratativa - Valores Processados',
                valores_processados: {
                    valor_praticado,
                    texto_limite,
                    medida: dadosFormulario.metrica || 'ocorrências'
                }
            });

            // Log do processamento de datas
            logger.info('Processando datas', {
                operation: 'Criar Tratativa - Datas',
                data_original: dadosFormulario.data_infracao,
                data_banco: this.formatarDataParaBanco(dadosFormulario.data_infracao),
                data_extensa: this.formatarDataExtensa(dadosFormulario.data_infracao)
            });

            // Preparar dados para o banco
            const dadosTratativa = {
                numero_tratativa: dadosFormulario.numero_documento,
                funcionario: dadosFormulario.nome,
                funcao: dadosFormulario.funcao,
                setor: dadosFormulario.setor,
                cpf: dadosFormulario.cpf,
                data_infracao: this.formatarDataParaBanco(dadosFormulario.data_infracao),
                hora_infracao: dadosFormulario.hora_infracao,
                codigo_infracao: dadosFormulario.codigo_infracao,
                descricao_infracao: dadosFormulario.descricao_infracao,
                penalidade: dadosFormulario.tipo_penalidade,
                texto_infracao: dadosFormulario.descricao_penalidade,
                lider: dadosFormulario.lider,
                valor_praticado: valor_praticado,
                medida: dadosFormulario.metrica || 'ocorrências',
                texto_limite: texto_limite,
                mock: false,
                status: 'Pendente',
                created_at: new Date().toISOString()
            };

            // Log dos dados preparados para o banco
            logger.info('Dados preparados para inserção', {
                operation: 'Criar Tratativa - Dados Preparados',
                dados_tratativa: {
                    ...dadosTratativa,
                    cpf: 'REDACTED' // Não logar CPF completo por segurança
                }
            });

            // Validar campos obrigatórios
            const camposObrigatorios = [
                'numero_tratativa',
                'funcionario',
                'funcao',
                'setor',
                'data_infracao',
                'hora_infracao',
                'codigo_infracao',
                'descricao_infracao',
                'penalidade',
                'texto_infracao',
                'lider',
                'valor_praticado',
                'medida',
                'texto_limite'
            ];

            // Log da validação de campos obrigatórios
            logger.info('Validando campos obrigatórios', {
                operation: 'Criar Tratativa - Validação',
                campos_verificados: camposObrigatorios
            });

            const camposFaltantes = camposObrigatorios.filter(campo => !dadosTratativa[campo]);
            if (camposFaltantes.length > 0) {
                logger.error('Campos obrigatórios faltando', {
                    operation: 'Criar Tratativa - Erro Validação',
                    campos_faltantes: camposFaltantes
                });
                throw new Error(`Campos obrigatórios faltando: ${camposFaltantes.join(', ')}`);
            }

            // Log antes da inserção no banco
            logger.info('Tentando inserir no banco de dados', {
                operation: 'Criar Tratativa - Inserção',
                tabela: 'tratativas'
            });

            const { data, error } = await supabase
                .from('tratativas')
                .insert(dadosTratativa)
                .select()
                .single();

            if (error) {
                logger.error('Erro na inserção no banco', {
                    operation: 'Criar Tratativa - Erro Banco',
                    erro: error,
                    dados_enviados: {
                        ...dadosTratativa,
                        cpf: 'REDACTED'
                    }
                });
                throw error;
            }

            // Log do sucesso da inserção
            logger.info('Registro inserido com sucesso', {
                operation: 'Criar Tratativa - Sucesso Inserção',
                id: data.id,
                numero_tratativa: data.numero_tratativa
            });

            // Preparar dados para o template do PDF
            const templateData = {
                DOP_NUMERO_DOCUMENTO: data.numero_tratativa,
                DOP_NOME: data.funcionario,
                DOP_FUNCAO: data.funcao,
                DOP_SETOR: data.setor,
                DOP_DESC_INFRACAO: data.descricao_infracao,
                DOP_DATA_INFRACAO: dadosFormulario.data_infracao,
                DOP_HORA_INFRACAO: data.hora_infracao,
                DOP_VALOR_REGISTRADO: data.valor_praticado,
                DOP_METRICA: data.medida,
                DOP_VALOR_LIMITE: data.texto_limite,
                DOP_DATA_EXTENSA: this.formatarDataExtensa(dadosFormulario.data_infracao),
                DOP_COD_INFRACAO: data.codigo_infracao,
                DOP_GRAU_PENALIDADE: data.codigo_infracao.split('-')[0],
                DOP_DESC_PENALIDADE: data.texto_infracao,
                DOP_IMAGEM: dadosFormulario.url_imagem,
                DOP_LIDER: data.lider,
                DOP_CPF: dadosFormulario.cpf,
                tipo_penalidade: data.penalidade
            };

            // Log dos dados preparados para o template
            logger.info('Dados preparados para o template', {
                operation: 'Criar Tratativa - Template',
                template_data: {
                    ...templateData,
                    DOP_CPF: 'REDACTED'
                }
            });

            // Log final de sucesso
            logger.info('Tratativa criada com sucesso', {
                operation: 'Criar Tratativa - Finalizado',
                id: data.id,
                numero_tratativa: data.numero_tratativa
            });

            return {
                id: data.id,
                templateData
            };
        } catch (error) {
            // Log detalhado do erro
            logger.error('Erro ao criar tratativa', {
                operation: 'Criar Tratativa - Erro',
                erro: {
                    mensagem: error.message,
                    stack: error.stack,
                    codigo: error.code
                },
                dados_formulario: {
                    ...dadosFormulario,
                    cpf: 'REDACTED'
                }
            });
            throw error;
        }
    }
}

module.exports = new TratativaService(); 