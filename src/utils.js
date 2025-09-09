import path from 'path';
import fs from 'fs/promises';
import axios from 'axios';

const processedName = (name) => name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
export const urlToFilename = (link, defaultFormat = '.html') => {
  const { dir, name, ext } = path.parse(link);
  const slug = processedName(path.join(dir, name));
  const format = ext || defaultFormat;
  return `${slug}${format}`;
};

export const urlToDirname = (link) => {
  const { dir, name } = path.parse(link);
  const slug = processedName(path.join(dir, name));
  return `${slug}_files`;
};

export const getExtension = (fileName) => {
  const ext = path.extname(fileName);
  return ext || '';
};

export const sanitizeOutputDir = (dir) => {
  const restrictedPaths = ['/sys', '/dev', '/proc', '/etc', '/bin', '/lib', '/usr'];
  if (restrictedPaths.includes(dir)) {
    throw new Error(`Refusing to write to restricted directory: ${dir}`);
  }
  return dir;
};

// Descarga y reescribe recursos locales (img, link, script)
export const downloadResources = async ($, pageUrl, outputDir) => {
  const pageHost = new URL(pageUrl).hostname;

  const elements = [
    { selector: 'img[src]', attr: 'src' },
    { selector: 'link[href]', attr: 'href' },
    { selector: 'script[src]', attr: 'src' },
  ];

  const resources = [];

  elements.forEach(({ selector, attr }) => {
    $(selector).each((_, el) => {
      const value = $(el).attr(attr);
      if (!value) return;

      const resourceUrl = new URL(value, pageUrl);

      // Solo recursos locales (mismo dominio o subdominios)
      if (resourceUrl.hostname.endsWith(pageHost)) {
        resources.push({ el, attr, url: resourceUrl.toString() });
      }
    });
  });
  // eslint-disable-next-line   no-restricted-syntax
  for (const { el, attr, url } of resources) {
    const filename = urlToFilename(url, ''); // usa tu helper
    const filepath = path.join(outputDir, filename);
    // eslint-disable-next-line no-await-in-loop
    const { data } = await axios.get(url, { responseType: 'arraybuffer' });
    // eslint-disable-next-line no-await-in-loop
    await fs.writeFile(filepath, data);

    // Reescribir en el HTML
    $(el).attr(attr, `${path.basename(outputDir)}/${filename}`);
  }
};
