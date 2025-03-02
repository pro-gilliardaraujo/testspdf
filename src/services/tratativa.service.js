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

    formatarValorNumerico(valor, padrao = '0') {
        if (valor === null || valor === undefined) {
            return padrao;
        }

        // Se já for string, apenas faz trim
        if (typeof valor === 'string') {
            const valorTrim = valor.trim();
            return valorTrim === '' ? padrao : valorTrim;
        }

        // Se for número, converte para string
        if (typeof valor === 'number') {
            return String(valor);
        }

        // Para qualquer outro tipo, retorna o valor padrão
        return padrao;
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

            // Garantir que valores numéricos não sejam nulos e converter para string
            const valor_registrado = dadosFormulario.valor_registrado;
            const valor_limite = dadosFormulario.valor_limite;

            // Log dos valores antes do processamento
            logger.info('Valores antes do processamento', {
                operation: 'Criar Tratativa - Valores Brutos',
                valores: {
                    valor_registrado,
                    valor_limite,
                    tipos: {
                        valor_registrado: typeof valor_registrado,
                        valor_limite: typeof valor_limite
                    }
                }
            });

            // Processamento dos valores usando o novo método
            const valor_praticado = this.formatarValorNumerico(valor_registrado);
            const texto_limite = this.formatarValorNumerico(valor_limite);
            const metrica = this.formatarValorNumerico(dadosFormulario.metrica, 'ocorrências');

            // Log após processamento
            logger.info('Valores após processamento', {
                operation: 'Criar Tratativa - Valores Processados',
                valores: {
                    valor_praticado,
                    texto_limite,
                    metrica,
                    tipos: {
                        valor_praticado: typeof valor_praticado,
                        texto_limite: typeof texto_limite,
                        metrica: typeof metrica
                    }
                }
            });

            // Preparar dados para o banco (garantindo que todos os campos são texto)
            const dadosTratativa = {
                numero_tratativa: String(dadosFormulario.numero_documento || '').trim(),
                funcionario: String(dadosFormulario.nome || '').trim(),
                funcao: String(dadosFormulario.funcao || '').trim(),
                setor: String(dadosFormulario.setor || '').trim(),
                cpf: String(dadosFormulario.cpf || '').trim(),
                data_infracao: this.formatarDataParaBanco(dadosFormulario.data_infracao),
                hora_infracao: String(dadosFormulario.hora_infracao || '').trim(),
                codigo_infracao: String(dadosFormulario.codigo_infracao || '').trim(),
                descricao_infracao: String(dadosFormulario.descricao_infracao || '').trim(),
                penalidade: String(dadosFormulario.tipo_penalidade || '').trim(),
                texto_infracao: String(dadosFormulario.descricao_penalidade || '').trim(),
                lider: String(dadosFormulario.lider || '').trim(),
                valor_praticado: String(valor_praticado),
                medida: String(metrica),
                texto_limite: String(texto_limite),
                mock: false,
                status: String('Pendente')
            };

            // Validação extra dos campos críticos
            if (!dadosTratativa.texto_limite) {
                logger.error('Valor limite inválido', {
                    operation: 'Criar Tratativa - Validação Extra',
                    valor_original: valor_limite,
                    valor_processado: texto_limite,
                    dados_tratativa: dadosTratativa
                });
                throw new Error('Valor limite inválido ou não fornecido');
            }

            // Log detalhado dos dados preparados para o banco
            logger.info('Dados preparados para inserção', {
                operation: 'Criar Tratativa - Dados Preparados',
                dados_tratativa: {
                    ...dadosTratativa,
                    cpf: 'REDACTED'
                },
                tipos: {
                    valor_praticado: typeof dadosTratativa.valor_praticado,
                    texto_limite: typeof dadosTratativa.texto_limite,
                    medida: typeof dadosTratativa.medida
                },
                valores_numericos: {
                    valor_praticado: dadosTratativa.valor_praticado,
                    texto_limite: dadosTratativa.texto_limite
                }
            });

            // Log antes da inserção no banco
            logger.info('Tentando inserir no banco de dados', {
                operation: 'Criar Tratativa - Inserção',
                tabela: 'tratativas',
                dados_criticos: {
                    valor_praticado: dadosTratativa.valor_praticado,
                    texto_limite: dadosTratativa.texto_limite,
                    medida: dadosTratativa.medida
                }
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
                    },
                    valores_criticos: {
                        valor_praticado: dadosTratativa.valor_praticado,
                        texto_limite: dadosTratativa.texto_limite,
                        medida: dadosTratativa.medida
                    }
                });
                throw error;
            }

            // Log do sucesso da inserção
            logger.info('Registro inserido com sucesso', {
                operation: 'Criar Tratativa - Sucesso Inserção',
                id: data.id,
                numero_tratativa: data.numero_tratativa,
                valores_inseridos: {
                    valor_praticado: data.valor_praticado,
                    texto_limite: data.texto_limite,
                    medida: data.medida
                }
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