// IPC channel contracts shared between main and renderer.
// Keep this file dependency-free so both bundles can import it.
export const IPC = {
    // Settings / BYOK
    byokGet: 'renoir:byok:get',
    byokSet: 'renoir:byok:set',
    byokClear: 'renoir:byok:clear',
    // Azure status
    azureStatus: 'renoir:azure:status',
    // Skills + design systems
    skillsList: 'renoir:skills:list',
    designSystemsList: 'renoir:design:list',
    // Chat (LLM)
    chatStart: 'renoir:chat:start',
    chatCancel: 'renoir:chat:cancel',
    chatEvent: 'renoir:chat:event', // main → renderer, broadcast
    // Image
    imageGenerate: 'renoir:image:generate',
    imageBatchGenerate: 'renoir:image:generateBatch',
    // Projects
    projectsList: 'renoir:projects:list',
    projectCreate: 'renoir:projects:create',
    projectSave: 'renoir:projects:save',
    projectDelete: 'renoir:projects:delete',
    projectRead: 'renoir:projects:read',
    // Workspace
    workspaceOpen: 'renoir:workspace:open',
    workspaceGet: 'renoir:workspace:get',
    workspaceWrite: 'renoir:workspace:write',
    // Document export
    exportDocument: 'renoir:export:document',
};
