// src/index.js
import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';
import axios from 'axios';

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

// Ejemplo de ejecución directa (solo para pruebas locales)
// (async () => {
//   await processHtml('pagina.html');
//   console.log('Página procesada.');
// })();

  