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

    validarDadosFormulario(dados) {
        const camposObrigatorios = {
            numero_documento: 'Número do Documento',
            nome: 'Nome do Funcionário',
            funcao: 'Função',
            setor: 'Setor',
            cpf: 'CPF',
            descricao_infracao: 'Descrição da Infração',
            data_infracao: 'Data da Infração',
            hora_infracao: 'Hora da Infração',
            valor_registrado: 'Valor Registrado',
            metrica: 'Métrica',
            valor_limite: 'Valor Limite',
            codigo_infracao: 'Código da Infração',
            tipo_penalidade: 'Tipo de Penalidade',
            descricao_penalidade: 'Descrição da Penalidade',
            url_imagem: 'URL da Imagem',
            lider: 'Líder'
        };

        const camposFaltantes = [];
        for (const [campo, nome] of Object.entries(camposObrigatorios)) {
            if (!dados[campo] && dados[campo] !== 0 && dados[campo] !== '0') {
                camposFaltantes.push(nome);
            }
        }

        if (camposFaltantes.length > 0) {
            throw new Error(`Campos obrigatórios faltando: ${camposFaltantes.join(', ')}`);
        }
    }

    async criarTratativa(dadosFormulario) {
        try {
            // Validar dados do formulário
            this.validarDadosFormulario(dadosFormulario);

            // Log inicial com dados recebidos
            logger.info('Iniciando criação de tratativa', {
                operation: 'Criar Tratativa - Início',
                dados_recebidos: {
                    ...dadosFormulario,
                    cpf: 'REDACTED'
                }
            });

            // Garantir que valores numéricos não sejam nulos
            const valor_praticado = String(dadosFormulario.valor_registrado || '0').trim();
            const texto_limite = String(dadosFormulario.valor_limite || '0').trim();
            const metrica = String(dadosFormulario.metrica || 'ocorrências').trim();

            // Log do tratamento de valores numéricos
            logger.info('Processando valores numéricos', {
                operation: 'Criar Tratativa - Valores Numéricos',
                valores_originais: {
                    valor_registrado: dadosFormulario.valor_registrado,
                    valor_limite: dadosFormulario.valor_limite,
                    metrica: dadosFormulario.metrica
                },
                valores_processados: {
                    valor_praticado,
                    texto_limite,
                    metrica
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
                numero_tratativa: String(dadosFormulario.numero_documento).trim(),
                funcionario: String(dadosFormulario.nome).trim(),
                funcao: String(dadosFormulario.funcao).trim(),
                setor: String(dadosFormulario.setor).trim(),
                cpf: String(dadosFormulario.cpf).trim(),
                data_infracao: this.formatarDataParaBanco(dadosFormulario.data_infracao),
                hora_infracao: String(dadosFormulario.hora_infracao).trim(),
                codigo_infracao: String(dadosFormulario.codigo_infracao).trim(),
                descricao_infracao: String(dadosFormulario.descricao_infracao).trim(),
                penalidade: String(dadosFormulario.tipo_penalidade).trim(),
                texto_infracao: String(dadosFormulario.descricao_penalidade).trim(),
                lider: String(dadosFormulario.lider).trim(),
                valor_praticado,
                medida: metrica,
                texto_limite,
                mock: false,
                status: 'Pendente',
                created_at: new Date().toISOString()
            };

            // Log dos dados preparados para o banco
            logger.info('Dados preparados para inserção', {
                operation: 'Criar Tratativa - Dados Preparados',
                dados_tratativa: {
                    ...dadosTratativa,
                    cpf: 'REDACTED'
                }
            });

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