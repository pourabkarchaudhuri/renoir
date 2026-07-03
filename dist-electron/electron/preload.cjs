// Preload — exposes a typed surface to the renderer.
const { contextBridge, ipcRenderer } = require('electron');

const C = {
  byokGet:     'renoir:byok:get',
  byokSet:     'renoir:byok:set',
  byokClear:   'renoir:byok:clear',
  azureStatus: 'renoir:azure:status',

  skillsList:        'renoir:skills:list',
  skillsPrimer:      'renoir:skills:primer',
  designSystemsList: 'renoir:design:list',
  designSystemGet:   'renoir:design:get',
  promptsList:       'renoir:prompts:list',
  directionsList:    'renoir:directions:list',

  chatStart:  'renoir:chat:start',
  chatCancel: 'renoir:chat:cancel',
  chatEvent:  'renoir:chat:event',
  chatRoute:  'renoir:chat:route',
  themeSet:   'renoir:theme:set',

  agentsList:   'renoir:agents:list',
  agentsInvoke: 'renoir:agents:invoke',
  agentsCancel: 'renoir:agents:cancel',

  imageGenerate: 'renoir:image:generate',
  imageBatchGenerate: 'renoir:image:generateBatch',
  imageBatchProgress: 'renoir:image:batchProgress',
  audioGenerate: 'renoir:audio:generate',
  videoGenerate: 'renoir:video:generate',

  hyperframesRender: 'renoir:hyperframes:render',

  lintArtifact: 'renoir:lint:artifact',
  brandExtract: 'renoir:brand:extract',

  templatesList:   'renoir:templates:list',
  templatesSave:   'renoir:templates:save',
  templatesDelete: 'renoir:templates:delete',

  projectsList:   'renoir:projects:list',
  projectCreate:  'renoir:projects:create',
  projectSave:    'renoir:projects:save',
  projectDelete:  'renoir:projects:delete',
  projectRead:    'renoir:projects:read',
  projectExport:  'renoir:projects:export',
  projectImport:  'renoir:projects:import',

  workspaceOpen:  'renoir:workspace:open',
  workspaceWrite: 'renoir:workspace:write',

  imageEdit: 'renoir:image:edit',
  critiqueStart: 'renoir:critique:start',
  exportPdf: 'renoir:export:pdf',
  exportPptx: 'renoir:export:pptx',
  assetsList: 'renoir:assets:list',

  visionDescribe: 'renoir:vision:describe',
  storyboardRender: 'renoir:storyboard:render',
  projectFork: 'renoir:projects:fork',
  projectRemix: 'renoir:projects:remix',
  projectRename: 'renoir:projects:rename',
  projectAddVersion: 'renoir:projects:addVersion',
  projectRestoreVersion: 'renoir:projects:restoreVersion',
  colorsExtract: 'renoir:colors:extract',
  previewOpen: 'renoir:preview:open',
  previewPush: 'renoir:preview:push',
  previewIsOpen: 'renoir:preview:isOpen',
  customListDirections:   'renoir:custom:listDirections',
  customSaveDirection:    'renoir:custom:saveDirection',
  customDeleteDirection:  'renoir:custom:deleteDirection',

  customListSkills:    'renoir:custom:listSkills',
  customSaveSkill:     'renoir:custom:saveSkill',
  customDeleteSkill:   'renoir:custom:deleteSkill',
  customListSystems:   'renoir:custom:listSystems',
  customSaveSystem:    'renoir:custom:saveSystem',
  customDeleteSystem:  'renoir:custom:deleteSystem',
};

contextBridge.exposeInMainWorld('renoir', {
  byokGet:   () => ipcRenderer.invoke(C.byokGet),
  byokSet:   (cfg) => ipcRenderer.invoke(C.byokSet, cfg),
  byokClear: () => ipcRenderer.invoke(C.byokClear),
  azureStatus: () => ipcRenderer.invoke(C.azureStatus),

  listSkills:           () => ipcRenderer.invoke(C.skillsList),
  getSkillPrimer:       (id) => ipcRenderer.invoke(C.skillsPrimer, id),
  listDesignSystems:    () => ipcRenderer.invoke(C.designSystemsList),
  getDesignSystem:      (id) => ipcRenderer.invoke(C.designSystemGet, id),
  listPromptTemplates:  () => ipcRenderer.invoke(C.promptsList),
  listVisualDirections: () => ipcRenderer.invoke(C.directionsList),

  chatStart:  (req) => ipcRenderer.invoke(C.chatStart, req),
  chatCancel: (id)  => ipcRenderer.invoke(C.chatCancel, id),
  chatRoute:  () => ipcRenderer.invoke(C.chatRoute),
  themeSet:   (t) => ipcRenderer.invoke(C.themeSet, t),
  onChatEvent: (cb) => {
    const handler = (_e, payload) => cb(payload);
    ipcRenderer.on(C.chatEvent, handler);
    return () => ipcRenderer.removeListener(C.chatEvent, handler);
  },

  listAgents:  () => ipcRenderer.invoke(C.agentsList),
  invokeAgent: (req) => ipcRenderer.invoke(C.agentsInvoke, req),
  cancelAgent: (id)  => ipcRenderer.invoke(C.agentsCancel, id),

  imageGenerate: (req) => ipcRenderer.invoke(C.imageGenerate, req),
  imageBatchGenerate: (req) => ipcRenderer.invoke(C.imageBatchGenerate, req),
  onImageBatchProgress: (cb) => {
    const handler = (_e, payload) => cb(payload);
    ipcRenderer.on(C.imageBatchProgress, handler);
    return () => ipcRenderer.removeListener(C.imageBatchProgress, handler);
  },
  audioGenerate: (req) => ipcRenderer.invoke(C.audioGenerate, req),
  videoGenerate: (req) => ipcRenderer.invoke(C.videoGenerate, req),

  hyperframesRender: (req) => ipcRenderer.invoke(C.hyperframesRender, req),

  lintArtifact: (html) => ipcRenderer.invoke(C.lintArtifact, html),
  brandExtract: (text) => ipcRenderer.invoke(C.brandExtract, text),

  listTemplates:  () => ipcRenderer.invoke(C.templatesList),
  saveTemplate:   (rec) => ipcRenderer.invoke(C.templatesSave, rec),
  deleteTemplate: (id) => ipcRenderer.invoke(C.templatesDelete, id),

  listProjects:  () => ipcRenderer.invoke(C.projectsList),
  createProject: (meta) => ipcRenderer.invoke(C.projectCreate, meta),
  saveProject:   (meta) => ipcRenderer.invoke(C.projectSave, meta),
  deleteProject: (id) => ipcRenderer.invoke(C.projectDelete, id),
  readProject:   (id) => ipcRenderer.invoke(C.projectRead, id),
  exportProject: (id) => ipcRenderer.invoke(C.projectExport, id),
  importProject: ()   => ipcRenderer.invoke(C.projectImport),

  openWorkspace: () => ipcRenderer.invoke(C.workspaceOpen),
  writeArtifact: (req) => ipcRenderer.invoke(C.workspaceWrite, req),

  imageEdit:      (req) => ipcRenderer.invoke(C.imageEdit, req),
  critiqueStart:  (req) => ipcRenderer.invoke(C.critiqueStart, req),
  exportPdf:      (req) => ipcRenderer.invoke(C.exportPdf, req),
  exportPptx:     (req) => ipcRenderer.invoke(C.exportPptx, req),
  listProjectAssets: (req) => ipcRenderer.invoke(C.assetsList, req),

  visionDescribe:  (req) => ipcRenderer.invoke(C.visionDescribe, req),
  storyboardRender:(req) => ipcRenderer.invoke(C.storyboardRender, req),
  forkProject:     (req) => ipcRenderer.invoke(C.projectFork, req),
  remixProject:    (req) => ipcRenderer.invoke(C.projectRemix, req),
  renameProject:   (req) => ipcRenderer.invoke(C.projectRename, req),
  addVersion:      (req) => ipcRenderer.invoke(C.projectAddVersion, req),
  restoreVersion:  (req) => ipcRenderer.invoke(C.projectRestoreVersion, req),
  colorsExtract:   (req) => ipcRenderer.invoke(C.colorsExtract, req),
  openPreview:     (html) => ipcRenderer.invoke(C.previewOpen, html),
  pushPreview:     (html) => ipcRenderer.invoke(C.previewPush, html),
  previewIsOpen:   () => ipcRenderer.invoke(C.previewIsOpen),
  listCustomDirections:   () => ipcRenderer.invoke(C.customListDirections),
  saveCustomDirection:    (rec) => ipcRenderer.invoke(C.customSaveDirection, rec),
  deleteCustomDirection:  (id) => ipcRenderer.invoke(C.customDeleteDirection, id),

  listCustomSkills:    () => ipcRenderer.invoke(C.customListSkills),
  saveCustomSkill:     (rec) => ipcRenderer.invoke(C.customSaveSkill, rec),
  deleteCustomSkill:   (id) => ipcRenderer.invoke(C.customDeleteSkill, id),
  listCustomSystems:   () => ipcRenderer.invoke(C.customListSystems),
  saveCustomSystem:    (rec) => ipcRenderer.invoke(C.customSaveSystem, rec),
  deleteCustomSystem:  (id) => ipcRenderer.invoke(C.customDeleteSystem, id),

  onFlushRequest: (cb) => {
    const handler = () => cb();
    ipcRenderer.on('renoir:app:flush', handler);
    return () => ipcRenderer.removeListener('renoir:app:flush', handler);
  },
  flushDone: () => ipcRenderer.invoke('renoir:app:flush-done'),

  platform: process.platform,
});
