// Arrays for random data generation
const nomes = [
    'João Silva', 'Maria Santos', 'Pedro Oliveira', 'Ana Souza', 
    'Carlos Ferreira', 'Juliana Lima', 'Roberto Alves', 'Patricia Costa',
    'Lucas Mendes', 'Fernanda Costa', 'Ricardo Santos', 'Amanda Lima',
    'Bruno Oliveira', 'Camila Ferreira', 'Diego Souza', 'Elaine Silva'
];

const funcoes = [
    'Motorista', 'Operador de Empilhadeira', 'Auxiliar de Produção',
    'Conferente', 'Supervisor de Logística', 'Analista de Qualidade',
    'Operador de Máquinas', 'Auxiliar de Almoxarifado', 'Técnico de Segurança',
    'Assistente de Expedição', 'Líder de Produção', 'Auxiliar de Estoque'
];

const setores = [
    'Logística', 'Produção', 'Expedição', 'Almoxarifado',
    'Qualidade', 'Manutenção', 'Recebimento', 'Estoque',
    'Segurança do Trabalho', 'Operações', 'Distribuição', 'Controle de Qualidade'
];

const infracoes = [
    { codigo: '51', descricao: 'Excesso de velocidade' },
    { codigo: '32', descricao: 'Não utilização de EPI' },
    { codigo: '43', descricao: 'Procedimento incorreto de operação' },
    { codigo: '27', descricao: 'Falta de atenção na operação' },
    { codigo: '18', descricao: 'Descumprimento de norma de segurança' },
    { codigo: '22', descricao: 'Uso inadequado de equipamentos' },
    { codigo: '35', descricao: 'Desorganização do ambiente de trabalho' },
    { codigo: '41', descricao: 'Atraso na execução das atividades' }
];

const penalidades = [
    { codigo: 'P1', descricao: 'Advertência Verbal' },
    { codigo: 'P2', descricao: 'Advertência Escrita' },
    { codigo: 'P3', descricao: 'Suspensão 1 dia' },
    { codigo: 'P4', descricao: 'Suspensão 3 dias' },
    { codigo: 'P5', descricao: 'Suspensão 5 dias' }
];

// Helper functions
function getRandomItem(array) {
    return array[Math.floor(Math.random() * array.length)];
}

function generateNumeroDocumento() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

function generateRandomTime() {
    const hours = String(Math.floor(Math.random() * 24)).padStart(2, '0');
    const minutes = String(Math.floor(Math.random() * 60)).padStart(2, '0');
    return `${hours}:${minutes}`;
}

function generateRandomDate() {
    const start = new Date(2024, 0, 1);
    const end = new Date();
    const randomDate = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
    return randomDate.toLocaleDateString('pt-BR');
}

function generateRandomMetrics() {
    const baseMetrics = [
        { base: 15, variation: 5, unidade: 'km/h' },
        { base: 85, variation: 15, unidade: 'dB' },
        { base: 8, variation: 4, unidade: 'm/s' },
        { base: 25, variation: 10, unidade: 'kg' },
        { base: 120, variation: 30, unidade: 'min' }
    ];

    const selectedMetric = getRandomItem(baseMetrics);
    const limite = selectedMetric.base;
    const praticado = limite + Math.floor(Math.random() * selectedMetric.variation) + 1;

    return {
        praticado: praticado.toString(),
        limite: limite.toString(),
        unidade: selectedMetric.unidade
    };
}

// Main function to generate mock data
function generateMockData() {
    const metrics = generateRandomMetrics();
    const infracao = getRandomItem(infracoes);
    const penalidade = getRandomItem(penalidades);
    const funcionario = getRandomItem(nomes);
    const lider = getRandomItem(nomes.filter(nome => nome !== funcionario));
    
    return {
        numeroDocumento: generateNumeroDocumento(),
        nome: funcionario,
        funcao: getRandomItem(funcoes),
        setor: getRandomItem(setores),
        codigoInfracao: infracao.codigo,
        descricaoInfracao: infracao.descricao,
        dataOcorrencia: generateRandomDate(),
        horaOcorrencia: generateRandomTime(),
        codigoMedida: penalidade.codigo,
        descricaoMedida: penalidade.descricao,
        evidencias: [
            {
                url: '/assets/images/evidenceexample.png'
            }
        ],
        informacoesEvidencia: [
            `Valor registrado: ${metrics.praticado}${metrics.unidade}`,
            `Limite permitido: ${metrics.limite}${metrics.unidade}`
        ],
        nomeLider: lider
    };
}

module.exports = {
    generateMockData
}; 