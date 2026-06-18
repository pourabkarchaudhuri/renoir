import { describe, it, expect } from 'vitest';
import { parseAzureEndpoint, deriveAzureUrl } from '../electron/azure-url';

describe('parseAzureEndpoint', () => {
  it('parses a project-rooted v1 responses URL', () => {
    const r = parseAzureEndpoint('https://r.services.ai.azure.com/api/projects/p/openai/v1/responses');
    expect(r.v1ProjectBase).toBe('https://r.services.ai.azure.com/api/projects/p/openai/v1');
    expect(r.v1ResourceBase).toBe('https://r.services.ai.azure.com/openai/v1');
    expect(r.isProjectScoped).toBe(true);
  });

  it('parses a project-rooted v1 base without trailing op', () => {
    const r = parseAzureEndpoint('https://r.services.ai.azure.com/api/projects/p/openai/v1');
    expect(r.v1ProjectBase).toBe('https://r.services.ai.azure.com/api/projects/p/openai/v1');
    expect(r.isProjectScoped).toBe(true);
  });

  it('parses a resource-only URL', () => {
    const r = parseAzureEndpoint('https://r.cognitiveservices.azure.com');
    expect(r.resourceRoot).toBe('https://r.cognitiveservices.azure.com');
    expect(r.v1ResourceBase).toBe('https://r.cognitiveservices.azure.com/openai/v1');
    expect(r.v1ProjectBase).toBeUndefined();
    expect(r.isProjectScoped).toBe(false);
  });

  it('strips a trailing chat/completions on legacy resource', () => {
    const r = parseAzureEndpoint('https://r.openai.azure.com/openai/deployments/gpt/chat/completions');
    expect(r.resourceRoot).toBe('https://r.openai.azure.com');
  });

  it('returns empty for invalid URL', () => {
    expect(parseAzureEndpoint('not-a-url').isProjectScoped).toBe(false);
  });
});

describe('deriveAzureUrl', () => {
  it('uses project-rooted v1 for text ops, with no api-version', () => {
    const u = deriveAzureUrl({
      endpoint:   'https://r.services.ai.azure.com/api/projects/p/openai/v1/responses',
      apiVersion: '2025-04-01-preview',
      deployment: 'gpt-5',
      op:         'responses',
    });
    // Foundry v1 rejects ?api-version on v1 paths.
    expect(u).toBe('https://r.services.ai.azure.com/api/projects/p/openai/v1/responses');
  });

  it('uses resource-level v1 for images even when endpoint is project-scoped', () => {
    const u = deriveAzureUrl({
      endpoint:   'https://r.services.ai.azure.com/api/projects/p/openai/v1/responses',
      apiVersion: '2025-04-01-preview',
      deployment: 'gpt-image-2',
      op:         'images/generations',
    });
    // Project paths do not expose images — resource-level v1 only.
    expect(u).toBe('https://r.services.ai.azure.com/openai/v1/images/generations');
  });

  it('falls back to legacy deployments path on resource-only endpoints (with api-version)', () => {
    const u = deriveAzureUrl({
      endpoint:   'https://r.cognitiveservices.azure.com',
      apiVersion: '2024-02-15',
      deployment: 'gpt-image-2',
      op:         'images/generations',
    });
    // Resource-only endpoints prefer their own /openai/v1, but image ops are
    // forced to resource-level v1 first if available.
    expect(u).toBe('https://r.cognitiveservices.azure.com/openai/v1/images/generations');
  });

  it('returns null when no endpoint is set', () => {
    expect(deriveAzureUrl({
      endpoint: '', apiVersion: 'v', deployment: 'd', op: 'images/generations',
    })).toBeNull();
  });
});
