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

    // Método auxiliar para detectar tipo de penalidade
    isPenaltyType(value, type) {
        if (!value) return false;
        
        const valueStr = String(value).toLowerCase();
        
        if (type === 'advertencia') {
            return valueStr.includes('advertencia') || valueStr.includes('advertência') || 
                   valueStr.includes('orientacao') || valueStr.includes('orientação') ||
                   valueStr.includes('verbal');
        }
        
        if (type === 'suspensao') {
            return valueStr.includes('suspensao') || valueStr.includes('suspensão') ||
                   valueStr.includes('suspenso');
        }
        
        // Para códigos como P1|P2 ou P3|P4
        if (type.includes('|')) {
            const codes = type.split('|');
            return codes.some(code => valueStr.includes(code.toLowerCase()));
        }
        
        return valueStr.includes(type.toLowerCase());
    }

    // Método auxiliar para extrair email do campo analista
    extractAnalystEmail(analistaField) {
        if (!analistaField) return '';
        
        const str = String(analistaField);
        
        // Procurar por email no formato: Nome(email@dominio) ou email@dominio
        const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
        const match = str.match(emailRegex);
        
        if (match && match[1]) {
            const email = match[1];
            // Verificar se é do domínio correto
            if (email.includes('@ib.logistica')) {
                return email;
            }
        }
        
        return '';
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
            const camposComPadrao = ['codigo_infracao', 'valor_praticado', 'metrica', 'valor_limite', 'url_imagem'];
            
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

            // Preparar dados para o banco (incluindo campos que existem na tabela)
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
                // 🔧 CAMPOS QUE EXISTEM NA TABELA E DEVEM SER SALVOS:
                imagem_evidencia1: dadosFormulario.url_imagem || null,
                advertido: dadosFormulario.advertido || null,
                texto_advertencia: dadosFormulario.texto_infracao || dadosFormulario.descricao_penalidade || null,
                mock: false,
                status: dadosFormulario.status || 'Pendente'
            };

            // Log dos dados que serão inseridos
            logger.info('Dados preparados para inserção no banco', {
                operation: 'Criar Tratativa - Dados Banco',
                dados_tratativa: {
                    ...dadosTratativa,
                    cpf: 'REDACTED'
                }
            });

            // Adicionar campo analista - procurar em vários campos possíveis
            let analista = '';
            
            // 🔍 LOG PARA DEBUG DOS CAMPOS DE ANALISTA
            logger.info('Debug campos analista recebidos', {
                operation: 'Criar Tratativa - Debug Analista',
                campos_recebidos: {
                    analista: dadosFormulario.analista,
                    nome_analista: dadosFormulario.nome_analista,
                    lider: dadosFormulario.nome_lider,
                    all_keys: Object.keys(dadosFormulario)
                }
            });
            
            // Procurar email em vários campos
            const camposParaAnalista = [
                dadosFormulario.analista,
                dadosFormulario.nome_analista,
                dadosFormulario.email_analista,
                dadosFormulario.analista_email
            ];
            
            for (const campo of camposParaAnalista) {
                if (campo) {
                    const emailExtraido = this.extractAnalystEmail(campo);
                    if (emailExtraido) {
                        analista = emailExtraido;
                        break;
                    }
                }
            }
            
            // Se não encontrou email mas tem valor no campo analista, usar como está
            if (!analista && dadosFormulario.analista && dadosFormulario.analista !== 'Advertido') {
                analista = dadosFormulario.analista;
            }
            
            dadosTratativa.analista = analista;

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

            // Preparar dados para o template do PDF usando dados originais do frontend
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
                // Usar dados originais do frontend (não salvos no banco)
                DOP_PENALIDADE: dadosFormulario.descricao_penalidade || dadosFormulario.texto_infracao || dadosFormulario.penalidade || 'Penalidade não especificada',
                DOP_IMAGEM: dadosFormulario.url_imagem || process.env.URL_IMAGEM_PADRAO || '',
                DOP_LIDER: data.lider,
                DOP_CPF: data.cpf,
                tipo_penalidade: data.penalidade,
                // Usar campo advertido do frontend + detectar por código/penalidade
                DOP_TEXTO_ADVERTENCIA: 'O colaborador foi advertido conforme as normas da empresa.',
                DOP_ADVERTIDO: (dadosFormulario.advertido === 'Advertido') || 
                              this.isPenaltyType(data.penalidade, 'advertencia') || 
                              this.isPenaltyType(data.codigo_infracao, 'P1|P2') ? 'X' : '',
                DOP_SUSPENSO: (dadosFormulario.advertido === 'Suspenso') || 
                             this.isPenaltyType(data.penalidade, 'suspensao') || 
                             this.isPenaltyType(data.codigo_infracao, 'P3|P4') ? 'X' : ''
            };

            // Log para debug dos dados do template
            logger.info('Dados do template PDF preparados', {
                operation: 'Template PDF Debug',
                campos_criticos: {
                    DOP_IMAGEM: templateData.DOP_IMAGEM,
                    DOP_PENALIDADE: templateData.DOP_PENALIDADE,
                    DOP_ADVERTIDO: templateData.DOP_ADVERTIDO,
                    DOP_SUSPENSO: templateData.DOP_SUSPENSO,
                    frontend_advertido: dadosFormulario.advertido,
                    frontend_url_imagem: dadosFormulario.url_imagem,
                    frontend_descricao_penalidade: dadosFormulario.descricao_penalidade
                }
            });

            return {
                id: data.id,
                templateData,
                dadosOriginais: dadosFormulario // Preservar dados originais para PDF
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