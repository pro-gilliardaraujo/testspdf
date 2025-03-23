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
            nome_funcionario: 'Nome do Funcionário',
            funcao: 'Função',
            setor: 'Setor',
            cpf: 'CPF',
            infracao_cometida: 'Descrição da Infração',
            data_infracao: 'Data da Infração',
            hora_infracao: 'Hora da Infração',
            valor_praticado: 'Valor Registrado',
            metrica: 'Métrica',
            valor_limite: 'Valor Limite',
            codigo_infracao: 'Código da Infração',
            penalidade: 'Tipo de Penalidade',
            texto_infracao: 'Descrição da Penalidade',
            url_imagem: 'URL da Imagem',
            nome_lider: 'Líder'
        };

        const camposFaltantes = [];
        for (const [campo, nome] of Object.entries(camposObrigatorios)) {
            if (!dados[campo] && dados[campo] !== 0 && dados[campo] !== '0') {
                camposFaltantes.push(nome);
            }
        }

        if (camposFaltantes.length > 0) {
            logger.error('Campos obrigatórios faltando', {
                operation: 'Validação de Formulário',
                campos_faltantes: camposFaltantes,
                dados_recebidos: {
                    ...dados,
                    cpf: 'REDACTED'
                }
            });
            throw new Error(`Campos obrigatórios faltando: ${camposFaltantes.join(', ')}`);
        }

        // Validação adicional dos valores numéricos
        if (isNaN(parseFloat(dados.valor_praticado))) {
            throw new Error('Valor Registrado deve ser um número válido');
        }

        if (isNaN(parseFloat(dados.valor_limite))) {
            throw new Error('Valor Limite deve ser um número válido');
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
            const valor_praticado = this.formatarValorNumerico(dadosFormulario.valor_praticado);
            const valor_limite = this.formatarValorNumerico(dadosFormulario.valor_limite);
            const metrica = this.formatarValorNumerico(dadosFormulario.metrica, 'ocorrências');

            // Log dos valores processados
            logger.info('Valores após processamento', {
                operation: 'Criar Tratativa - Valores Processados',
                valores: {
                    valor_praticado,
                    valor_limite,
                    metrica
                }
            });

            // Preparar dados para o banco
            const dadosTratativa = {
                numero_tratativa: String(dadosFormulario.numero_documento || '').trim(),
                funcionario: String(dadosFormulario.nome_funcionario || '').trim(),
                funcao: String(dadosFormulario.funcao || '').trim(),
                setor: String(dadosFormulario.setor || '').trim(),
                cpf: String(dadosFormulario.cpf || '').trim(),
                data_infracao: dadosFormulario.data_infracao,  // Removida formatação pois já vem no formato correto
                hora_infracao: String(dadosFormulario.hora_infracao || '').trim(),
                codigo_infracao: String(dadosFormulario.codigo_infracao || '').trim(),
                descricao_infracao: String(dadosFormulario.infracao_cometida || '').trim(),
                penalidade: String(dadosFormulario.penalidade || '').trim(),
                texto_infracao: String(dadosFormulario.texto_infracao || '').trim(),
                lider: String(dadosFormulario.nome_lider || '').trim(),
                valor_praticado,
                medida: metrica,
                texto_limite: valor_limite,
                url_imagem: String(dadosFormulario.url_imagem || '').trim(),
                mock: false,
                status: dadosFormulario.status || 'Pendente'
            };

            // Log detalhado dos dados preparados para o banco
            logger.info('Dados preparados para inserção', {
                operation: 'Criar Tratativa - Dados Preparados',
                dados_tratativa: {
                    ...dadosTratativa,
                    cpf: 'REDACTED'
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
                    }
                });
                throw error;
            }

            // Preparar dados para o template do PDF
            const templateData = {
                DOP_NUMERO_DOCUMENTO: data.numero_tratativa,
                DOP_NOME: data.funcionario,
                DOP_FUNCAO: data.funcao,
                DOP_SETOR: data.setor,
                DOP_DESCRICAO: data.descricao_infracao,
                DOP_DATA: this.formatarDataParaBanco(data.data_infracao),
                DOP_HORA: data.hora_infracao,
                DOP_DATA_EXTENSA: this.formatarDataExtensa(data.data_infracao),
                DOP_COD_INFRACAO: data.codigo_infracao,
                DOP_GRAU: data.codigo_infracao.split('-')[0],
                DOP_PENALIDADE: data.texto_infracao,
                DOP_IMAGEM: data.url_imagem,
                DOP_LIDER: data.lider,
                DOP_CPF: data.cpf,
                tipo_penalidade: data.penalidade
            };

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