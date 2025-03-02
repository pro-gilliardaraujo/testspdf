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
                numero_documento: dadosFormulario.numero_documento,
                nome_colaborador: dadosFormulario.nome,
                funcao: dadosFormulario.funcao,
                setor: dadosFormulario.setor,
                cpf: dadosFormulario.cpf,
                descricao_infracao: dadosFormulario.descricao_infracao,
                data_infracao: this.formatarDataParaBanco(dadosFormulario.data_infracao),
                hora_infracao: dadosFormulario.hora_infracao,
                valor_registrado: dadosFormulario.valor_registrado,
                metrica: dadosFormulario.metrica,
                valor_limite: dadosFormulario.valor_limite,
                codigo_infracao: dadosFormulario.codigo_infracao,
                grau_penalidade: dadosFormulario.grau_penalidade,
                tipo_penalidade: dadosFormulario.tipo_penalidade,
                descricao_penalidade: dadosFormulario.descricao_penalidade,
                url_imagem: dadosFormulario.url_imagem,
                lider: dadosFormulario.lider,
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
                DOP_NUMERO_DOCUMENTO: data.numero_documento,
                DOP_NOME: data.nome_colaborador,
                DOP_FUNCAO: data.funcao,
                DOP_SETOR: data.setor,
                DOP_DESC_INFRACAO: data.descricao_infracao,
                DOP_DATA_INFRACAO: dadosFormulario.data_infracao, // Mantém formato DD/MM/YYYY
                DOP_HORA_INFRACAO: data.hora_infracao,
                DOP_VALOR_REGISTRADO: data.valor_registrado,
                DOP_METRICA: data.metrica,
                DOP_VALOR_LIMITE: data.valor_limite,
                DOP_DATA_EXTENSA: this.formatarDataExtensa(dadosFormulario.data_infracao),
                DOP_COD_INFRACAO: data.codigo_infracao,
                DOP_GRAU_PENALIDADE: data.grau_penalidade,
                DOP_DESC_PENALIDADE: data.descricao_penalidade,
                DOP_IMAGEM: data.url_imagem,
                DOP_LIDER: data.lider,
                DOP_CPF: data.cpf,
                tipo_penalidade: data.tipo_penalidade
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