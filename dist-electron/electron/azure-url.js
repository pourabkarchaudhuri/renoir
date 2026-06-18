// Derives the right Azure Foundry route per operation. Empirically validated
// against agenticai-experimental.services.ai.azure.com (see scripts/probe-*.mjs):
//
// 1. Text / chat / responses — works at the project-rooted v1 path:
//      <resource>/api/projects/<p>/openai/v1/{responses,chat/completions,...}
//    NO api-version query parameter (the API rejects it on v1 paths).
//
// 2. Image generation — NOT exposed under the project. Must hit
//    resource-level v1 (no project prefix):
//      <resource>/openai/v1/images/generations
//    Same rule: no api-version on v1.
//
// 3. Legacy deployment-rooted (older Azure OpenAI resources without v1):
//      <resource>/openai/deployments/<dep>/<op>?api-version=<v>
//    Used as a fallback when the endpoint is plain resource-only.
const V1_OPS = [
    'responses',
    'chat/completions',
    'completions',
    'embeddings',
    'images/generations',
    'images/edits',
    'audio/speech',
    'audio/transcriptions',
    'audio/translations',
    'video/generations',
];
/** Operations that MUST use resource-level v1 (not project-rooted). */
const RESOURCE_LEVEL_V1_OPS = new Set([
    'images/generations', 'images/edits',
]);
export function parseAzureEndpoint(raw) {
    const trimmed = (raw || '').trim().replace(/\/+$/, '');
    if (!trimmed)
        return { isProjectScoped: false };
    let url;
    try {
        url = new URL(trimmed);
    }
    catch {
        return { isProjectScoped: false };
    }
    // Strip a known terminal v1 op so we get the v1 base.
    let pathname = url.pathname.replace(/\/+$/, '');
    for (const op of V1_OPS) {
        const suffix = `/${op}`;
        if (pathname.endsWith(suffix)) {
            pathname = pathname.slice(0, -suffix.length);
            break;
        }
    }
    // Detect v1 form: pathname must end with `/openai/v1`
    const v1Idx = pathname.lastIndexOf('/openai/v1');
    if (v1Idx >= 0 && pathname.length === v1Idx + '/openai/v1'.length) {
        const isProject = pathname.includes('/api/projects/');
        return {
            v1ProjectBase: isProject ? `${url.origin}${pathname}` : undefined,
            v1ResourceBase: `${url.origin}/openai/v1`,
            isProjectScoped: isProject,
        };
    }
    // Detect resource-only form (no /openai segment)
    const oai = pathname.lastIndexOf('/openai');
    if (oai < 0) {
        return {
            resourceRoot: `${url.origin}${pathname}`,
            v1ResourceBase: `${url.origin}${pathname}/openai/v1`,
            isProjectScoped: false,
        };
    }
    // Resource form ending at `/openai`
    const root = `${url.origin}${pathname.slice(0, oai)}`;
    return {
        resourceRoot: root,
        v1ResourceBase: `${root}/openai/v1`,
        isProjectScoped: false,
    };
}
/**
 * Returns the URL to POST to. Order of preference:
 *   1. Resource-level v1 if the op REQUIRES it (image/image-edits).
 *   2. Project-rooted v1 if available.
 *   3. Resource-level v1 otherwise.
 *   4. Legacy `<root>/openai/deployments/<dep>/<op>?api-version=...`.
 */
export function deriveAzureUrl(opts) {
    const r = parseAzureEndpoint(opts.endpoint);
    const v = encodeURIComponent(opts.apiVersion);
    const op = opts.op;
    const mustBeResourceLevel = RESOURCE_LEVEL_V1_OPS.has(op);
    // 1. Resource-level v1 forced for images.
    if (mustBeResourceLevel && r.v1ResourceBase) {
        return `${r.v1ResourceBase}/${op}`;
    }
    // 2. Project-rooted v1 (text-side preferred).
    if (r.v1ProjectBase && !mustBeResourceLevel) {
        return `${r.v1ProjectBase}/${op}`;
    }
    // 3. Plain v1 resource base (e.g. user pointed at /openai or just resource).
    if (r.v1ResourceBase) {
        return `${r.v1ResourceBase}/${op}`;
    }
    // 4. Legacy deployments path with api-version.
    if (r.resourceRoot) {
        const legacyMap = {
            'responses': 'chat/completions',
            'chat/completions': 'chat/completions',
            'completions': 'completions',
            'embeddings': 'embeddings',
            'images/generations': 'images/generations',
            'images/edits': 'images/edits',
            'audio/speech': 'audio/speech',
            'audio/transcriptions': 'audio/transcriptions',
            'audio/translations': 'audio/translations',
            'video/generations': 'video/generations',
        };
        const legacy = legacyMap[op] ?? op;
        return `${r.resourceRoot}/openai/deployments/${encodeURIComponent(opts.deployment)}/${legacy}?api-version=${v}`;
    }
    return null;
}
