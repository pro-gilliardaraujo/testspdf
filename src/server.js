const express = require('express');
const handlebars = require('handlebars');
const fs = require('fs').promises;
const path = require('path');
const { generateMockData } = require('./mockData');
const puppeteer = require('puppeteer');
const { PDFDocument } = require('pdf-lib');

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

// Helper function to format simple date
function formatSimpleDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', { 
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

// Helper function to format infraction text
function formatInfractionText(infracao, valor_praticado, valor_limite, metrica, data_infracao, hora_infracao) {
    const dataFormatada = formatSimpleDate(data_infracao);
    return `${infracao} de ${valor_praticado}${metrica}, sendo o limite estabelecido de ${valor_limite}${metrica}. Na data de ${dataFormatada} às ${hora_infracao}.`;
}

// Function to map frontend data to template data
function mapDataToTemplate(frontendData) {
    // Get evidence information
    const evidencias = [];
    const informacoesEvidencia = [];
    
    if (frontendData.evidence1_url) evidencias.push({ url: frontendData.evidence1_url });
    if (frontendData.evidence2_url) evidencias.push({ url: frontendData.evidence2_url });
    if (frontendData.evidence3_url) evidencias.push({ url: frontendData.evidence3_url });
    
    // Format infraction text if all required values are present
    let descricaoInfracao = frontendData.infracao_cometida;
    if (frontendData.valor_praticado && frontendData.valor_limite && frontendData.metrica) {
        descricaoInfracao = formatInfractionText(
            frontendData.infracao_cometida,
            frontendData.valor_praticado,
            frontendData.valor_limite,
            frontendData.metrica,
            frontendData.data_infracao,
            frontendData.hora_infracao
        );
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
        descricaoInfracao,
        dataOcorrencia: frontendData.data_infracao,
        horaOcorrencia: frontendData.hora_infracao,
        tipoMedida: frontendData.tipo_medida,
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
        @media print {
            body {
                margin: 0;
                padding: 0;
            }
            * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
        }
    </style>
</head>
<body>
    ${html1}
    ${html2}
</body>
</html>`;
}

// Helper function to generate PDF from HTML
async function generatePDFFromHTML(html) {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
    // Set content and wait for network idle to ensure all resources are loaded
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    // Generate PDF with A4 size
    const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 }
    });
    
    await browser.close();
    return pdf;
}

// Helper function to merge PDFs
async function mergePDFs(pdf1Buffer, pdf2Buffer) {
    const mergedPdf = await PDFDocument.create();
    
    // Load both PDFs
    const pdf1 = await PDFDocument.load(pdf1Buffer);
    const pdf2 = await PDFDocument.load(pdf2Buffer);
    
    // Copy pages from both PDFs
    const [pdf1Page] = await mergedPdf.copyPages(pdf1, [0]);
    const [pdf2Page] = await mergedPdf.copyPages(pdf2, [0]);
    
    // Add pages to the new document
    mergedPdf.addPage(pdf1Page);
    mergedPdf.addPage(pdf2Page);
    
    // Save the merged PDF
    return await mergedPdf.save();
}

// Rota para preview da primeira página
app.get('/preview1', async (req, res) => {
    try {
        // Read template
        const template1Path = path.join(__dirname, '../templates/tratativaFolha1.hbs');
        const template1Content = await fs.readFile(template1Path, 'utf8');
        
        // Generate mock data with complete infraction information
        const mockData = {
            ...FIXED_VALUES,
            ...generateMockData(),
            dataFormatada: formatDate(new Date()),
            cpf: '123.456.789-10',
            infracao_cometida: 'Excesso de Velocidade',
            valor_praticado: '19',
            valor_limite: '15',
            metrica: 'km/h',
            data_infracao: '2025-02-28',
            hora_infracao: '12:50'
        };
        
        // Compile and render template
        const template1 = handlebars.compile(template1Content);
        const html1 = template1(mockData);
        
        res.send(html1);
    } catch (error) {
        console.error('Erro ao renderizar preview:', error);
        res.status(500).send('Erro ao gerar preview');
    }
});

// Rota para preview da segunda página
app.get('/preview2', async (req, res) => {
    try {
        // Read template
        const template2Path = path.join(__dirname, '../templates/tratativaFolha2.hbs');
        const template2Content = await fs.readFile(template2Path, 'utf8');
        
        // Generate mock data with complete infraction information
        const mockData = {
            ...FIXED_VALUES,
            ...generateMockData(),
            dataFormatada: formatDate(new Date()),
            cpf: '123.456.789-10',
            infracao_cometida: 'Excesso de Velocidade',
            valor_praticado: '19',
            valor_limite: '15',
            metrica: 'km/h',
            data_infracao: '2025-02-28',
            hora_infracao: '12:50'
        };
        
        // Compile and render template
        const template2 = handlebars.compile(template2Content);
        const html2 = template2(mockData);
        
        res.send(html2);
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
        
        // Generate individual PDFs
        const pdf1 = await generatePDFFromHTML(html1);
        const pdf2 = await generatePDFFromHTML(html2);
        
        // Merge PDFs
        const mergedPdf = await mergePDFs(pdf1, pdf2);
        
        // Send the merged PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=documento_disciplinar.pdf');
        res.send(Buffer.from(mergedPdf));
    } catch (error) {
        console.error('Erro ao gerar documento:', error);
        res.status(500).send('Erro ao gerar documento');
    }
});

// Update server startup message
app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
    console.log(`Para ver os previews, acesse:`);
    console.log(`- Página 1: http://localhost:${port}/preview1`);
    console.log(`- Página 2: http://localhost:${port}/preview2`);
    console.log('Pressione Ctrl+C para parar o servidor');
}); 