const Handlebars = require('handlebars');
const helpers = require('handlebars-helpers')();

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');

async function generatePDF(data) {
  try {
    // Caminho raiz do projeto
    const projectRoot = __dirname;

    // Função para carregar e compilar templates Handlebars
    const loadTemplate = (templateName) => {
      const templatePath = path.join(projectRoot, 'templates', `${templateName}.hbs`);
      const templateContent = fs.readFileSync(templatePath, 'utf8');
      return handlebars.compile(templateContent);
    };

    // Carrega e compila os templates
    const template1 = loadTemplate('tratativaFolha1');
    const template2 = loadTemplate('tratativaFolha2');

    // Ajusta os caminhos das imagens para serem utilizados no HTML
    const adjustedData = {
      ...data,
      logoUrl: `file://${path.join(projectRoot, 'assets', 'images', path.basename(data.logoUrl))}`,
      evidencias: data.evidencias.map(ev => ({
        ...ev,
        url: ev.url.startsWith('http')
          ? ev.url
          : `file://${path.join(projectRoot, 'assets', 'images', path.basename(ev.url))}`
      }))
    };

    // Renderiza o HTML de cada template com os dados
    const html1 = template1(adjustedData);
    const html2 = template2(adjustedData);

    // Inicia o Puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox']
    });
    const page = await browser.newPage();

    // Define o conteúdo da primeira página
    await page.setContent(html1, { waitUntil: 'networkidle0' });

    // Aguarda o carregamento das imagens na primeira página
    await page.evaluate(() => {
      const images = Array.from(document.images);
      return Promise.all(images.map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve, reject) => {
          img.addEventListener('load', resolve);
          img.addEventListener('error', reject);
        });
      }));
    });

    // Gera o PDF da primeira página em um buffer
    const pdfBuffer1 = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 }
    });

    // Define o conteúdo da segunda página
    await page.setContent(html2, { waitUntil: 'networkidle0' });

    // Aguarda o carregamento das imagens na segunda página
    await page.evaluate(() => {
      const images = Array.from(document.images);
      return Promise.all(images.map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve, reject) => {
          img.addEventListener('load', resolve);
          img.addEventListener('error', reject);
        });
      }));
    });

    // Gera o PDF da segunda página em um buffer
    const pdfBuffer2 = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 }
    });

    await browser.close();

    // Combina os dois buffers de PDF em um único arquivo
    const combinedPdfBuffer = Buffer.concat([pdfBuffer1, pdfBuffer2]);

    // Salva o PDF combinado em um arquivo
    const outputPath = path.join(projectRoot, 'teste_geracao_pdf.pdf');
    fs.writeFileSync(outputPath, combinedPdfBuffer);

    console.log(`PDF gerado com sucesso: ${outputPath}`);
  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
  }
}

// Dados de exemplo
const data = {
  logoUrl: 'logo.png',
  evidencias: [
    { url: 'evidenceexample.png', descricao: 'Imagem de Exemplo' }
  ],
  // Outros dados necessários para os templates
};

// Gera o PDF com os dados fornecidos
generatePDF(data);
