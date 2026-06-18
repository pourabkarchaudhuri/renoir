// Probes the Azure Foundry endpoint configured in .env across a matrix of
// URL shapes, api-version values, and body schemas. Prints the first
// 200 chars of every response so we can see exactly what passes and what
// returns "parameter is not allowed".
//
// Run: node scripts/probe-azure.mjs

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
const apiKey   = env.AZURE_FOUNDRY_API_KEY;
const apiVer   = env.AZURE_FOUNDRY_API_VERSION || '2025-04-01-preview';
const model    = env.AZURE_TEXT_DEPLOYMENT || 'gpt-5.4';
const imageDeployment = env.AZURE_IMAGE_DEPLOYMENT || 'gpt-image-2';

console.log('endpoint   :', endpoint);
console.log('apiKey set :', Boolean(apiKey));
console.log('text model :', model);
console.log('image model:', imageDeployment);
console.log('api-version:', apiVer);
console.log('-'.repeat(70));

// Derive the v1 base
function v1Base(ep) {
  // Strip a known terminal v1 op
  let p = ep.replace(/\/+$/, '');
  for (const op of ['responses', 'chat/completions', 'completions', 'embeddings', 'images/generations']) {
    if (p.endsWith('/' + op)) { p = p.slice(0, -(op.length + 1)); break; }
  }
  // p should now end with /openai/v1
  return p;
}

const base = v1Base(endpoint);
console.log('v1 base    :', base);
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
    console.log(`✗ ${label}\n  ${url}\n  network error: ${err?.message || String(err)}`);
    return;
  }
  const ms = Date.now() - t0;
  const ok = res.ok;
  const flag = ok ? '✓' : '✗';
  const snippet = text.replace(/\s+/g, ' ').slice(0, 220);
  console.log(`${flag} ${label}  [${res.status}, ${ms}ms]\n  ${url}\n  ${snippet}`);
}

async function main() {
  // Responses API — non-streaming
  await probe('responses no apiVersion · input string',
    `${base}/responses`,
    { model, input: 'Reply with the single word: pong.' });

  await probe('responses no apiVersion · input messages',
    `${base}/responses`,
    { model, input: [{ role: 'user', content: 'Reply with the single word: pong.' }] });

  await probe('responses ?api-version=preview',
    `${base}/responses?api-version=preview`,
    { model, input: 'Reply with the single word: pong.' });

  await probe(`responses ?api-version=${apiVer}`,
    `${base}/responses?api-version=${encodeURIComponent(apiVer)}`,
    { model, input: 'Reply with the single word: pong.' });

  await probe('responses with temperature (often rejected on v1)',
    `${base}/responses`,
    { model, input: 'Reply with the single word: pong.', temperature: 0.5 });

  await probe('responses streaming · no apiVersion',
    `${base}/responses`,
    { model, input: 'Reply with the single word: pong.', stream: true });

  // Chat completions on v1
  await probe('chat/completions no apiVersion',
    `${base}/chat/completions`,
    { model, messages: [{ role: 'user', content: 'Reply with the single word: pong.' }] });

  await probe('chat/completions ?api-version=preview',
    `${base}/chat/completions?api-version=preview`,
    { model, messages: [{ role: 'user', content: 'Reply with the single word: pong.' }] });

  // Image gen — quick sanity
  await probe('images/generations no apiVersion',
    `${base}/images/generations`,
    { model: imageDeployment, prompt: 'a small red dot on a white square', n: 1, size: '1024x1024' });
}

main().catch((e) => { console.error(e); process.exit(1); });
