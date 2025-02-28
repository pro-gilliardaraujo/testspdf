const express = require('express');
const handlebars = require('handlebars');
const fs = require('fs').promises;
const path = require('path');
const { generateMockData } = require('./mockData');
const puppeteer = require('puppeteer');
const { PDFDocument } = require('pdf-lib');
const winston = require('winston');

// Initialize Winston Logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' })
    ]
});

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        )
    }));
}

const app = express();
const port = 3000;

// Get the absolute path to the workspace root
const workspaceRoot = path.join(__dirname, '..');

// Serve static files from assets directory
app.use('/assets', express.static(path.join(workspaceRoot, 'assets')));

// Middleware to parse JSON bodies
app.use(express.json());

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
    titulo: 'ACR-003_Medida Disciplinar',
    anexo: 'Anexo',
    tipoDocumento: 'Controlado',
    codigoDocumento: 'PRO_003',
    logoUrl: path.join('/assets/images', 'logo.png'),
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
        numero_documento: frontendData.numero_documento,
        nome_funcionario: frontendData.nome_funcionario,
        cpf: frontendData.cpf,
        dataFormatada: formatDate(new Date()),
        funcao: frontendData.funcao,
        setor: frontendData.setor,
        codigo_infracao: frontendData.codigo_infracao,
        infracao_cometida: descricaoInfracao,
        data_infracao: frontendData.data_infracao,
        hora_infracao: frontendData.hora_infracao,
        tipo_medida: frontendData.tipo_medida,
        penalidade_aplicada: frontendData.penalidade_aplicada,
        nome_lider: frontendData.nome_lider,
        evidencias: frontendData.evidencias,
        informacoesEvidencia: frontendData.informacoesEvidencia,
        // Inclua as métricas separadamente para uso no template
        valor_praticado: frontendData.valor_praticado,
        valor_limite: frontendData.valor_limite,
        metrica: frontendData.metrica
    };
}


// Helper function to create combined HTML (para mesclar as duas folhas, se necessário)
function createCombinedHTML(html1, html2, isPreview = false) {
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=210mm, initial-scale=1.0">
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

// Helper function to wait for images with timeout
async function waitForImagesWithTimeout(page, timeout = 5000) {
    logger.info('Starting image load wait process', { timeout });
    try {
        await page.evaluate(async (timeout) => {
            const images = Array.from(document.getElementsByTagName('img'));
            await Promise.race([
                Promise.all(images.map(img => {
                    if (img.complete) return Promise.resolve();
                    return new Promise((resolve, reject) => {
                        img.addEventListener('load', resolve);
                        img.addEventListener('error', () => reject(new Error(`Failed to load image: ${img.src}`)));
                    });
                })),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Image loading timeout')), timeout))
            ]);
        }, timeout);
        logger.info('All images loaded successfully');
        return true;
    } catch (error) {
        logger.error('Error loading images', { error: error.message });
        return false;
    }
}

// Enhanced PDF generation function
async function generatePDFFromHTML(html, templateName) {
    logger.info('Starting PDF generation', { templateName });
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
    try {
        // Set viewport and emulate print media (dimensões aproximadas para A4 em pixels)
        await page.setViewport({ width: 794, height: 1123 });
        await page.emulateMediaType('print');
        
        // Set content and wait until the network is idle
        logger.info('Setting page content');
        await page.setContent(html, { 
            waitUntil: ['networkidle0', 'load', 'domcontentloaded'],
            timeout: 30000
        });
        
        // Wait for images to load
        const imagesLoaded = await waitForImagesWithTimeout(page);
        if (!imagesLoaded) {
            logger.warn('Some images may not have loaded properly');
        }

        // Small delay to ensure complete rendering
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Generate PDF
        logger.info('Generating PDF document');
        const pdf = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: 0, right: 0, bottom: 0, left: 0 }
        });
        
        logger.info('PDF generated successfully');
        return pdf;
    } catch (error) {
        logger.error('Error generating PDF', { 
            error: error.message,
            templateName,
            stack: error.stack
        });
        throw error;
    } finally {
        await browser.close();
    }
}

// Helper function to merge PDFs
async function mergePDFs(pdf1Buffer, pdf2Buffer) {
    const mergedPdf = await PDFDocument.create();
    
    // Load both PDFs
    const pdf1 = await PDFDocument.load(pdf1Buffer);
    const pdf2 = await PDFDocument.load(pdf2Buffer);
    
    // Copy pages from both PDFs (assumindo que cada template gera 1 página)
    const [page1] = await mergedPdf.copyPages(pdf1, [0]);
    const [page2] = await mergedPdf.copyPages(pdf2, [0]);
    
    mergedPdf.addPage(page1);
    mergedPdf.addPage(page2);
    
    return await mergedPdf.save();
}

// Rota para preview da primeira página
app.get('/preview1', async (req, res) => {
    try {
        logger.info('Starting preview1 route');
        
        const template1Path = path.join(__dirname, '../templates/tratativaFolha1.hbs');
        const template1Content = await fs.readFile(template1Path, 'utf8');
        logger.info('Template 1 loaded successfully');
        
        // Cria dados mock para preview
        const mockData = {
            ...FIXED_VALUES,
            numero_documento: 'DOC-2024-001',
            nome_funcionario: 'João da Silva',
            cpf: '123.456.789-10',
            dataFormatada: formatDate(new Date()),
            funcao: 'Motorista',
            setor: 'Logística',
            codigo_infracao: 'INF-001',
            infracao_cometida: 'Excesso de Velocidade',
            valor_praticado: '19',
            valor_limite: '15',
            metrica: 'km/h',
            data_infracao: '27/02/2025',
            hora_infracao: '12:50',
            tipo_medida: 'P1',
            penalidade_aplicada: 'ADV-001 Advertência por escrito',
            nome_lider: 'Maria Supervisora',
            evidencias: [
                { url: '/assets/images/evidenceexample.png' }
            ],
            informacoesEvidencia: [
                'Valor registrado: 19km/h',
                'Limite permitido: 15km/h'
            ]
        };
        
        logger.info('Mock data prepared', { 
            documentNumber: mockData.numero_documento,
            hasEvidence: mockData.evidencias.length > 0 
        });
        
        const template1 = handlebars.compile(template1Content);
        const html1 = template1(mockData);
        logger.info('Template 1 rendered successfully');
        
        res.send(html1);
    } catch (error) {
        logger.error('Error in preview1 route', { 
            error: error.message,
            stack: error.stack 
        });
        res.status(500).send('Erro ao gerar preview');
    }
});

// Rota para preview da segunda página
app.get('/preview2', async (req, res) => {
    try {
        logger.info('Starting preview2 route');
        
        const template2Path = path.join(__dirname, '../templates/tratativaFolha2.hbs');
        const template2Content = await fs.readFile(template2Path, 'utf8');
        logger.info('Template 2 loaded successfully');
        
        const mockData = {
            ...FIXED_VALUES,
            numero_documento: 'DOC-2024-001',
            nome_funcionario: 'João da Silva',
            cpf: '123.456.789-10',
            dataFormatada: formatDate(new Date()),
            funcao: 'Motorista',
            setor: 'Logística',
            codigo_infracao: 'INF-001',
            infracao_cometida: 'Excesso de Velocidade',
            valor_praticado: '19',
            valor_limite: '15',
            metrica: 'km/h',
            data_infracao: '27/02/2025',
            hora_infracao: '12:50',
            tipo_medida: 'P1',
            penalidade_aplicada: 'ADV-001 Advertência por escrito',
            nome_lider: 'Maria Supervisora',
            evidencias: [
                { url: '/assets/images/evidenceexample.png' }
            ],
            informacoesEvidencia: [
                'Valor registrado: 19km/h',
                'Limite permitido: 15km/h'
            ]
        };
        
        logger.info('Mock data prepared for template 2', { 
            documentNumber: mockData.numero_documento,
            hasEvidence: mockData.evidencias.length > 0 
        });
        
        logger.info('Template 2 data check', {
            hasRequiredFields: {
                nome_funcionario: !!mockData.nome_funcionario,
                cpf: !!mockData.cpf,
                tipo_medida: !!mockData.tipo_medida,
                infracao_cometida: !!mockData.infracao_cometida
            }
        });
        
        const template2 = handlebars.compile(template2Content);
        const html2 = template2(mockData);
        logger.info('Template 2 rendered successfully');
        
        res.send(html2);
    } catch (error) {
        logger.error('Error in preview2 route', { 
            error: error.message,
            stack: error.stack 
        });
        res.status(500).send('Erro ao gerar preview');
    }
});

// Rota para gerar PDF com dados reais
app.post('/generate', async (req, res) => {
    try {
        const template1Path = path.join(__dirname, '../templates/tratativaFolha1.hbs');
        const template2Path = path.join(__dirname, '../templates/tratativaFolha2.hbs');
        const template1Content = await fs.readFile(template1Path, 'utf8');
        const template2Content = await fs.readFile(template2Path, 'utf8');
        
        const templateData = mapDataToTemplate(req.body);
        
        const template1 = handlebars.compile(template1Content);
        const template2 = handlebars.compile(template2Content);
        const html1 = template1(templateData);
        const html2 = template2(templateData);
        
        const pdf1 = await generatePDFFromHTML(html1, 'tratativaFolha1.hbs');
        const pdf2 = await generatePDFFromHTML(html2, 'tratativaFolha2.hbs');
        
        const mergedPdf = await mergePDFs(pdf1, pdf2);
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=documento_disciplinar.pdf');
        res.send(Buffer.from(mergedPdf));
    } catch (error) {
        console.error('Erro ao gerar documento:', error);
        res.status(500).send('Erro ao gerar documento');
    }
});

// Rota para testar geração de PDF com dados mock
app.get('/generate-test', async (req, res) => {
    try {
        const template1Path = path.join(__dirname, '../templates/tratativaFolha1.hbs');
        const template2Path = path.join(__dirname, '../templates/tratativaFolha2.hbs');
        const template1Content = await fs.readFile(template1Path, 'utf8');
        const template2Content = await fs.readFile(template2Path, 'utf8');
        
        const mockData = { ...FIXED_VALUES, ...generateMockData() };

        
        const template1 = handlebars.compile(template1Content);
        const template2 = handlebars.compile(template2Content);
        const html1 = template1(mockData);
        const html2 = template2(mockData);
        
        const pdf1 = await generatePDFFromHTML(html1, 'tratativaFolha1.hbs');
        const pdf2 = await generatePDFFromHTML(html2, 'tratativaFolha2.hbs');
        
        const mergedPdf = await mergePDFs(pdf1, pdf2);
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=documento_disciplinar_teste.pdf');
        res.send(Buffer.from(mergedPdf));
    } catch (error) {
        console.error('Erro ao gerar documento de teste:', error);
        res.status(500).send('Erro ao gerar documento de teste');
    }
});

app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
    console.log(`Para ver os previews, acesse:`);
    console.log(`- Página 1: http://localhost:${port}/preview1`);
    console.log(`- Página 2: http://localhost:${port}/preview2`);
    console.log(`- PDF de teste: http://localhost:${port}/generate-test`);
    console.log('Pressione Ctrl+C para parar o servidor');
});
