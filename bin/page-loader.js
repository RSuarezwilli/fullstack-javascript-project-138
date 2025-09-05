#!/usr/bin/env node
import process from 'process';
import path from 'path';
import downloadPage from '../src/index.js';

const usage = () => {
  console.log('Uso: page-loader [-o directorio] <url>');
  process.exit(1);
};

const args = process.argv.slice(2);
if (args.length < 1) {
  usage();
}

let outputDir = process.cwd();
let url = null;

const oIndex = args.indexOf('-o');
if (oIndex !== -1) {
  if (oIndex === args.length - 1) {
    usage();
  }
  outputDir = path.resolve(process.cwd(), args[oIndex + 1]);
  // Tomar la URL como el último argumento que no sea -o ni directorio
  url = args.filter((a, i) => i !== oIndex && i !== oIndex + 1).pop();
} else {
  // Sin -o: último argumento es la URL
  url = args[args.length - 1];
}

if (!url) {
  usage();
}

downloadPage(url, outputDir)
  .then(({ filepath }) => {
    console.log(`Página guardada en: ${filepath}`);
  })
  .catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
