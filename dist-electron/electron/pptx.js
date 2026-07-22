// Minimal Office Open XML PPTX builder. Renders each slide as a 2560×1440 PNG
// (2× capture of the 1280×720 deck viewport) via an offscreen Electron window,
// assembles a slide-per-image .pptx through our zero-dep zipio.
//
// The skeleton below is the bare minimum that PowerPoint, Keynote and
// Google Slides accept — slide master + single layout + theme + presentation
// + per-slide XML. All XML is authored fresh.
import path from 'node:path';
import fs from 'node:fs';
import { writeZipToFile } from './zipio.js';
import { ensureProjectDir } from './workspace.js';
import { capturePresentSlides, EXPORT_CAPTURE_SCALE } from './export/artifact-capture.js';
import { wrapForExportCapture } from '../shared/preview-nav-bridge.js';
const SLIDE_W_EMU = 12_192_000; // 16:9 widescreen
const SLIDE_H_EMU = 6_858_000;
function xmlEscape(s) {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}
async function captureSlides(html, slideCount) {
    const wrapped = html.includes('id="__renoir_mode_style"') || html.includes('renoir:nav-state')
        ? html
        : wrapForExportCapture(html);
    return capturePresentSlides({
        html: wrapped,
        slideCount,
        scaleFactor: EXPORT_CAPTURE_SCALE,
    });
}
/** Build a .pptx file buffer from rasterized slide PNGs. */
export function buildPptxZipBuffer(images) {
    if (!images.length)
        throw new Error('no slides to render');
    return packZipEntries(buildPptxZipEntries(images));
}
function packZipEntries(entries) {
    const dir = path.join(ensureProjectDir('_pptx_tmp'), `pack-${Date.now()}.pptx`);
    try {
        writeZipToFile(dir, entries);
        return new Uint8Array(fs.readFileSync(dir));
    }
    finally {
        try {
            fs.unlinkSync(dir);
        }
        catch { /* swallow */ }
    }
}
export function buildPptxZipEntries(images) {
    const entries = [];
    const text = (s) => Buffer.from(s, 'utf8');
    entries.push({ name: '[Content_Types].xml', data: text(contentTypesXml(images.length)) });
    entries.push({ name: '_rels/.rels', data: text(ROOT_RELS) });
    entries.push({ name: 'ppt/presentation.xml', data: text(presentationXml(images.length)) });
    entries.push({ name: 'ppt/_rels/presentation.xml.rels', data: text(presentationRelsXml(images.length)) });
    entries.push({ name: 'ppt/theme/theme1.xml', data: text(THEME_XML) });
    entries.push({ name: 'ppt/slideMasters/slideMaster1.xml', data: text(SLIDE_MASTER_XML) });
    entries.push({ name: 'ppt/slideMasters/_rels/slideMaster1.xml.rels', data: text(SLIDE_MASTER_RELS) });
    entries.push({ name: 'ppt/slideLayouts/slideLayout1.xml', data: text(SLIDE_LAYOUT_XML) });
    entries.push({ name: 'ppt/slideLayouts/_rels/slideLayout1.xml.rels', data: text(SLIDE_LAYOUT_RELS) });
    for (let i = 0; i < images.length; i++) {
        entries.push({ name: `ppt/slides/slide${i + 1}.xml`, data: text(slideXml(i)) });
        entries.push({ name: `ppt/slides/_rels/slide${i + 1}.xml.rels`, data: text(slideRelsXml(i)) });
        entries.push({ name: `ppt/media/image${i + 1}.png`, data: images[i] });
    }
    return entries;
}
function contentTypesXml(slideCount) {
    const overrides = [];
    for (let i = 1; i <= slideCount; i++) {
        overrides.push(`<Override PartName="/ppt/slides/slide${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`);
    }
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
  ${overrides.join('\n  ')}
</Types>`;
}
const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`;
function presentationXml(slideCount) {
    const ids = [];
    for (let i = 0; i < slideCount; i++) {
        ids.push(`<p:sldId id="${256 + i}" r:id="rId${10 + i}"/>`);
    }
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
  <p:sldIdLst>${ids.join('')}</p:sldIdLst>
  <p:sldSz cx="${SLIDE_W_EMU}" cy="${SLIDE_H_EMU}" type="screen16x9"/>
  <p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>`;
}
function presentationRelsXml(slideCount) {
    const slideRels = [];
    for (let i = 0; i < slideCount; i++) {
        slideRels.push(`<Relationship Id="rId${10 + i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`);
    }
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>
  ${slideRels.join('\n  ')}
</Relationships>`;
}
const THEME_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Renoir">
  <a:themeElements>
    <a:clrScheme name="Renoir">
      <a:dk1><a:srgbClr val="0C0E14"/></a:dk1>
      <a:lt1><a:srgbClr val="F5F6F8"/></a:lt1>
      <a:dk2><a:srgbClr val="262B36"/></a:dk2>
      <a:lt2><a:srgbClr val="EAECEF"/></a:lt2>
      <a:accent1><a:srgbClr val="F97316"/></a:accent1>
      <a:accent2><a:srgbClr val="EA580C"/></a:accent2>
      <a:accent3><a:srgbClr val="C2410C"/></a:accent3>
      <a:accent4><a:srgbClr val="9A3412"/></a:accent4>
      <a:accent5><a:srgbClr val="7C2D12"/></a:accent5>
      <a:accent6><a:srgbClr val="FED7AA"/></a:accent6>
      <a:hlink><a:srgbClr val="F97316"/></a:hlink>
      <a:folHlink><a:srgbClr val="C2410C"/></a:folHlink>
    </a:clrScheme>
    <a:fontScheme name="Renoir">
      <a:majorFont><a:latin typeface="Inter"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>
      <a:minorFont><a:latin typeface="Inter"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont>
    </a:fontScheme>
    <a:fmtScheme name="Renoir">
      <a:fillStyleLst>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
      </a:fillStyleLst>
      <a:lnStyleLst>
        <a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>
        <a:ln w="25400"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>
        <a:ln w="38100"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>
      </a:lnStyleLst>
      <a:effectStyleLst>
        <a:effectStyle><a:effectLst/></a:effectStyle>
        <a:effectStyle><a:effectLst/></a:effectStyle>
        <a:effectStyle><a:effectLst/></a:effectStyle>
      </a:effectStyleLst>
      <a:bgFillStyleLst>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
      </a:bgFillStyleLst>
    </a:fmtScheme>
  </a:themeElements>
</a:theme>`;
const SLIDE_MASTER_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:bg><p:bgPr><a:solidFill><a:srgbClr val="F5F6F8"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
    </p:spTree>
  </p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
  <p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
</p:sldMaster>`;
const SLIDE_MASTER_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>`;
const SLIDE_LAYOUT_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
  type="blank" preserve="1">
  <p:cSld name="Blank">
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>`;
const SLIDE_LAYOUT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`;
function slideXml(index) {
    const id = 2 + index;
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
      <p:pic>
        <p:nvPicPr>
          <p:cNvPr id="${id}" name="${xmlEscape(`slide-image-${index + 1}`)}"/>
          <p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr>
          <p:nvPr/>
        </p:nvPicPr>
        <p:blipFill>
          <a:blip r:embed="rId1"/>
          <a:stretch><a:fillRect/></a:stretch>
        </p:blipFill>
        <p:spPr>
          <a:xfrm>
            <a:off x="0" y="0"/>
            <a:ext cx="${SLIDE_W_EMU}" cy="${SLIDE_H_EMU}"/>
          </a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
        </p:spPr>
      </p:pic>
    </p:spTree>
  </p:cSld>
</p:sld>`;
}
function slideRelsXml(index) {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image${index + 1}.png"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`;
}
/* ─── builder ─────────────────────────────────────────────────────────── */
export async function exportArtifactToPptx(req) {
    let images;
    try {
        images = await captureSlides(req.html);
    }
    catch (err) {
        return { ok: false, error: `slide capture failed: ${err?.message || err}` };
    }
    if (!images.length)
        return { ok: false, error: 'no slides to render' };
    const dir = ensureProjectDir(req.projectId);
    const filename = (req.filename || `artifact-${Date.now()}.pptx`).replace(/[^a-z0-9._-]/gi, '_');
    const savedPath = path.join(dir, filename);
    try {
        writeZipToFile(savedPath, buildPptxZipEntries(images));
    }
    catch (err) {
        return { ok: false, error: err?.message || String(err) };
    }
    return { ok: true, savedPath };
}
