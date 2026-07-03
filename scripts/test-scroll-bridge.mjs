import { JSDOM } from 'jsdom';
import { wrapWithBridge } from '../src/lib/preview-modes.ts';

const salonLikeHtml = `<!doctype html><html><head><style>
  html,body{margin:0;overflow:hidden;height:100vh}
  main{height:100vh;overflow:hidden}
  section{position:absolute;inset:0;width:100%;height:100vh}
</style></head><body>
<header style="height:64px">Nav</header>
<main>
  <section id="hero"><h1>Hero</h1><div style="height:600px">x</div></section>
  <section id="services"><h1>Services</h1></section>
  <section id="gallery"><h1>Gallery</h1></section>
  <section id="team"><h1>Team</h1></section>
  <section id="cta"><h1>Book</h1></section>
  <section id="visit"><h1>Visit</h1></section>
</main>
<footer style="height:120px">Footer</footer>
</body></html>`;

const src = wrapWithBridge(salonLikeHtml);
const dom = new JSDOM(src, { runScripts: 'dangerously', pretendToBeVisual: true });
const win = dom.window;
const sizes = [];

win.parent = {
  postMessage(data) {
    if (data?.type === 'renoir:size') sizes.push(data.height);
    if (data?.type === 'renoir:nav-state') {
      console.log('nav-state', data.idx + 1, '/', data.total);
    }
  },
};

await new Promise((r) => {
  if (win.document.readyState === 'complete') r();
  else win.addEventListener('load', () => r());
});

const before = [...win.document.querySelectorAll('main > section')].map(
  (s) => win.getComputedStyle(s).position,
);
console.log('BEFORE scroll mode — section positions:', before);

win.postMessage({ type: 'renoir:set-mode', mode: 'scroll' }, '*');
await new Promise((r) => setTimeout(r, 200));

const after = [...win.document.querySelectorAll('main > section')].map(
  (s) => win.getComputedStyle(s).position,
);
const transforms = [...win.document.querySelectorAll('main > section')].map((s) => s.style.transform);

console.log('AFTER scroll mode — section positions:', after);
console.log('AFTER scroll mode — inline transforms:', transforms);
console.log('Mode style injected:', Boolean(win.document.getElementById('__renoir_mode_style')?.textContent));
console.log('Reported heights:', sizes);
console.log('doc scrollHeight:', win.document.documentElement.scrollHeight, win.document.body.scrollHeight);

const ok = after.every((p) => p === 'relative' || p === 'static');
console.log(ok ? 'PASS: sections unstacked for scroll' : 'FAIL: sections still absolute/fixed');
process.exit(ok ? 0 : 1);
