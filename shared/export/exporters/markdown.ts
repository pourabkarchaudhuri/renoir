import type { ExportDocument, ExportBlock, ExportInline, ExportInput } from '../types.js';
import type { DocumentExporter, ExportContext } from '../exporter.js';
import { bytesToDataUrl } from '../image-bytes.js';

function escMd(text: string): string {
  return text.replace(/([\\`*_{}[\]()#+\-.!|>])/g, '\\$1');
}

function inlineToMd(inline: ExportInline): string {
  if (inline.type === 'link') {
    const label = inline.text.replace(/]/g, '\\]');
    return `[${label}](${inline.href})`;
  }
  let t = inline.text;
  if (inline.code) t = `\`${t.replace(/`/g, '\\`')}\``;
  if (inline.bold) t = `**${t}**`;
  if (inline.italic) t = `*${t}*`;
  return t;
}

function inlinesToMd(inlines: ExportInline[]): string {
  return inlines.map(inlineToMd).join('');
}

function yamlFrontmatter(doc: ExportDocument): string {
  const lines: string[] = ['---'];
  lines.push(`title: "${doc.title.replace(/"/g, '\\"')}"`);
  if (doc.subtitle) lines.push(`subtitle: "${doc.subtitle.replace(/"/g, '\\"')}"`);
  if (doc.skillName) lines.push(`skill: "${doc.skillName.replace(/"/g, '\\"')}"`);
  if (doc.skillId) lines.push(`skillId: "${doc.skillId}"`);
  lines.push(`created: "${doc.createdAt}"`);
  lines.push(`modified: "${doc.modifiedAt}"`);
  if (doc.metadata) {
    for (const [k, v] of Object.entries(doc.metadata)) {
      lines.push(`${k}: "${String(v).replace(/"/g, '\\"')}"`);
    }
  }
  lines.push('---');
  return lines.join('\n');
}

function inputsToMd(inputs: ExportInput[]): string {
  if (!inputs.length) return '';
  const rows = inputs.map((i) => `| ${i.label} | ${i.value.replace(/\|/g, '\\|').replace(/\n/g, ' ')} |`);
  return `## Brief\n\n| Field | Value |\n| --- | --- |\n${rows.join('\n')}\n\n`;
}

function tableToMd(block: Extract<ExportBlock, { type: 'table' }>): string {
  const headers = block.headers ?? (block.rows[0] ? block.rows[0].map((_, i) => `Column ${i + 1}`) : []);
  const rows = block.headers ? block.rows : block.rows.slice(1);
  const esc = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
  const headerLine = `| ${headers.map(esc).join(' | ')} |`;
  const sep = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map((r) => `| ${r.map(esc).join(' | ')} |`).join('\n');
  return `${headerLine}\n${sep}\n${body}\n\n`;
}

async function resolveImageSrc(src: string, ctx?: ExportContext): Promise<string> {
  if (!src || src.startsWith('data:') || /^https?:\/\//i.test(src)) return src;
  const fetch = ctx?.assets?.fetchImage;
  if (!fetch) return src;
  const bytes = await fetch(src);
  if (!bytes?.length) return src;
  return bytesToDataUrl(bytes);
}

async function blockToMd(block: ExportBlock, ctx?: ExportContext, depth = 0): Promise<string> {
  switch (block.type) {
    case 'heading':
      return `${'#'.repeat(block.level)} ${block.text}\n\n`;
    case 'paragraph':
      return `${inlinesToMd(block.inlines)}\n\n`;
    case 'bulletList': {
      const lines = await Promise.all(block.items.map(async (item) => {
        const line = `- ${inlinesToMd(item.inlines)}`;
        if (!item.nested?.length) return line;
        const nested = (await Promise.all(item.nested.map((b) => blockToMd(b, ctx, depth + 1)))).join('');
        return `${line}\n${nested.replace(/^/gm, '  ')}`;
      }));
      return `${lines.join('\n')}\n\n`;
    }
    case 'orderedList': {
      const lines = await Promise.all(block.items.map(async (item, i) => {
        const line = `${i + 1}. ${inlinesToMd(item.inlines)}`;
        if (!item.nested?.length) return line;
        const nested = (await Promise.all(item.nested.map((b) => blockToMd(b, ctx, depth + 1)))).join('');
        return `${line}\n${nested.replace(/^/gm, '   ')}`;
      }));
      return `${lines.join('\n')}\n\n`;
    }
    case 'checklist':
      return block.items.map((item) => `- [${item.checked ? 'x' : ' '}] ${item.text}`).join('\n') + '\n\n';
    case 'table':
      return tableToMd(block);
    case 'code':
      return `\`\`\`${block.language ?? ''}\n${block.code}\n\`\`\`\n\n`;
    case 'blockquote':
      return `> ${inlinesToMd(block.inlines).replace(/\n/g, '\n> ')}\n\n`;
    case 'image': {
      if (block.placeholder || !block.src) {
        const label = block.alt?.trim() || 'Image placeholder';
        return `> *[Image placeholder: ${label}]*\n\n`;
      }
      const src = await resolveImageSrc(block.src, ctx);
      const alt = block.alt ?? '';
      const cap = block.caption ? `\n\n*${block.caption}*` : '';
      return `![${alt}](${src})${cap}\n\n`;
    }
    case 'pageBreak':
      return '\n<!-- pagebreak -->\n\n';
    case 'horizontalRule':
      return '---\n\n';
    default:
      return '';
  }
}

export async function documentToMarkdown(doc: ExportDocument, ctx?: ExportContext): Promise<string> {
  const parts: string[] = [yamlFrontmatter(doc), ''];
  if (doc.subtitle) parts.push(`*${doc.subtitle}*\n\n`);
  if (doc.description) parts.push(`${doc.description}\n\n`);
  if (doc.inputs?.length) parts.push(inputsToMd(doc.inputs));
  for (const block of doc.blocks) parts.push(await blockToMd(block, ctx));
  return parts.join('').trimEnd() + '\n';
}

export const markdownExporter: DocumentExporter = {
  format: 'markdown',
  async export(doc, ctx) {
    return documentToMarkdown(doc, ctx);
  },
};
