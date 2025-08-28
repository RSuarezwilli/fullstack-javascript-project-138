import { sanitizeOutputDir, urlToFilename, urlToDirname, getExtension, downloadResources } from "./utils.js";
import path from 'path';
import fs from 'fs/promises';
import axios from 'axios';
import cheerio from 'cheerio';
import Listr  from 'listr';

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

const tasks = new Listr([
  {
    title: "Descargar página principal",
    task: async () => {
      const response = await axios.get(pageUrl);
      console.log("Página principal descargada correctamente");

      const html = response.data;
      const $ = cheerio.load(html);

      // 3. Buscar recursos (img, css, scripts locales)
      const resources = [];
      $("img, link[rel='stylesheet'], script[src]").each((_, el) => {
        const tag = $(el);
        const attr = tag.is("img")
          ? "src"
          : el.attribs.href
          ? "href"
          : "src";
        const resourceUrl = tag.attr(attr);

        if (resourceUrl && !resourceUrl.startsWith("http")) {
          const resourceFullUrl = new URL(resourceUrl, pageUrl).href;
          const resourceName = urlToFilename(resourceUrl);
          const resourcePath = path.join(fullOutputAssetsDirName, resourceName);

          // Reemplazar en HTML con ruta local
          tag.attr(attr, path.join(assetsDirName, resourceName));

          resources.push({ url: resourceFullUrl, path: resourcePath });
        }
      });

      console.log(`Se encontraron ${resources.length} recursos para descargar`);

      // 4. Crear directorios
      await fs.mkdir(fullOutputAssetsDirName, { recursive: true });

      // 5. Descargar recursos
      const downloads = resources.map((res) =>
        axios
          .get(res.url, { responseType: "arraybuffer" })
          .then((r) => fs.writeFile(res.path, r.data))
      );
      await Promise.all(downloads);
      console.log("Recursos descargados correctamente");

      // 6. Guardar HTML modificado
      await fs.mkdir(fullOutputDirname, { recursive: true });
      await fs.writeFile(fullOutputFileName, $.html());
      console.log("Página y recursos guardados en:", fullOutputDirname);

      return fullOutputDirname;
    },
  },
]);

// 7. Ejecutar las tareas
return tasks.run().catch((err) => {
  if (err.response) {
    throw new Error(
      `Fallo al descargar ${pageUrl}: código ${err.response.status}`
    );
  } else if (err.request) {
    throw new Error(`No se pudo conectar con ${pageUrl}: ${err.message}`);
  } else {
    throw new Error(`Error al procesar ${pageUrl}: ${err.message}`);
  }
});
};



// ... lógica para descargar la página y los recursos asociados utiliza then y catch
// utilizar axion con la patch url para descargar la página
// utilizar cheerio para parsear el HTML y encontrar los recursos
// guardar la página y los recursos en las rutas calculadas


