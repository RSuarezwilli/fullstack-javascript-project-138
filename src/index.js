import { sanitizeOutputDir, urlToFilename, urlToDirname, getExtension } 
from './utils.js';
import path from 'path';
import fs from 'fs/promises';
import axios from 'axios';
import {load} from 'cheerio';
import Listr  from 'listr';
import { URL } from 'url';

// Agregar sistema de logging
const log = console.log;

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
    const $ = load(response.data);

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

// 2. Descargar página principal
//  return axios
//  .get(pageUrl)
//  .then((response) => {
//   log('Página principal descargada correctamente');
  
//    const html = response.data;
//    const $ = cheerio.load(html);

//  // 3. Buscar recursos (img, link[rel=stylesheet], script[src])
//  const resources = [];
//  $("img, link[rel='stylesheet'], script[src]").each((_, el) => {
//    const tag = $(el);
//    const attr = tag.is("img") ? "src" : "href" in el.attribs ? "href" : "src";
//    const resourceUrl = tag.attr(attr);

//    if (resourceUrl && !resourceUrl.startsWith("http")) {
//      const resourceFullUrl = new URL(resourceUrl, pageUrl).href;
//      const resourceName = urlToFilename(resourceUrl);
//      const resourcePath = path.join(fullOutputAssetsDirName, resourceName);
//  // Reemplazar en HTML
//         tag.attr(attr, path.join(assetsDirName, resourceName));
//         resources.push({ url: resourceFullUrl, path: resourcePath });
        
//       }
//     });
//     log(`Se encontraron ${resources.length} recursos para descargar`);
//       // 4. Crear directorios

//       return fs
//       .mkdir(fullOutputAssetsDirName, { recursive: true })
//       .then(() => {
//         // 5. Descargar recursos

//         const downloads = resources.map((res) =>
//           axios
//             .get(res.url, { responseType: "arraybuffer" })
//             .then((r) => fs.writeFile(res.path, r.data))
//         );
//         return Promise.all(downloads);
//       })
//       .then(() => {
//         // 6. Guardar HTML modificado
//         log('Recursos descargados y guardados correctamente');
//         const modifiedHtml = $.html();
//         return fs.writeFile(fullOutputFileName, modifiedHtml);
//       })
//       // .catch((err) => {
//       //   log('Error descargando la página:', err.message);
//       //   console.error("Error descargando la página:", err.message);
//       // });
//       .catch((err) => {
//         if (err.response) {
//           // Error HTTP
//           throw new Error(`Fallo al descargar recurso ${pageUrl}: código ${err.response.status}`);
//         } else if (err.request) {
//           // Problema de red
//           throw new Error(`No se pudo conectar con ${pageUrl}: ${err.message}`);
//         } else {
//           // Otro error (archivos, permisos, etc.)
//           throw new Error(`Error al procesar ${pageUrl}: ${err.message}`);
//         }
//       });
//     });
  // });
// ... lógica para descargar la página y los recursos asociados utiliza then y catch
// utilizar axion con la patch url para descargar la página
// utilizar cheerio para parsear el HTML y encontrar los recursos
// guardar la página y los recursos en las rutas calculadas.
 //};
