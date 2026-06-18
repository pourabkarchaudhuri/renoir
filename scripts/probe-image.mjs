// Probe variants for the image-gen path on Foundry projects.
import fs from 'node:fs';
import path from 'node:path';

function loadEnv(p) {
  const out = {};
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

const env = loadEnv(path.resolve('.env'));
const endpoint = (env.AZURE_FOUNDRY_ENDPOINT || '').replace(/\/+$/, '');
const apiKey = env.AZURE_FOUNDRY_API_KEY;
const apiVer = env.AZURE_FOUNDRY_API_VERSION || '2025-04-01-preview';
const imageDeployment = env.AZURE_IMAGE_DEPLOYMENT || 'gpt-image-2';

// Strip terminal op to get v1 base
let p = endpoint;
for (const op of ['responses', 'chat/completions', 'completions', 'embeddings']) {
  if (p.endsWith('/' + op)) { p = p.slice(0, -(op.length + 1)); break; }
}
const v1Base = p; // ends with /openai/v1

// Resource origin (no /api/projects/.../openai/v1)
const url = new URL(endpoint);
const resourceOrigin = url.origin;
const projectMatch = url.pathname.match(/^\/api\/projects\/[^/]+/);
const projectPrefix = projectMatch ? projectMatch[0] : '';

console.log('v1 base    :', v1Base);
console.log('resource   :', resourceOrigin);
console.log('project    :', projectPrefix);
console.log('-'.repeat(70));

async function probe(label, url, body, extraHeaders = {}) {
  const t0 = Date.now();
  let res, text;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
        Authorization: `Bearer ${apiKey}`,
        ...extraHeaders,
      },
      body: JSON.stringify(body),
    });
    text = await res.text();
  } catch (err) {
    console.log(`✗ ${label}\n  ${url}\n  network: ${err?.message}`);
    return;
  }
  const ms = Date.now() - t0;
  const flag = res.ok ? '✓' : '✗';
  const snip = text.replace(/\s+/g, ' ').slice(0, 220);
  console.log(`${flag} ${label}  [${res.status}, ${ms}ms]\n  ${url}\n  ${snip}`);
}

const promptBody = { model: imageDeployment, prompt: 'a small red dot on a white square', n: 1, size: '1024x1024' };

async function main() {
  // 1. v1 path on project (already known: 404)
  await probe('v1 project · images/generations', `${v1Base}/images/generations`, promptBody);

  // 2. resource-level v1 (no project prefix)
  await probe('v1 resource · images/generations', `${resourceOrigin}/openai/v1/images/generations`, promptBody);

  // 3. legacy deployment-rooted on project (?api-version)
  await probe('legacy deployments · project',
    `${resourceOrigin}${projectPrefix}/openai/deployments/${imageDeployment}/images/generations?api-version=${encodeURIComponent(apiVer)}`,
    { prompt: promptBody.prompt, size: promptBody.size, n: 1 });

  // 4. legacy deployment-rooted on resource (?api-version)
  await probe('legacy deployments · resource',
    `${resourceOrigin}/openai/deployments/${imageDeployment}/images/generations?api-version=${encodeURIComponent(apiVer)}`,
    { prompt: promptBody.prompt, size: promptBody.size, n: 1 });

  // 5. v1 project with output_format hint
  await probe('v1 project · with output_format=b64',
    `${v1Base}/images/generations`,
    { ...promptBody, output_format: 'b64_json' });

  // 6. responses-style image gen via /responses
  await probe('responses · with image input',
    `${v1Base}/responses`,
    { model: imageDeployment, input: promptBody.prompt });

  // 7. v1 project with preview api version anyway (for completeness)
  await probe('v1 project · ?api-version=preview', `${v1Base}/images/generations?api-version=preview`, promptBody);
}

main().catch((e) => { console.error(e); process.exit(1); });
