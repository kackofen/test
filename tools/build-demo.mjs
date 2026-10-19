// Builds a single self-contained HTML preview of BRASILI (no server: accounts and scores stay
// in the browser). Usage: node tools/build-demo.mjs <path-to-esbuild-package-dir> <out.html>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [esbuildDir, out] = process.argv.slice(2);
const esbuild = await import(pathToFileURL(join(esbuildDir, 'lib', 'main.js')).href).then(m => m.default || m);

const js = (await esbuild.build({ entryPoints: [join(root, 'public/js/app.js')], bundle: true, format: 'iife', minify: true, write: false, target: 'es2020' })).outputFiles[0].text;
const css = readFileSync(join(root, 'public/css/app.css'), 'utf8');
const data = Object.fromEntries(['teams', 'squads', 'schedule', 'venues'].map(n => [n, JSON.parse(readFileSync(join(root, 'public/data', n + '.json'), 'utf8'))]));
const html = readFileSync(join(root, 'public/index.html'), 'utf8');
const body = html.slice(html.indexOf('<header'), html.indexOf('<script type="module"'));
const favicon = 'data:image/png;base64,' + readFileSync(join(root, 'public/img/favicon.png')).toString('base64');

const page = `<meta charset="utf-8">
<title>BRASILI</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="icon" href="${favicon}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bangers&family=Press+Start+2P&display=swap">
<style>
/* Single look by choice: night-time stadium, comic panels on dark navy */
${css}
:root { color-scheme: dark; }
.demo-note { font-family: var(--pixel); font-size: 8px; color: var(--muted); }
</style>
${body.replace('src="img/favicon.png"', `src="${favicon}"`)}
<script>window.BRASILI_DEMO = true; window.BRASILI_DATA = ${JSON.stringify(data)};</script>
<script>${js.replace(/<\/script/gi, '<\\/script')}</script>
`;
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, page);
console.log('demo written', out, (page.length / 1024).toFixed(0) + ' KB');
