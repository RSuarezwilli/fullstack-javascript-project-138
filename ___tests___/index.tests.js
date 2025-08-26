// src/index.js
import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';
import axios from 'axios';
import nock from 'nock';
import { processHtml } from '../src/index.js';

// 1. Leer HTML desde fixtures
const loadFixtureHtml = (fileName) => {
  const filePath = path.join(process.cwd(), '__fixtures__', fileName);
  return fs.readFileSync(filePath, 'utf-8');
};

// 2. Crear carpeta *_files
const createFilesFolder = (htmlFileName) => {
  const baseName = htmlFileName.replace('.html', '');
  const folderPath = path.join(process.cwd(), `${baseName}_files`);
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath);
  }
  return folderPath;
};

// 3. Descargar imagen binaria
const downloadImage = async (url, destPath) => {
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  fs.writeFileSync(destPath, response.data);
};

// 4. Procesar HTML: descargar imágenes y reemplazar rutas
export const processHtml = async (htmlFileName) => {
  const html = loadFixtureHtml(htmlFileName);
  const $ = cheerio.load(html);
  const folderPath = createFilesFolder(htmlFileName);

  // Recorre cada imagen
  await Promise.all(
    $('img').map(async (_, img) => {
      const originalSrc = $(img).attr('src');

      // Convertir la URL a un nombre de archivo seguro
      const fileNameSafe = originalSrc
        .replace(/^\//, '')     // quitar slash inicial
        .replace(/\//g, '-');   // reemplazar slashes por guiones

      const localFileName = `${path.basename(htmlFileName, '.html')}-${fileNameSafe}`;
      const localPath = path.join(folderPath, localFileName);

      // Descargar imagen (aquí podrías mockear axios en tests)
      await downloadImage(`https://codica.la${originalSrc}`, localPath);

      // Cambiar el src en el HTML
      $(img).attr('src', `${path.basename(folderPath)}/${localFileName}`);
    }).get()
  );

  // Guardar el HTML modificado
  const outputHtmlPath = path.join(process.cwd(), htmlFileName);
  fs.writeFileSync(outputHtmlPath, $.html());
};

test('descarga imágenes y reemplaza rutas', async () => {
  const scope = nock('https://codica.la')
    .get('/assets/nodejs.png')
    .reply(200, 'fake-binary-data');

  await processHtml('pagina.html');

  expect(scope.isDone()).toBe(true); // confirma que se llamó al mock
});
const fixturesPath = path.join(process.cwd(), 'fixtures');

describe('downloadPage con nock', () => {
  const testUrl = 'https://example.com/page';
  const outputDir = 'test-output';

  beforeAll(async () => {
    await fs.mkdir(outputDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(outputDir, { recursive: true, force: true });
  });

  test('descarga HTML y lo reescribe con rutas locales', async () => {
    nock('https://example.com')
      .get('/page')
      .reply(200, `<html><body><img src="/assets/logo.png"></body></html>`);

    nock('https://example.com')
      .get('/assets/logo.png')
      .replyWithFile(200, path.join(fixturesPath, 'nodejs.png'));

    await downloadPage(testUrl, outputDir);

    const htmlFile = await fs.readFile(
      path.join(outputDir, 'example-com-page.html'),
      'utf-8'
    );

    expect(htmlFile).toContain('example-com-page_files/example-com-page-assets-logo.png');
  });
});

