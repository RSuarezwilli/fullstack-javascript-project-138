import { sanitizeOutputDir, urlToFilename, urlToDirname, getExtension, log } 
from './utils.js';
import path from 'path';
import fs from 'fs/promises';
import axios from 'axios';
import cheerio from 'cheerio';
import Listr  from 'listr';
import { URL } from 'url';



const processResource = ($, tagName, attrName, baseUrl, assetsDirName, resources) => {
  $(tagName).each((_, element) => {
    const $element = $(element);
    const resourceUrl = $element.attr(attrName);
    
    if (resourceUrl) {
      try {
        const absoluteUrl = new URL(resourceUrl, baseUrl).href;
        const resourceName = urlToFilename(absoluteUrl);
        const localPath = path.join(assetsDirName, resourceName);
        
        // Reemplazar en HTML
        $element.attr(attrName, localPath);
        resources.push({ 
          url: absoluteUrl, 
          path: path.join(assetsDirName, resourceName),
          filename: resourceName
        });
      } catch (error) {
        log(`Error procesando recurso ${resourceUrl}:`, error.message);
      }
    }
  });
};
const processAllResources = ($, pageUrl, assetsDirName) => {
  const resources = [];
  const baseUrl = pageUrl;
  
  // Procesar diferentes tipos de recursos
  processResource($, 'img', 'src', baseUrl, assetsDirName, resources);
  processResource($, 'link[rel="stylesheet"]', 'href', baseUrl, assetsDirName, resources);
  processResource($, 'script[src]', 'src', baseUrl, assetsDirName, resources);
  
  return resources;
};
const downloadResource = (resource) => {
  return axios
    .get(resource.url, { responseType: 'arraybuffer' })
    .then(response => fs.writeFile(resource.path, response.data))
    .then(() => log(`Recurso descargado: ${resource.filename}`))
    .catch(error => {
      log(`Error descargando ${resource.url}:`, error.message);
      throw error;
    });
};

const downloadPage = async (pageUrl, outputDirName = '') => {
  try {
    // 1. Normalización de rutas
    outputDirName = sanitizeOutputDir(outputDirName);
    const url = new URL(pageUrl);
    const slug = url.hostname + url.pathname;
    const fileName = urlToFilename(slug);
    const fullOutputDirname = path.resolve(process.cwd(), outputDirName);
    const extension = getExtension(fileName) === '.html' ? '' : '.html';
    const fullOutputFileName = path.join(fullOutputDirname, fileName + extension);
    const assetsDirName = urlToDirname(slug);
    const fullOutputAssetsDirName = path.join(fullOutputDirname, assetsDirName);

    // 2. Descargar HTML principal
    const response = await axios.get(pageUrl);
    const $ = cheerio.load(response.data);

    // 3. Procesar recursos del HTML
    const resources = processAllResources($, pageUrl, assetsDirName);

    // 4. Crear directorios
    await fs.mkdir(fullOutputDirname, { recursive: true });
    await fs.mkdir(fullOutputAssetsDirName, { recursive: true });

    // 5. Descargar recursos en paralelo
    const downloadTasks = resources.map(resource => ({
      title: `Descargando ${resource.filename}`,
      task: () => downloadResource(resource)
    }));

    const tasks = new Listr(downloadTasks, { concurrent: true });
    await tasks.run();

    // 6. Guardar HTML modificado
    await fs.writeFile(fullOutputFileName, $.html());
    
    return fullOutputDirname;

  } catch (error) {
    // Manejo específico de errores
    if (error.response) {
      throw new Error(`Error HTTP ${error.response.status} al descargar ${pageUrl}`);
    } else if (error.request) {
      throw new Error(`No se pudo conectar con ${pageUrl}: ${error.message}`);
    } else {
      throw new Error(`Error al procesar ${pageUrl}: ${error.message}`);
    }
  }
};
const log = console.log;
