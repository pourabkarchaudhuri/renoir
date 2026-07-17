# Preview iframe bridge protocol

Renoir injects `NAV_BRIDGE` into artifact HTML via `wrapWithBridge()` in [`src/lib/preview-modes.ts`](../src/lib/preview-modes.ts). The Studio parent and sandboxed iframe communicate with `postMessage(..., '*')`.

## Parent → iframe

| Type | Payload | Effect |
|------|---------|--------|
| `renoir:set-mode` | `{ mode: 'scroll' \| 'present' }` | Toggle scroll vs single-slide layout |
| `renoir:nav` | `{ dir?: 'prev' \| 'next', idx?: number }` | Slide navigation in present mode |
| `renoir:probe` | — | Re-report nav state |
| `renoir:set-viewport` | `{ width: number }` | Update viewport meta + responsive bridges |
| `renoir:reload` | — | Re-apply mode, charts, layout |
| `renoir:pick-enable` | — | Enable point-and-edit (data-od-id regions) |
| `renoir:pick-disable` | — | Disable pick mode |
| `renoir:scroll-sync` | `{ y: number }` | Sync scroll position (linked diff panes) |
| `renoir:a11y-probe` | — | Run computed-style accessibility probe |
| `renoir:flow-enable` | — | Enable click-through walk mode (data-goto) |
| `renoir:flow-disable` | — | Disable walk mode |
| `renoir:flow-nav` | `{ screenId: string }` | Navigate to screen by id |

## Iframe → parent

| Type | Payload | Effect |
|------|---------|--------|
| `renoir:nav-state` | `{ idx, total }` | Slide index for toolbar UI |
| `renoir:size` | `{ height }` | Scroll content height (scroll mode) |
| `renoir:picked` | `{ odId, tag, textPreview, rect }` | Region picked for scoped edit |
| `renoir:scroll` | `{ y }` | User scroll position (throttled) |
| `renoir:a11y-report` | `{ contrasts, focusables, headings }` | Live probe results |
| `renoir:flow-screen` | `{ screenId, label }` | Active screen after navigation |

## Extension points

Add bridge functions in:

- `src/lib/preview-mobile-sidebar.ts`
- `shared/dashboard-layout.ts` (`DASHBOARD_BRIDGE_FN`)
- `src/lib/preview-deck-contrast.ts`
- `src/lib/preview-pick-bridge.ts`
- `src/lib/preview-scroll-sync.ts`
- `src/lib/preview-a11y-probe.ts`
- `src/lib/preview-flow-bridge.ts`

Inject into `NAV_BRIDGE` and extend the child `message` handler. Contract tests live in `tests/preview-modes.test.ts`.
