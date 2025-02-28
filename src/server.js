const express = require('express');
const handlebars = require('handlebars');
const fs = require('fs').promises;
const path = require('path');
const { generateMockData } = require('./mockData');

const app = express();
const port = 3000;

// Get the absolute path to the workspace root
const workspaceRoot = path.join(__dirname, '..');

// Middleware to parse JSON bodies
app.use(express.json());

// Serve static files from assets directory
app.use('/assets', express.static(path.join(workspaceRoot, 'assets')));

// Fixed/static values
const FIXED_VALUES = {
    titulo: 'ACR-003_Medida_Disciplinar',
    anexo: 'Anexo',
    tipoDocumento: 'Controlado',
    codigoDocumento: 'PRO_003',
    logoUrl: '/assets/images/logo.png',
    textoNotificacao: 'Pelo presente o notificamos que nesta data está recebendo uma medida disciplinar, em razão da não conformidade abaixo discriminada.',
    textosLegais: [
        'Lembramos que caso haja incidência na mesma falta, será penalizado(a), conforme a CONSOLIDAÇÃO DAS LEIS TRABALHISTAS e o procedimento disciplinar da empresa.',
        'Esclarecemos que, a reiteração no cometimento de irregularidades autoriza a rescisão do contrato de trabalho por justa causa, razão pela qual esperamos que evite a reincidência da não conformidade, para que não tenhamos no futuro, de tomar medidas que são facultadas por lei à empresa.'
    ]
};

// Helper function to format date
function formatDate(date) {
    const options = { day: 'numeric', month: 'long', year: 'numeric' };
    return new Date(date).toLocaleDateString('pt-BR', options);
}

// Function to map frontend data to template data
function mapDataToTemplate(frontendData) {
    // Get evidence information
    const evidencias = [];
    const informacoesEvidencia = [];
    
    if (frontendData.evidence1_url) evidencias.push({ url: frontendData.evidence1_url });
    if (frontendData.evidence2_url) evidencias.push({ url: frontendData.evidence2_url });
    if (frontendData.evidence3_url) evidencias.push({ url: frontendData.evidence3_url });
    
    if (frontendData.valor_praticado) {
        informacoesEvidencia.push(`Valor registrado: ${frontendData.valor_praticado}${frontendData.metrica}`);
    }
    if (frontendData.valor_limite) {
        informacoesEvidencia.push(`Limite permitido: ${frontendData.valor_limite}${frontendData.metrica}`);
    }

    return {
        ...FIXED_VALUES,
        numeroDocumento: frontendData.numero_documento,
        nome: frontendData.nome_funcionario,
        dataFormatada: formatDate(new Date()),
        funcao: frontendData.funcao,
        setor: frontendData.setor,
        codigoInfracao: frontendData.codigo_infracao,
        descricaoInfracao: frontendData.infracao_cometida,
        dataOcorrencia: frontendData.data_infracao,
        horaOcorrencia: frontendData.hora_infracao,
        codigoMedida: frontendData.penalidade_aplicada?.split(' ')[0] || '',
        descricaoMedida: frontendData.penalidade_aplicada?.split(' ').slice(1).join(' ') || '',
        nomeLider: frontendData.nome_lider,
        evidencias,
        informacoesEvidencia
    };
}

// Rota para preview
app.get('/preview', async (req, res) => {
    try {
        // Lê o template
        const templatePath = path.join(__dirname, '../templates/tratativaFolha1.hbs');
        const templateContent = await fs.readFile(templatePath, 'utf8');
        
        // Generate new random data for each request
        const mockData = {
            ...FIXED_VALUES,
            ...generateMockData(),
            dataFormatada: formatDate(new Date())
        };
        
        // Compila e renderiza o template
        const template = handlebars.compile(templateContent);
        const html = template(mockData);
        
        // Add cache control headers to prevent caching
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.setHeader('Expires', '-1');
        res.setHeader('Pragma', 'no-cache');
        
        res.send(html);
    } catch (error) {
        console.error('Erro ao renderizar preview:', error);
        res.status(500).send('Erro ao gerar preview');
    }
});

// Rota para gerar PDF com dados reais
app.post('/generate', async (req, res) => {
    try {
        // Lê o template
        const templatePath = path.join(__dirname, '../templates/tratativaFolha1.hbs');
        const templateContent = await fs.readFile(templatePath, 'utf8');
        
        // Map the frontend data to template format
        const templateData = mapDataToTemplate(req.body);
        
        // Compila e renderiza o template
        const template = handlebars.compile(templateContent);
        const html = template(templateData);
        
        res.send(html);
    } catch (error) {
        console.error('Erro ao gerar documento:', error);
        res.status(500).send('Erro ao gerar documento');
    }
});

// Inicia o servidor
app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
    console.log(`Para ver o preview, acesse: http://localhost:${port}/preview`);
    console.log('Pressione Ctrl+C para parar o servidor');
}); 