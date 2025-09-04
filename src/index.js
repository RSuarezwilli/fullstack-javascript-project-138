// src/index.js

import { sanitizeOutputDir, urlToFilename, urlToDirname, getExtension } from './utils.js';
import path from 'path';
import fs from 'fs/promises';
import axios from 'axios';
import { load } from 'cheerio';
import Listr from 'listr';
import { URL } from 'url';

const log = console.log;

// ====== Procesa etiquetas y arma lista de recursos (usa rutas absolutas para guardar) ======
const processResource = ($, tagName, attrName, baseUrl, assetsDirName, resources, outputAssetsDir) => {
  $(tagName).each((_, element) => {
    const $element = $(element);
    const resourceUrl = $element.attr(attrName);

    if (!resourceUrl) return;

    try {
      const absoluteUrl = new URL(resourceUrl, baseUrl);

      // Solo recursos del mismo dominio
      if (absoluteUrl.hostname === new URL(baseUrl).hostname) {
        const resourceName = urlToFilename(absoluteUrl.href);

        // Ruta relativa que irá dentro del HTML (ej: site-com-blog-about_files/archivo.jpg)
        const relativeLocalPath = path.join(assetsDirName, resourceName);

        // Ruta absoluta donde se guardará el archivo en disco
        const fullLocalPath = path.join(outputAssetsDir, resourceName);

        // Reemplazar en el HTML por la ruta relativa
        $element.attr(attrName, relativeLocalPath);

        // Añadir meta para descarga: path es absoluta (fs.writeFile usará esta ruta)
        resources.push({
          url: absoluteUrl.href,
          path: fullLocalPath,
          filename: resourceName,
          localPath: relativeLocalPath,
        });
      }
    } catch (error) {
      log(`Error procesando recurso ${resourceUrl}:`, error.message);
    }
  });
};

// ====== Llama processResource para img, css y js ======
const processAllResources = ($, pageUrl, assetsDirName, outputAssetsDir) => {
  const resources = [];
  const baseUrl = pageUrl;

  processResource($, 'img', 'src', baseUrl, assetsDirName, resources, outputAssetsDir);
  processResource($, 'link[rel="stylesheet"]', 'href', baseUrl, assetsDirName, resources, outputAssetsDir);
  processResource($, 'script[src]', 'src', baseUrl, assetsDirName, resources, outputAssetsDir);

  return resources;
};

// ====== Descargar un recurso a disco (resource.path es absoluta) ======
const downloadResource = (resource) => {
  return axios
    .get(resource.url, { responseType: 'arraybuffer' })
    .then((response) => fs.writeFile(resource.path, response.data))
    .then(() => log(`Recurso descargado: ${resource.filename}`))
    .catch((error) => {
      log(`Error descargando ${resource.url}:`, error.message);
      throw error;
    });
};

// ====== Función principal ======
const downloadPage = async (pageUrl, outputDirName = '') => {
  try {
    // Normalizar nombre de salida y rutas
    outputDirName = sanitizeOutputDir(outputDirName);
    const url = new URL(pageUrl);
    const slug = url.hostname + url.pathname;
    const fileName = urlToFilename(slug);

    const fullOutputDirname = path.resolve(process.cwd(), outputDirName);
    const extension = getExtension(fileName) === '.html' ? '' : '.html';
    const fullOutputFileName = path.join(fullOutputDirname, fileName + extension);

    const assetsDirName = urlToDirname(slug); // ej: site-com-blog-about_files
    const fullOutputAssetsDirName = path.join(fullOutputDirname, assetsDirName); // ruta absoluta para escribir

    // Si existe la ruta pero NO es un directorio -> lanzar error (cubrir caso de tests negativos)
    const stat = await fs.stat(fullOutputDirname).catch(() => null);
    if (stat && !stat.isDirectory()) {
      throw new Error(`La ruta de salida ${fullOutputDirname} no es un directorio`);
    }

    // Descargar HTML principal
    const response = await axios.get(pageUrl);
    const $ = load(response.data);

    // Procesar recursos (pasamos la carpeta absoluta donde guardaremos)
    const resources = processAllResources($, pageUrl, assetsDirName, fullOutputAssetsDirName);

    // Crear directorios (ahora sí)
    await fs.mkdir(fullOutputDirname, { recursive: true });
    await fs.mkdir(fullOutputAssetsDirName, { recursive: true });

    // Preparar tareas y descargar recursos en paralelo
    const downloadTasks = resources.map((resource) => ({
      title: `Descargando ${resource.filename}`,
      task: () => downloadResource(resource),
    }));

    const tasks = new Listr(downloadTasks, { concurrent: true });
    await tasks.run();

    // Guardar HTML modificado (con rutas relativas a assets)
    await fs.writeFile(fullOutputFileName, $.html());

    return fullOutputDirname;
  } catch (error) {
    // Manejo de errores con mensajes claros para los tests
    if (error.response) {
      throw new Error(`Error HTTP ${error.response.status} al descargar ${pageUrl}`);
    } else if (error.request) {
      throw new Error(`No se pudo conectar con ${pageUrl}: ${error.message}`);
    } else {
      throw new Error(`Error al procesar ${pageUrl}: ${error.message}`);
    }
  }
};

export default downloadPage;

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
