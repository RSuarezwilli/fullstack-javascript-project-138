#!/usr/bin/env node

import process from 'process';
import downloadPage from '../src/index.js';

const args = process.argv.slice(2);

if (args.length < 3 || args[0] !== '-o') {
  console.log('Uso: page-loader -o <directorio> <url>');
  process.exit(1);
}

const outputDir = args[1];
const url = args[2];

downloadPage(url, outputDir)
  .then(({ filepath }) => {
    console.log(`Página guardada en: ${filepath}`);
  })
  .catch((err) => {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  });
