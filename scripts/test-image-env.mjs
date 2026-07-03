#!/usr/bin/env node
/** Quick smoke test — same URL/body shape as Renoir image.ts + your curl. */
import { config } from 'dotenv';
import { deriveAzureUrl } from '../dist-electron/electron/azure-url.js';

config({ path: '.env' });

const endpoint = (process.env.AZURE_IMAGE_ENDPOINT || process.env.AZURE_FOUNDRY_ENDPOINT || '').replace(/\/+$/, '');
const key = process.env.AZURE_IMAGE_API_KEY || process.env.AZURE_FOUNDRY_API_KEY || '';
const model = process.env.AZURE_IMAGE_DEPLOYMENT || 'gpt-image-2';
const url = deriveAzureUrl({
  endpoint,
  apiVersion: process.env.AZURE_FOUNDRY_API_VERSION || '2025-08-07',
  deployment: model,
  op: 'images/generations',
});

if (!url || !key) {
  console.error('Missing AZURE_IMAGE_ENDPOINT (or AZURE_FOUNDRY_ENDPOINT) and API key');
  process.exit(1);
}

console.log('POST', url);
console.log('model:', model);

const res = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${key}`,
  },
  body: JSON.stringify({
    prompt: 'A photograph of a red fox in an autumn forest',
    model,
    size: '1024x1024',
    n: 1,
    output_format: 'png',
    output_compression: 100,
  }),
});

const text = await res.text();
console.log('status:', res.status);
console.log(text.slice(0, 400));
process.exit(res.ok ? 0 : 1);
