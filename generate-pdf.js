const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');

async function generatePDF(data) {
  try {
    // Get workspace root path
    const workspaceRoot = __dirname;
    
    // Lê o template HTML
    const templatePath = path.join(workspaceRoot, 'templates', 'tratativaFolha1.hbs');
    const templateContent = fs.readFileSync(templatePath, 'utf8');

    // Compila e renderiza o template com os dados
    const template = handlebars.compile(templateContent);
    
    // Adjust paths for local files
    const adjustedData = {
      ...data,
      logoUrl: `file://${path.join(workspaceRoot, 'assets', 'images', path.basename(data.logoUrl))}`,
      evidencias: data.evidencias.map(ev => ({
        ...ev,
        url: ev.url.startsWith('http') 
          ? ev.url 
          : `file://${path.join(workspaceRoot, 'assets', 'images', path.basename(ev.url))}`
      }))
    };
    
    const html = template(adjustedData);

    // Inicia o navegador em modo headless
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox']
    });
    
    const page = await browser.newPage();

    // Define a viewport com as dimensões de uma página A4
    await page.setViewport({ width: 1240, height: 1754 });

    // Configura a mídia para 'print'
    await page.emulateMediaType('print');

    // Carrega o conteúdo do template HTML
    await page.setContent(html, { waitUntil: 'networkidle0' });

    // Aguarda que imagens sejam carregadas e verifica se carregaram corretamente
    await page.waitForSelector('img');
    await page.evaluate(() => {
      const images = document.querySelectorAll('img');
      return Promise.all(Array.from(images).map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve, reject) => {
          img.addEventListener('load', resolve);
          img.addEventListener('error', reject);
        });
      }));
    });

    // Gera o PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 }
    });

    await browser.close();
    return pdfBuffer;
  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    throw error;
  }
}

module.exports = generatePDF;
