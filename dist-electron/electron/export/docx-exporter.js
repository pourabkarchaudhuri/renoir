import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle, ImageRun, PageBreak, ExternalHyperlink, AlignmentType, } from 'docx';
import { DEFAULT_EXPORT_THEME, headingSize } from '../../shared/export/theme.js';
function headingLevel(level) {
    const map = {
        1: HeadingLevel.HEADING_1,
        2: HeadingLevel.HEADING_2,
        3: HeadingLevel.HEADING_3,
        4: HeadingLevel.HEADING_4,
        5: HeadingLevel.HEADING_5,
        6: HeadingLevel.HEADING_6,
    };
    return map[level];
}
function inlineRuns(inlines, theme = DEFAULT_EXPORT_THEME) {
    const runs = [];
    for (const inline of inlines) {
        if (inline.type === 'link') {
            runs.push(new ExternalHyperlink({
                children: [new TextRun({ text: inline.text, style: 'Hyperlink', font: theme.fonts.body })],
                link: inline.href,
            }));
            continue;
        }
        runs.push(new TextRun({
            text: inline.text,
            bold: inline.bold,
            italics: inline.italic,
            font: inline.code ? theme.fonts.mono : theme.fonts.body,
            size: (inline.code ? theme.sizes.code : theme.sizes.body) * 2,
        }));
    }
    return runs;
}
async function imageParagraph(block, ctx) {
    const out = [];
    if (block.placeholder || !block.src) {
        const label = block.alt?.trim() || 'Image placeholder';
        out.push(new Paragraph({
            children: [new TextRun({ text: `[ ${label} ]`, italics: true, color: '808080' })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 160, after: 160 },
            border: {
                top: { style: BorderStyle.DASHED, size: 6, color: 'BFBFBF', space: 8 },
                bottom: { style: BorderStyle.DASHED, size: 6, color: 'BFBFBF', space: 8 },
                left: { style: BorderStyle.DASHED, size: 6, color: 'BFBFBF', space: 8 },
                right: { style: BorderStyle.DASHED, size: 6, color: 'BFBFBF', space: 8 },
            },
        }));
        return out;
    }
    const fetch = ctx.assets?.fetchImage;
    if (fetch) {
        const img = await fetch(block.src);
        if (img) {
            const type = img[0] === 0xff && img[1] === 0xd8 ? 'jpg' : 'png';
            out.push(new Paragraph({
                children: [
                    new ImageRun({
                        data: img,
                        transformation: { width: block.widthPx ?? 400, height: Math.round((block.widthPx ?? 400) * 0.6) },
                        type,
                    }),
                ],
            }));
        }
        else {
            out.push(new Paragraph({
                children: [new TextRun({ text: `[Image: ${block.alt?.trim() || 'unavailable'}]`, italics: true, color: '808080' })],
                alignment: AlignmentType.CENTER,
            }));
        }
    }
    if (block.caption) {
        out.push(new Paragraph({
            children: [new TextRun({ text: block.caption, italics: true, size: 20 })],
            alignment: AlignmentType.CENTER,
        }));
    }
    return out;
}
async function blockToDocx(block, ctx) {
    const theme = ctx.theme;
    switch (block.type) {
        case 'heading':
            return [new Paragraph({
                    text: block.text,
                    heading: headingLevel(block.level),
                    spacing: { before: 240, after: 120 },
                })];
        case 'paragraph':
            return [new Paragraph({ children: inlineRuns(block.inlines, theme), spacing: { after: 120 } })];
        case 'bulletList':
            return block.items.flatMap((item) => [
                new Paragraph({
                    children: inlineRuns(item.inlines, theme),
                    bullet: { level: 0 },
                    spacing: { after: 60 },
                }),
            ]);
        case 'orderedList':
            return block.items.map((item, i) => new Paragraph({
                children: [
                    new TextRun({ text: `${i + 1}. ` }),
                    ...inlineRuns(item.inlines, theme),
                ],
                spacing: { after: 60 },
            }));
        case 'checklist':
            return block.items.map((item) => new Paragraph({
                children: [new TextRun({ text: `${item.checked ? '☑' : '☐'} ${item.text}` })],
                spacing: { after: 60 },
            }));
        case 'table': {
            const headers = block.headers ?? [];
            const rows = [];
            if (headers.length) {
                rows.push(new TableRow({
                    children: headers.map((h) => new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })],
                        shading: { fill: 'F0F0F0' },
                    })),
                }));
            }
            for (const row of block.rows) {
                rows.push(new TableRow({
                    children: row.map((c) => new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: c })] })],
                    })),
                }));
            }
            return [new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    borders: {
                        top: { style: BorderStyle.SINGLE, size: 1 },
                        bottom: { style: BorderStyle.SINGLE, size: 1 },
                        left: { style: BorderStyle.SINGLE, size: 1 },
                        right: { style: BorderStyle.SINGLE, size: 1 },
                        insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
                        insideVertical: { style: BorderStyle.SINGLE, size: 1 },
                    },
                    rows,
                })];
        }
        case 'code':
            return [new Paragraph({
                    children: [new TextRun({
                            text: block.code,
                            font: theme.fonts.mono,
                            size: theme.sizes.code * 2,
                        })],
                    spacing: { before: 120, after: 120 },
                    shading: { fill: 'F5F5F5' },
                })];
        case 'blockquote':
            return [new Paragraph({
                    children: inlineRuns(block.inlines, theme),
                    indent: { left: 720 },
                    spacing: { before: 120, after: 120 },
                })];
        case 'image':
            return imageParagraph(block, ctx);
        case 'pageBreak':
            return [new Paragraph({ children: [new PageBreak()] })];
        case 'horizontalRule':
            return [new Paragraph({
                    children: [new TextRun({ text: '―'.repeat(40) })],
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 240, after: 240 },
                })];
        default:
            return [];
    }
}
function metaParagraph(label, value) {
    return new Paragraph({
        children: [
            new TextRun({ text: `${label}: `, bold: true }),
            new TextRun({ text: value }),
        ],
        spacing: { after: 80 },
    });
}
export async function documentToDocxBuffer(doc, ctx) {
    const theme = ctx.theme;
    const children = [];
    children.push(new Paragraph({
        text: doc.title,
        heading: HeadingLevel.TITLE,
        spacing: { after: 120 },
    }));
    if (doc.subtitle) {
        children.push(new Paragraph({
            children: [new TextRun({ text: doc.subtitle, italics: true, size: headingSize(theme, 3) * 2 })],
            spacing: { after: 120 },
        }));
    }
    children.push(metaParagraph('Created', new Date(doc.createdAt).toLocaleDateString()));
    children.push(metaParagraph('Modified', new Date(doc.modifiedAt).toLocaleDateString()));
    if (doc.skillName)
        children.push(metaParagraph('Skill', doc.skillName));
    if (doc.inputs?.length) {
        children.push(new Paragraph({ text: 'Brief', heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 120 } }));
        children.push(new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: doc.inputs.map((i) => new TableRow({
                children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: i.label, bold: true })] })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: i.value })] })] }),
                ],
            })),
        }));
    }
    for (const block of doc.blocks) {
        children.push(...await blockToDocx(block, ctx));
    }
    const document = new Document({
        styles: {
            default: {
                document: {
                    run: { font: theme.fonts.body, size: theme.sizes.body * 2 },
                },
            },
        },
        sections: [{ children }],
    });
    const buf = await Packer.toBuffer(document);
    return new Uint8Array(buf);
}
export const docxExporter = {
    format: 'docx',
    async export(doc, ctx) {
        return documentToDocxBuffer(doc, ctx);
    },
};
