const baseUrl = new URL(process.env.REBALANCE_URL || 'https://rebalance-tool.pages.dev/');
const expectedRevision = process.env.GITHUB_SHA;
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

if (!expectedRevision) {
  throw new Error('GITHUB_SHA is required to verify the production deployment revision.');
}

let lastFailure = 'Cloudflare has not served the expected build yet.';
let deployedRevision = '';

for (let attempt = 1; attempt <= 30; attempt += 1) {
  try {
    const pageResponse = await fetch(baseUrl, { cache: 'no-store', signal: AbortSignal.timeout(15_000) });
    if (!pageResponse.ok) throw new Error(`The page returned HTTP ${pageResponse.status}.`);

    const html = await pageResponse.text();
    deployedRevision = html.match(/<meta\s+name="rebalance-build"\s+content="([^"]+)"/i)?.[1] ?? '';
    if (deployedRevision !== expectedRevision) {
      throw new Error(`Expected build ${expectedRevision}, received ${deployedRevision || 'no build marker'}.`);
    }

    const scriptPath = html.match(/<script[^>]+src="([^"]+\.js)"/i)?.[1];
    if (!scriptPath) throw new Error('The page has no JavaScript bundle.');
    const scriptResponse = await fetch(new URL(scriptPath, baseUrl), { cache: 'no-store', signal: AbortSignal.timeout(15_000) });
    if (!scriptResponse.ok) throw new Error(`The JavaScript bundle returned HTTP ${scriptResponse.status}.`);

    const script = await scriptResponse.text();
    for (const expectedText of ['Rebalanceo y Planificación de Capacidad', 'Seguimiento de Vacantes y Excesos']) {
      if (!script.includes(expectedText)) throw new Error(`The deployed app is missing “${expectedText}”.`);
    }
    break;
  } catch (error) {
    lastFailure = error instanceof Error ? error.message : String(error);
    console.log(`Cloudflare build check ${attempt}/30: ${lastFailure}`);
    if (attempt === 30) throw new Error(`Cloudflare deployment check failed: ${lastFailure}`);
    await pause(10_000);
  }
}

lastFailure = 'The API health endpoint has not reported healthy yet.';
for (let attempt = 1; attempt <= 8; attempt += 1) {
  try {
    const healthResponse = await fetch(new URL('/api/health', baseUrl), { cache: 'no-store', signal: AbortSignal.timeout(20_000) });
    if (!healthResponse.ok) throw new Error(`The API returned HTTP ${healthResponse.status}.`);
    const health = await healthResponse.json();
    if (health.ok !== true) throw new Error('The API health endpoint did not report ok=true.');
    console.log(`Cloudflare production is serving ${deployedRevision}; app bundle and API health checks passed.`);
    process.exit(0);
  } catch (error) {
    lastFailure = error instanceof Error ? error.message : String(error);
    console.log(`API health check ${attempt}/8: ${lastFailure}`);
    if (attempt < 8) await pause(10_000);
  }
}

throw new Error(`Cloudflare API health check failed: ${lastFailure}`);
