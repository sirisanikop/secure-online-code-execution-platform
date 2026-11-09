// Shared helpers for building the project documents with docx-js
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun, Footer,
  AlignmentType, LevelFormat, HeadingLevel, BorderStyle, WidthType, ShadingType, PageNumber, PageBreak,
} = require("docx");

const DIAG = path.join(__dirname, "..", "diagrams");
const PAGE_W = 11906, PAGE_H = 16838, MARGIN = 1080;
const CONTENT_W = PAGE_W - 2 * MARGIN;

// "**bold** normal" -> TextRuns
function runs(text, opts = {}) {
  const out = [];
  String(text).split("**").forEach((seg, i) => {
    if (seg === "") return;
    out.push(new TextRun({ text: seg, bold: i % 2 === 1 || opts.bold, italics: opts.italics, size: opts.size, color: opts.color, font: opts.font }));
  });
  return out;
}

const P = (text, o = {}) => new Paragraph({ children: runs(text, o), spacing: { after: o.after ?? 120, before: o.before ?? 0 }, alignment: o.align, keepNext: o.keepNext });
const H1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(t)], spacing: { before: 320, after: 140 } });
const H2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)], spacing: { before: 240, after: 100 } });
const H3 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(t)], spacing: { before: 180, after: 80 } });
const SUB = (t) => new Paragraph({ children: [new TextRun({ text: t, bold: true, size: 22, color: "1F3A5F" })], spacing: { before: 160, after: 60 }, keepNext: true });
const B = (text, level = 0) => new Paragraph({ numbering: { reference: "bullets", level }, children: runs(text), spacing: { after: 60 } });
const N = (text) => new Paragraph({ numbering: { reference: "numbers", level: 0 }, children: runs(text), spacing: { after: 60 } });
const PB = () => new Paragraph({ children: [new PageBreak()] });
const CODE = (text) => text.split("\n").map((l) => new Paragraph({
  children: [new TextRun({ text: l === "" ? " " : l, font: "Consolas", size: 17 })],
  spacing: { after: 0 }, shading: { type: ShadingType.CLEAR, fill: "F3F4F6", color: "auto" }, indent: { left: 120 },
}));

const bd = { style: BorderStyle.SINGLE, size: 4, color: "9AA5B1" };
const borders = { top: bd, bottom: bd, left: bd, right: bd };

function table(headers, rows, widths, o = {}) {
  const total = widths.reduce((a, b) => a + b, 0);
  const fs_ = o.size || 17;
  const cell = (t, w, head) => new TableCell({
    width: { size: w, type: WidthType.DXA }, borders,
    shading: head ? { type: ShadingType.CLEAR, fill: "D9E2F3", color: "auto" } : undefined,
    margins: { top: 50, bottom: 50, left: 80, right: 80 },
    children: String(t ?? "").split("\n").map((line) => new Paragraph({ children: runs(line, { bold: head, size: fs_ }), spacing: { after: 0 } })),
  });
  const trs = [];
  if (headers) trs.push(new TableRow({ tableHeader: true, cantSplit: true, children: headers.map((h, i) => cell(h, widths[i], true)) }));
  rows.forEach((r) => trs.push(new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, widths[i], false)) })));
  return new Table({ width: { size: total, type: WidthType.DXA }, columnWidths: widths, rows: trs });
}
const gap = () => new Paragraph({ children: [], spacing: { after: 120 } });

function img(file, maxW = 640, maxH = 860, caption) {
  const buf = fs.readFileSync(path.join(DIAG, file));
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  let sw = maxW, sh = (h * maxW) / w;
  if (sh > maxH) { sh = maxH; sw = (w * maxH) / h; }
  const out = [new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { before: 80, after: 60 }, keepNext: !!caption,
    children: [new ImageRun({ type: "png", data: buf, transformation: { width: Math.round(sw), height: Math.round(sh) },
      altText: { title: caption || file, description: caption || file, name: file } })],
  })];
  if (caption) out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [new TextRun({ text: caption, italics: true, size: 18, color: "555555" })] }));
  return out;
}

function makeDoc(children, footerText) {
  return new Document({
    creator: "SE Mini Project Team",
    styles: {
      default: { document: { run: { font: "Calibri", size: 21 } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 32, bold: true, color: "1F3A5F", font: "Calibri" }, paragraph: { spacing: { before: 320, after: 140 }, outlineLevel: 0 } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 26, bold: true, color: "2E5C8A", font: "Calibri" }, paragraph: { spacing: { before: 240, after: 100 }, outlineLevel: 1 } },
        { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 23, bold: true, color: "2E5C8A", font: "Calibri" }, paragraph: { spacing: { before: 180, after: 80 }, outlineLevel: 2 } },
        { id: "Title", name: "Title", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 44, bold: true, color: "1F3A5F", font: "Calibri" }, paragraph: { spacing: { before: 0, after: 200 } } },
      ],
    },
    numbering: { config: [
      { reference: "bullets", levels: [
        { level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } },
        { level: 1, format: LevelFormat.BULLET, text: "–", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1000, hanging: 270 } } } },
      ] },
      { reference: "numbers", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 300 } } } }] },
    ] },
    sections: [{
      properties: { page: { size: { width: PAGE_W, height: PAGE_H }, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } } },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
        new TextRun({ text: footerText + "  |  Page ", size: 16, color: "666666" }),
        new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "666666" }),
      ] })] }) },
      children,
    }],
  });
}

async function save(doc, file) {
  const buf = await Packer.toBuffer(doc);
  fs.writeFileSync(file, buf);
  console.log("wrote", file, buf.length, "bytes");
}

module.exports = { P, H1, H2, H3, SUB, B, N, PB, CODE, table, gap, img, makeDoc, save, runs, CONTENT_W, Paragraph, TextRun };
