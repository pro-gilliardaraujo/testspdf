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

// Register Handlebars helpers
handlebars.registerHelper('eq', function(a, b) {
    return a === b;
});

handlebars.registerHelper('formatCPF', function(cpf) {
    if (!cpf) return '';
    
    // Remove any non-digit characters
    const cleanCPF = cpf.replace(/\D/g, '');
    
    // Check if it's already in the correct format
    if (/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(cpf)) {
        return cpf;
    }
    
    // Format the CPF
    if (cleanCPF.length === 11) {
        return cleanCPF.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    
    return cpf; // Return original if invalid
});

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
        cpf: frontendData.cpf,
        dataFormatada: formatDate(new Date()),
        funcao: frontendData.funcao,
        setor: frontendData.setor,
        codigoInfracao: frontendData.codigo_infracao,
        descricaoInfracao: frontendData.infracao_cometida,
        dataOcorrencia: frontendData.data_infracao,
        horaOcorrencia: frontendData.hora_infracao,
        tipoMedida: frontendData.tipo_medida, // 'Advertido' or 'Suspenso'
        codigoMedida: frontendData.penalidade_aplicada?.split(' ')[0] || '',
        descricaoMedida: frontendData.penalidade_aplicada?.split(' ').slice(1).join(' ') || '',
        nomeLider: frontendData.nome_lider,
        evidencias,
        informacoesEvidencia
    };
}

// Helper function to create combined HTML
function createCombinedHTML(html1, html2, isPreview = false) {
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Documento Disciplinar</title>
    <style>
        @page {
            size: A4;
            margin: 0;
        }
        body {
            margin: 0;
            padding: 0;
            font-family: 'Century Gothic', 'Arial', 'Helvetica', sans-serif;
            font-size: 10px;
            background: ${isPreview ? '#f0f0f0' : 'white'};
        }
        .pages {
            display: flex;
            flex-direction: column;
            align-items: center;
            ${isPreview ? 'gap: 20px; padding: 20px;' : ''}
        }
        .page {
            width: 210mm;
            height: 297mm;
            margin: 0 auto;
            background: white;
            position: relative;
            ${isPreview ? 'box-shadow: 0 0 10px rgba(0,0,0,0.1);' : ''}
        }
        .content-container {
            position: absolute;
            top: 12.7mm;
            right: 12.7mm;
            bottom: 12.7mm;
            left: 12.7mm;
            border: 1px solid black;
        }
        @media print {
            body {
                background: white;
            }
            .pages {
                gap: 0;
                padding: 0;
            }
            .page {
                box-shadow: none;
            }
            .page:first-child {
                page-break-after: always;
            }
        }
    </style>
</head>
<body>
    <div class="pages">
        <div class="page">
            <div class="content-container">
                ${html1}
            </div>
        </div>
        <div class="page">
            <div class="content-container">
                ${html2}
            </div>
        </div>
    </div>
</body>
</html>`;
}

// Rota para preview
app.get('/preview', async (req, res) => {
    try {
        // Read template
        const template1Path = path.join(__dirname, '../templates/tratativaFolha1.hbs');
        const template1Content = await fs.readFile(template1Path, 'utf8');
        
        // Generate mock data
        const mockData = {
            ...FIXED_VALUES,
            ...generateMockData(),
            dataFormatada: formatDate(new Date())
        };
        
        // Compile and render the actual template
        const template1 = handlebars.compile(template1Content);
        const html1 = template1(mockData);
        
        // Create minimal preview wrapper
        const previewHTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Preview - Medida Disciplinar</title>
    <style>
        body {
            background: #f0f0f0;
            margin: 0;
            padding: 20px;
            min-height: 100vh;
            display: flex;
            justify-content: center;
            box-sizing: border-box;
        }
        .preview-container {
            background: white;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
            width: 210mm;
            height: 297mm;
            margin: 0 auto;
            position: relative;
        }
    </style>
</head>
<body>
    <div class="preview-container">
        ${html1}
    </div>
</body>
</html>`;
        
        // Add cache control headers to prevent caching
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.setHeader('Expires', '-1');
        res.setHeader('Pragma', 'no-cache');
        
        res.send(previewHTML);
    } catch (error) {
        console.error('Erro ao renderizar preview:', error);
        res.status(500).send('Erro ao gerar preview');
    }
});

// Rota para gerar PDF com dados reais
app.post('/generate', async (req, res) => {
    try {
        // Read both templates
        const template1Path = path.join(__dirname, '../templates/tratativaFolha1.hbs');
        const template2Path = path.join(__dirname, '../templates/tratativaFolha2.hbs');
        const template1Content = await fs.readFile(template1Path, 'utf8');
        const template2Content = await fs.readFile(template2Path, 'utf8');
        
        // Map the frontend data to template format
        const templateData = mapDataToTemplate(req.body);
        
        // Compile and render both templates
        const template1 = handlebars.compile(template1Content);
        const template2 = handlebars.compile(template2Content);
        const html1 = template1(templateData);
        const html2 = template2(templateData);
        
        // Create combined HTML for PDF generation
        const combinedHTML = createCombinedHTML(html1, html2, false);
        
        res.send(combinedHTML);
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