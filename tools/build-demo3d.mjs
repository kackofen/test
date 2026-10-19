// Builds the self-contained BRASILI 3D prototype page (Three.js from the jsDelivr CDN).
// Usage: node tools/build-demo3d.mjs <path-to-esbuild-package-dir> <out.html>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [esbuildDir, out] = process.argv.slice(2);
const esbuild = await import(pathToFileURL(join(esbuildDir, 'lib', 'main.js')).href).then(m => m.default || m);
const js = (await esbuild.build({ entryPoints: [join(root, 'public/js/game3d/app3d.js')], bundle: true, format: 'iife', minify: true, write: false, target: 'es2020', charset: 'utf8' })).outputFiles[0].text;
const css = ['game3d.css', 'proto3d.css'].map(f => readFileSync(join(root, 'public/css', f), 'utf8')).join('\n');
const data = Object.fromEntries(['teams', 'squads', 'schedule', 'venues'].map(n => [n, JSON.parse(readFileSync(join(root, 'public/data', n + '.json'), 'utf8'))]));
const page = `<meta charset="utf-8">
<title>BRASILI 3D</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bangers&family=Press+Start+2P&display=swap">
<style>
/* Single look by choice: night arena around a 16:9 game screen */
${css}
</style>
<div class="stage"><div class="screen"><div id="mapview" class="g3d"></div><div id="gameview" class="g3d" hidden></div><canvas id="introcv" hidden></canvas><div id="ui"></div></div></div>
<script src="https://cdn.jsdelivr.net/npm/three@0.159.0/build/three.min.js"></script>
<script>window.BRASILI_DATA = ${JSON.stringify(data)};</script>
<script>${js.replace(/<\/script/gi, '<\\/script')}</script>
`;
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, page);
console.log('3d demo written', out, (page.length / 1024).toFixed(0) + ' KB');
