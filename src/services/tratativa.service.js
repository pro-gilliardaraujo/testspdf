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
            logger.info('Criando nova tratativa', {
                operation: 'Criar Tratativa',
                dados: dadosFormulario
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
                valor_praticado: dadosFormulario.valor_registrado,
                medida: dadosFormulario.metrica,
                texto_limite: dadosFormulario.valor_limite,
                mock: false,
                status: 'Pendente',
                created_at: new Date().toISOString()
            };

            const { data, error } = await supabase
                .from('tratativas')
                .insert(dadosTratativa)
                .select()
                .single();

            if (error) throw error;

            // Preparar dados para o template do PDF
            const templateData = {
                DOP_NUMERO_DOCUMENTO: data.numero_tratativa,
                DOP_NOME: data.funcionario,
                DOP_FUNCAO: data.funcao,
                DOP_SETOR: data.setor,
                DOP_DESC_INFRACAO: data.descricao_infracao,
                DOP_DATA_INFRACAO: dadosFormulario.data_infracao, // Mantém formato DD/MM/YYYY
                DOP_HORA_INFRACAO: data.hora_infracao,
                DOP_VALOR_REGISTRADO: data.valor_praticado,
                DOP_METRICA: data.medida,
                DOP_VALOR_LIMITE: data.texto_limite,
                DOP_DATA_EXTENSA: this.formatarDataExtensa(dadosFormulario.data_infracao),
                DOP_COD_INFRACAO: data.codigo_infracao,
                DOP_GRAU_PENALIDADE: data.codigo_infracao.split('-')[0], // Extrai P2 de P2-001
                DOP_DESC_PENALIDADE: data.texto_infracao,
                DOP_IMAGEM: dadosFormulario.url_imagem,
                DOP_LIDER: data.lider,
                DOP_CPF: dadosFormulario.cpf,
                tipo_penalidade: data.penalidade
            };

            logger.info('Tratativa criada com sucesso', {
                operation: 'Criar Tratativa',
                id: data.id,
                templateData
            });

            return {
                id: data.id,
                templateData
            };
        } catch (error) {
            logger.logError('Erro ao criar tratativa', error);
            throw error;
        }
    }
}

module.exports = new TratativaService(); 