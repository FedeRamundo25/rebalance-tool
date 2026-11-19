import { readFile } from 'node:fs/promises';

const expectedRevision = process.env.GITHUB_SHA || 'local';
const html = await readFile('Web/dist/index.html', 'utf8');
const revision = html.match(/<meta\s+name="rebalance-build"\s+content="([^"]+)"/i)?.[1];

if (revision !== expectedRevision) {
  throw new Error(`Built frontend revision mismatch: expected ${expectedRevision}, received ${revision || 'no build marker'}.`);
}

const scriptPath = html.match(/<script[^>]+src="([^"]+\.js)"/i)?.[1];
if (!scriptPath) throw new Error('Built frontend is missing its JavaScript bundle.');

const scriptFile = new URL(`.${scriptPath}`, `file://${process.cwd()}/Web/dist/index.html`);
const script = await readFile(scriptFile, 'utf8');
for (const expectedText of ['Rebalanceo y Planificación de Capacidad', 'Seguimiento de Vacantes y Excesos']) {
  if (!script.includes(expectedText)) throw new Error(`Built frontend is missing “${expectedText}”.`);
}

console.log(`Built Cloudflare artifact matches ${expectedRevision} and includes the original Rebalance interface.`);
