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
        // Campos obrigatórios que existem na tabela do banco
        const camposObrigatorios = {
            numero_documento: 'Número do Documento',
            nome_funcionario: 'Nome do Funcionário',
            funcao: 'Função',
            setor: 'Setor',
            cpf: 'CPF',
            infracao_cometida: 'Descrição da Infração',
            data_infracao: 'Data da Infração',
            hora_infracao: 'Hora da Infração',
            codigo_infracao: 'Código da Infração',
            penalidade: 'Tipo de Penalidade',
            nome_lider: 'Líder'
        };

        // Lista de campos opcionais para referência
        const camposOpcionais = [
            'analista',
            'nome_analista'
        ];

        const camposFaltantes = [];
        for (const [campo, nome] of Object.entries(camposObrigatorios)) {
            // Campos que podem ter valores padrão
            const camposComPadrao = ['codigo_infracao'];
            
            if (!dados[campo] && dados[campo] !== 0 && dados[campo] !== '0') {
                // Se o campo tem padrão e está vazio, usar valor padrão
                if (camposComPadrao.includes(campo)) {
                    if (campo === 'codigo_infracao') {
                        dados[campo] = '--';
                    }
                } else {
                    camposFaltantes.push(nome);
                }
            }
        }

        if (camposFaltantes.length > 0) {
            logger.error('Campos obrigatórios faltando', {
                operation: 'Validação de Formulário',
                campos_faltantes: camposFaltantes,
                campos_opcionais: camposOpcionais,
                dados_recebidos: {
                    ...dados,
                    cpf: 'REDACTED'
                }
            });
            throw new Error(`Campos obrigatórios faltando: ${camposFaltantes.join(', ')}`);
        }

        // Validações numéricas removidas pois os campos não existem na tabela
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

            // Campos removidos pois não existem na tabela do banco:
            // - valor_praticado
            // - valor_limite (texto_limite)
            // - metrica

            // Log dos valores processados
            logger.info('Dados validados e prontos para inserção', {
                operation: 'Criar Tratativa - Validação Concluída',
                status: 'Dados válidos para o schema do banco'
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
                lider: String(dadosFormulario.nome_lider || '').trim(),
                // Campos removidos por não existirem na tabela:
                // valor_praticado, texto_limite, url_imagem, texto_infracao
                mock: false,
                status: dadosFormulario.status || 'Pendente'
            };

            // Adicionar campo analista apenas se estiver presente
            if (dadosFormulario.analista) {
                dadosTratativa.analista = String(dadosFormulario.analista).trim();
            } else if (dadosFormulario.nome_analista) {
                dadosTratativa.analista = String(dadosFormulario.nome_analista).trim();
            } else {
                // Se não houver analista, definir como string vazia ou null
                dadosTratativa.analista = '';
            }

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
                DOP_CODIGO: data.codigo_infracao,
                DOP_GRAU: data.codigo_infracao.split('-')[0],
                DOP_PENALIDADE: data.texto_infracao,
                DOP_IMAGEM: data.url_imagem,
                DOP_LIDER: data.lider,
                DOP_CPF: data.cpf,
                tipo_penalidade: data.penalidade,
                // Adicionando campos obrigatórios para a Folha 2
                DOP_TEXTO_ADVERTENCIA: data.texto_advertencia || 'O colaborador foi advertido conforme as normas da empresa.',
                DOP_ADVERTIDO: data.penalidade.toLowerCase().includes('advertência') ? 'X' : '',
                DOP_SUSPENSO: data.penalidade.toLowerCase().includes('suspensão') ? 'X' : ''
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