import { sanitizeOutputDir, urlToFilename, urlToDirname, getExtension, downloadResources } from "./utils.js";
import path from 'path';
import fs from 'fs/promises';
import axios from 'axios';
import cheerio from 'cheerio';


const downloadPage = async (pageUrl, outputDirName = '') => {
  log('Iniciando descarga de la página:', pageUrl);
  // await downloadResources($, pageUrl, fullOutputDirname, assetsDirName);
   // 1. Normalizar nombre de salida 
outputDirName = sanitizeOutputDir(outputDirName);
const url = new URL(pageUrl);
const  slug = url.hostname + url.pathname;
const fileName = urlToFilename (slug);
const fullOutputDirname = path.resolve(process.cwd(), outputDirName);
const extencion = getExtension(fileName);
const fullOutputFileName = path.join(fullOutputDirname, fileName + extencion);
const assetsDirName = urlToDirname(slug);
const fullOutputAssetsDirName = path.join(fullOutputDirname, assetsDirName);

 // 2. Descargar página principal
 return axios
 .get(pageUrl)
 .then((response) => {
  log('Página principal descargada correctamente');

   const html = response.data;
   const $ = cheerio.load(html);

 // 3. Buscar recursos (img, link[rel=stylesheet], script[src])
 const resources = [];
 $("img, link[rel='stylesheet'], script[src]").each((_, el) => {
   const tag = $(el);
   const attr = tag.is("img") ? "src" : "href" in el.attribs ? "href" : "src";
   const resourceUrl = tag.attr(attr);

   if (resourceUrl && !resourceUrl.startsWith("http")) {
     const resourceFullUrl = new URL(resourceUrl, pageUrl).href;
     const resourceName = urlToFilename(resourceUrl);
     const resourcePath = path.join(fullOutputAssetsDirName, resourceName);
 // Reemplazar en HTML
        tag.attr(attr, path.join(assetsDirName, resourceName));
        resources.push({ url: resourceFullUrl, path: resourcePath });
    }
    });
    log(`Se encontraron ${resources.length} recursos para descargar`);
      // 4. Crear directorios

      return fs
      .mkdir(fullOutputAssetsDirName, { recursive: true })
      .then(() => {
        // 5. Descargar recursos

        const downloads = resources.map((res) =>
          axios
            .get(res.url, { responseType: "arraybuffer" })
            .then((r) => fs.writeFile(res.path, r.data))
        );
        return Promise.all(downloads);
      })
      .then(() => {
        // 6. Guardar HTML modificado
        log('Recursos descargados y guardados correctamente');
        const modifiedHtml = $.html();
        return fs.writeFile(fullOutputFileName, modifiedHtml);
      })
      .catch((err) => {
        log('Error descargando la página:', err.message);
        console.error("Error descargando la página:", err.message);
      });
  });
  
// ... lógica para descargar la página y los recursos asociados utiliza then y catch
// utilizar axion con la patch url para descargar la página
// utilizar cheerio para parsear el HTML y encontrar los recursos
// guardar la página y los recursos en las rutas calculadas

};
