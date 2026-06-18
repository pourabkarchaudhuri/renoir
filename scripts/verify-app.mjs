// End-to-end check: reuses the app's azure-url derivation + load-env logic
// to confirm we POST to URLs that actually return 200 against the real
// Foundry endpoint configured in .env.

import fs from 'node:fs';
import path from 'node:path';
import { parseAzureEndpoint, deriveAzureUrl } from '../dist-electron/electron/azure-url.js';

function loadEnv(p) {
  const out = {};
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

const env = loadEnv(path.resolve('.env'));
const endpoint  = env.AZURE_FOUNDRY_ENDPOINT;
const apiKey    = env.AZURE_FOUNDRY_API_KEY;
const apiVer    = env.AZURE_FOUNDRY_API_VERSION || '2025-04-01-preview';
const textModel = env.AZURE_TEXT_DEPLOYMENT || 'gpt-5.4';
const imgModel  = env.AZURE_IMAGE_DEPLOYMENT || 'gpt-image-2';

console.log('[1] parseAzureEndpoint');
console.log(parseAzureEndpoint(endpoint));
console.log('-'.repeat(70));

const cases = [
  { name: 'text · responses',   op: 'responses',          deployment: textModel,
    body: { model: textModel, input: 'Reply with exactly: pong.' } },
  { name: 'text · chat/comp',   op: 'chat/completions',   deployment: textModel,
    body: { model: textModel, messages: [{ role: 'user', content: 'Reply with exactly: pong.' }] } },
];

async function probe(label, url, body) {
  const t0 = Date.now();
  let res, text;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
    text = await res.text();
  } catch (err) {
    console.log(`✗ ${label}\n  ${url}\n  network: ${err?.message}`);
    return false;
  }
  const ms = Date.now() - t0;
  const flag = res.ok ? '✓' : '✗';
  const snip = text.replace(/\s+/g, ' ').slice(0, 200);
  console.log(`${flag} ${label}  [${res.status}, ${ms}ms]\n  ${url}\n  ${snip}`);
  return res.ok;
}

async function main() {
  console.log('[2] derive + POST per op');
  let allOk = true;
  for (const c of cases) {
    const url = deriveAzureUrl({ endpoint, apiVersion: apiVer, deployment: c.deployment, op: c.op });
    if (!url) { console.log(`✗ ${c.name} — no URL derived`); allOk = false; continue; }
    const ok = await probe(c.name, url, c.body);
    allOk = allOk && ok;
  }
  console.log('-'.repeat(70));
  console.log('[3] image URL derivation (no actual gen — too slow)');
  const imgUrl = deriveAzureUrl({ endpoint, apiVersion: apiVer, deployment: imgModel, op: 'images/generations' });
  console.log('image URL:', imgUrl);
  // Confirm shape: should be resource-level v1 with no api-version.
  const expected = /^https:\/\/[^/]+\/openai\/v1\/images\/generations$/;
  if (imgUrl && expected.test(imgUrl)) {
    console.log('✓ image URL matches resource-level v1 shape');
  } else {
    console.log('✗ image URL is NOT the resource-level v1 shape we validated');
    allOk = false;
  }
  console.log('-'.repeat(70));
  console.log(allOk ? '✓ ALL CHECKS PASSED' : '✗ SOME CHECKS FAILED');
  process.exit(allOk ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
