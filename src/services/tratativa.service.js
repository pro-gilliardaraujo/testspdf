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
            valor_limite: 'Valor Limite',
            codigo_infracao: 'Código da Infração',
            penalidade: 'Tipo de Penalidade',
            texto_infracao: 'Descrição da Penalidade',
            url_imagem: 'URL da Imagem',
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
            const camposComPadrao = ['valor_praticado', 'valor_limite', 'codigo_infracao', 'url_imagem'];
            
            if (!dados[campo] && dados[campo] !== 0 && dados[campo] !== '0') {
                // Se o campo tem padrão e está vazio, usar valor padrão
                if (camposComPadrao.includes(campo)) {
                    if (campo === 'valor_praticado' || campo === 'valor_limite') {
                        dados[campo] = '0';
                    } else if (campo === 'codigo_infracao') {
                        dados[campo] = '--';
                    } else if (campo === 'url_imagem') {
                        dados[campo] = process.env.URL_IMAGEM_PADRAO || '';
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
            // Removido metrica pois não existe na tabela do banco

            // Log dos valores processados
            logger.info('Valores após processamento', {
                operation: 'Criar Tratativa - Valores Processados',
                valores: {
                    valor_praticado,
                    valor_limite
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
                // Removendo o campo texto_infracao que está causando o erro
                // texto_infracao: String(dadosFormulario.texto_excesso || '').trim(),
                lider: String(dadosFormulario.nome_lider || '').trim(),
                valor_praticado,
                texto_limite: valor_limite,
                // Removendo o campo url_imagem que está causando o erro
                // url_imagem: String(dadosFormulario.url_imagem || '').trim(),
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