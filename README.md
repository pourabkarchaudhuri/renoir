# Renoir

A local-first, opinionated design studio. Drop a brief, get a runnable artifact: web prototype, mobile screen, dashboard, deck, one-pager, email, and more. BYOK for the LLM, Azure Foundry for media. Inspired by [`nexu-io/open-design`](https://github.com/nexu-io/open-design); all code in this repo is authored fresh.

---

## What's in the box

### Studio (chat → artifact)
- 33 skills (web, mobile, deck, doc, media, system).
- 32 design systems with OKLch tokens.
- 5 visual directions for fast palette/font picks when no brand exists.
- Question-form turn-1 brief lock.
- Sandboxed iframe preview, phone / tablet / desktop frames.
- Source-view toggle, save artifact to project workspace.
- Lint badge: structural + a11y findings on the rendered HTML.
- Save artifact as a reusable template.

### Routing
- **BYOK LLM** — any OpenAI-compatible `/chat/completions` endpoint, streamed.
- **CLI agents** — auto-detects 12 known coding-agent CLIs on PATH (Claude Code, Codex, Devin, Cursor Agent, Gemini, OpenCode, Qwen, Copilot, Hermes, Kimi, Pi, Kiro). Pick one from the agent dropdown to forward the turn over a child process.

### Media bay
- **Image** — Azure Foundry `gpt-image-2`. Size + count knobs.
- **Video** — Azure Foundry video deployment (e.g. Seedance) when `AZURE_VIDEO_DEPLOYMENT` is set.
- **Audio** — Azure Foundry audio deployment when `AZURE_AUDIO_DEPLOYMENT` is set.
- **HyperFrames** — capture the latest project artifact as PNG frames in an offscreen Electron window; encode to MP4 if `ffmpeg` is on PATH.
- 60+ prompt-template gallery (image / video / audio / hyperframe), searchable, click-to-fill.

### Library
- Project list with quick-resume.
- Saved templates browser.
- ZIP import (Renoir or generic) and export (`<name>.renoir.zip`).
- Reveal workspace folder.

### Settings
- BYOK base URL + model + key (key in OS keychain, fallback to encrypted `safeStorage`).
- Azure deployment status for image / text / audio / video at a glance.

## Stack

Electron 33 · Vite 5 · React 18 · TypeScript · Tailwind 3 · Framer Motion · Radix · Lucide · Zustand. All extras pure-JS — no native modules required for install (keytar is optional).

## Setup

```bash
cp .env.example .env   # fill in your Azure values
npm install
npm run dev
```

## .env

```env
# Resource endpoint — accepts either a Foundry project URL ending in
# /openai/v1/responses or a resource-only URL. Renoir parses both.
AZURE_FOUNDRY_ENDPOINT=https://<resource>.services.ai.azure.com/api/projects/<project>/openai/v1/responses
AZURE_FOUNDRY_API_KEY=<resource-key>
AZURE_FOUNDRY_API_VERSION=2025-04-01-preview

AZURE_IMAGE_DEPLOYMENT=gpt-image-2
AZURE_TEXT_DEPLOYMENT=gpt-5.4

# Optional
AZURE_AUDIO_DEPLOYMENT=
AZURE_VIDEO_DEPLOYMENT=
```

The endpoint URL parser (`electron/azure-url.ts`) accepts both modern Foundry project paths (`…/openai/v1/responses`) and legacy deployment-rooted URLs (`…/openai/deployments/<name>/…`). For each operation (image / audio / video) Renoir derives the right path automatically.

Endpoint+key live in the Electron main process only — never sent to renderer.

## BYOK

Open Settings → LLM. Enter base URL (e.g. `https://api.openai.com/v1`), a model id, and an API key. The key is stored via `keytar` when available, otherwise encrypted with Electron's `safeStorage`.

## Build

```bash
npm run build           # full installer via electron-builder
npm run release:local   # build without publishing
```

## Layout

```
electron/
  main.ts            Electron entry, IPC registration
  preload.cjs        contextIsolation bridge
  env.ts             dotenv loader
  azure-url.ts       smart Foundry URL deriver
  store.ts           non-secret JSON store (projects, byok meta)
  secrets.ts         keytar / safeStorage
  llm.ts             BYOK SSE chat
  agents.ts          CLI agent detection + child-process invoke
  image.ts           image gen
  media.ts           audio + video gen
  hyperframes.ts     offscreen capture + ffmpeg encode
  lint.ts            artifact lint + brand-spec extraction
  templates.ts       reusable artifact templates
  zipio.ts           zero-dep ZIP read/write
  projectIO.ts       project export/import
  library.ts         skills + design systems + prompt templates + visual directions
  workspace.ts       project workspace I/O

shared/ipc.ts        channel contracts

src/
  main.tsx, App.tsx, index.css
  views/    Home  Studio  Media  Gallery  Settings
  components/
    chrome/   TitleBar  Dock  Toaster
    studio/   LeftRail  ChatPane  QuestionForm  PreviewPane
              AgentPicker  DirectionStrip  PromptGallery  LintBadge
  lib/       cn  prompt  store
  types/     global.d.ts
```

## Concepts

- **Skill** — primer + question form. What kind of artifact, what to ask first.
- **Design system** — OKLch token table, font stack, vibe. Injected into the LLM system prompt.
- **Visual direction** — quick brand-less palette + font pick (5 options).
- **Brand spec** — extracted from a free-text brief; colors / fonts / voice / values / do-nots.
- **Artifact** — single self-contained HTML doc inside `<artifact>...</artifact>`.
- **Question form** — model-emitted block on turn 1 if the brief is thin.
- **HyperFrame** — HTML → frame sequence → MP4 (if ffmpeg available).

## Security

- Renderer has zero direct network: every external call goes through main.
- Image/audio/video API keys never leave main.
- BYOK key stored with `keytar`/`safeStorage`.
- Preview iframe runs `sandbox="allow-scripts"`, no same-origin escape.
- ZIP import lands inside `userData/workspace/projects/<id>/` — no path traversal beyond.

## License

MIT.
