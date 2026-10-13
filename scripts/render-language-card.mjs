import {readFile,writeFile} from 'node:fs/promises';
import {languageBarSvg} from './language-chart.mjs';
const profile=JSON.parse(await readFile(new URL('../generated/languages.json',import.meta.url),'utf8'));
for(const theme of ['light','dark'])await writeFile(new URL('../generated/languages-'+theme+'.svg',import.meta.url),languageBarSvg(profile,theme));
console.log('Rendered compact, static light and dark language bars.');
