// DOCX report generator — uses Assessment.docx as style/logo template
// Preserves: header logo, all paragraph/table styles, page layout, footer
// Strategy: clone the template ZIP, replace word/document.xml with generated content

import { mkdirSync, writeFileSync } from 'fs';
import { basename, dirname, isAbsolute, join, resolve } from 'path';
import AdmZip from 'adm-zip';

// Assessment.docx lives next to src/ in the project root
const TEMPLATE_PATH = join(__dirname, '../../Assessment.docx');

// ─── XML helpers ──────────────────────────────────────────────────────────────

function x(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ─── Inline formatting: **bold**, `code`, *italic* ────────────────────────────

interface Run { text: string; bold?: boolean; italic?: boolean; code?: boolean }

function parseInline(line: string): Run[] {
  const runs: Run[] = [];
  // tokenise by **bold**, *italic*, `code`
  const re = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`|([^*`]+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    if (m[2] !== undefined)      runs.push({ text: m[2], bold: true });
    else if (m[3] !== undefined) runs.push({ text: m[3], italic: true });
    else if (m[4] !== undefined) runs.push({ text: m[4], code: true });
    else if (m[5] !== undefined) runs.push({ text: m[5] });
  }
  return runs.length ? runs : [{ text: line }];
}

function runsToXml(runs: Run[]): string {
  return runs.map(r => {
    let rpr = '';
    if (r.bold)   rpr += '<w:b/><w:bCs/>';
    if (r.italic) rpr += '<w:i/><w:iCs/>';
    if (r.code) {
      rpr += '<w:rFonts w:ascii="Courier New" w:hAnsi="Courier New" w:cs="Courier New"/>';
      rpr += '<w:sz w:val="18"/><w:szCs w:val="18"/>';
      rpr += '<w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/>';
    }
    const rprXml = rpr ? `<w:rPr>${rpr}</w:rPr>` : '';
    // preserve leading/trailing spaces with xml:space="preserve"
    const needsPreserve = r.text !== r.text.trim() || r.text.includes('  ');
    const spaceAttr = needsPreserve ? ' xml:space="preserve"' : '';
    return `<w:r>${rprXml}<w:t${spaceAttr}>${x(r.text)}</w:t></w:r>`;
  }).join('');
}

// ─── Paragraph builders ───────────────────────────────────────────────────────

function para(style: string, content: string, extraPpr = ''): string {
  return `<w:p><w:pPr><w:pStyle w:val="${style}"/>${extraPpr}</w:pPr>${content}</w:p>`;
}

function textPara(style: string, line: string): string {
  return para(style, runsToXml(parseInline(line)));
}

function emptyPara(): string {
  return '<w:p/>';
}

// ─── Table builder ────────────────────────────────────────────────────────────

function buildTable(rows: string[][]): string {
  const tblPr = `<w:tblPr>
    <w:tblStyle w:val="TableGrid"/>
    <w:tblW w:w="9360" w:type="dxa"/>
    <w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/>
  </w:tblPr>`;

  const xmlRows = rows.map((cells, rowIdx) => {
    const isHeader = rowIdx === 0;
    const xmlCells = cells.map(cell => {
      const rpr = isHeader ? '<w:rPr><w:b/><w:bCs/><w:color w:val="FFFFFF"/></w:rPr>' : '';
      const shd  = isHeader
        ? '<w:shd w:val="clear" w:color="auto" w:fill="2E74B5"/>'
        : '';
      const tcPr = `<w:tcPr>${shd}<w:tcMar><w:top w:w="60" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tcMar></w:tcPr>`;
      const runs = parseInline(cell.trim());
      const runsXml = runs.map(r => {
        const combinedRpr = `${rpr}`;
        let innerRpr = isHeader ? '<w:b/><w:bCs/><w:color w:val="FFFFFF"/>' : '';
        if (r.bold)   innerRpr += '<w:b/><w:bCs/>';
        if (r.italic) innerRpr += '<w:i/><w:iCs/>';
        if (r.code)   innerRpr += '<w:rFonts w:ascii="Courier New" w:hAnsi="Courier New" w:cs="Courier New"/><w:sz w:val="18"/>';
        const rprFull = innerRpr ? `<w:rPr>${innerRpr}</w:rPr>` : '';
        const needsPreserve = r.text !== r.text.trim() || r.text.includes('  ');
        return `<w:r>${rprFull}<w:t${needsPreserve ? ' xml:space="preserve"' : ''}>${x(r.text)}</w:t></w:r>`;
      }).join('');
      return `<w:tc>${tcPr}<w:p><w:pPr><w:jc w:val="left"/><w:rPr>${isHeader ? '<w:b/><w:bCs/><w:color w:val="FFFFFF"/>' : ''}</w:rPr></w:pPr>${runsXml}</w:p></w:tc>`;
    }).join('');
    return `<w:tr>${xmlCells}</w:tr>`;
  }).join('');

  return `<w:tbl>${tblPr}<w:tblGrid/>${xmlRows}</w:tbl>`;
}

// ─── Markdown → OOXML body ────────────────────────────────────────────────────

function mdToBody(md: string): string {
  const lines = md.split('\n');
  const out: string[] = [];
  let inCode = false;
  let codeLines: string[] = [];
  let inTable = false;
  let tableRows: string[][] = [];
  let listNumId = 1; // references numbering.xml list definition

  const flushTable = () => {
    if (tableRows.length > 0) {
      out.push(buildTable(tableRows));
      tableRows = [];
    }
    inTable = false;
  };

  const flushCode = () => {
    if (codeLines.length > 0) {
      // Code block: each line as a Normal paragraph in Courier New with grey background
      for (const cl of codeLines) {
        const rpr = '<w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New" w:cs="Courier New"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>';
        const needsPreserve = cl !== cl.trim() || cl === '' || cl.includes('  ');
        const spaceAttr = needsPreserve ? ' xml:space="preserve"' : '';
        const tEl = cl === ''
          ? '<w:t xml:space="preserve"> </w:t>'
          : `<w:t${spaceAttr}>${x(cl)}</w:t>`;
        const pshd = '<w:pBdr><w:top w:val="single" w:sz="2" w:space="1" w:color="D0D0D0"/><w:left w:val="single" w:sz="2" w:space="4" w:color="D0D0D0"/><w:bottom w:val="single" w:sz="2" w:space="1" w:color="D0D0D0"/><w:right w:val="single" w:sz="2" w:space="4" w:color="D0D0D0"/></w:pBdr>';
        const pshd2 = '<w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/>';
        out.push(`<w:p><w:pPr><w:pStyle w:val="Normal"/>${pshd}${pshd2}<w:ind w:left="240" w:right="240"/></w:pPr><w:r>${rpr}${tEl}</w:r></w:p>`);
      }
      codeLines = [];
    }
    inCode = false;
  };

  for (const raw of lines) {
    const line = raw;

    // Code fence
    if (line.startsWith('```')) {
      if (inTable) flushTable();
      if (inCode) {
        flushCode();
      } else {
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeLines.push(line);
      continue;
    }

    // Table row
    if (line.startsWith('|')) {
      // skip separator rows like |---|---|
      if (/^\|[\s\-:|]+\|$/.test(line)) continue;
      const cells = line.split('|').filter((_, i, arr) => i > 0 && i < arr.length - 1).map(c => c.trim());
      if (!inTable) inTable = true;
      tableRows.push(cells);
      continue;
    }
    if (inTable) {
      flushTable();
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      out.push(emptyPara());
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      out.push(emptyPara());
      continue;
    }

    // Headings
    if (line.startsWith('# '))   { out.push(textPara('Heading1', line.slice(2))); continue; }
    if (line.startsWith('## '))  { out.push(textPara('Heading2', line.slice(3))); continue; }
    if (line.startsWith('### ')) { out.push(textPara('Heading3', line.slice(4))); continue; }
    if (line.startsWith('#### ')) { out.push(textPara('Heading4', line.slice(5))); continue; }

    // Bullet list
    if (line.startsWith('- ') || line.startsWith('* ')) {
      const numPr = `<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${listNumId}"/></w:numPr>`;
      out.push(para('ListParagraph', runsToXml(parseInline(line.slice(2))), numPr));
      continue;
    }

    // Numbered list
    if (/^\d+\. /.test(line)) {
      const text = line.replace(/^\d+\. /, '');
      const numPr = `<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${listNumId + 1}"/></w:numPr>`;
      out.push(para('ListParagraph', runsToXml(parseInline(text)), numPr));
      continue;
    }

    // Normal paragraph
    out.push(textPara('Normal', line));
  }

  if (inCode) flushCode();
  if (inTable) flushTable();

  return out.join('\n');
}

// ─── Full document.xml ────────────────────────────────────────────────────────

// Minimal but complete namespace set for Word 2016+ compatibility
const NS = [
  'xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"',
  'xmlns:cx="http://schemas.microsoft.com/office/drawing/2014/chartex"',
  'xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"',
  'xmlns:o="urn:schemas-microsoft-com:office:office"',
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"',
  'xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"',
  'xmlns:v="urn:schemas-microsoft-com:vml"',
  'xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing"',
  'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"',
  'xmlns:w10="urn:schemas-microsoft-com:office:word"',
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"',
  'xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"',
  'xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml"',
  'xmlns:w16="http://schemas.microsoft.com/office/word/2018/wordml"',
  'xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"',
  'xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"',
  'mc:Ignorable="w14 w15 w16 wp14"',
].join(' ');

// sectPr extracted verbatim from the template — preserves page size, margins,
// header/footer references (rId8 = header1, rId9 = footer1)
const SECT_PR = `<w:sectPr>
  <w:headerReference w:type="default" r:id="rId8"/>
  <w:footerReference w:type="default" r:id="rId9"/>
  <w:pgSz w:w="12240" w:h="15840"/>
  <w:pgMar w:top="1440" w:right="1440" w:bottom="270" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
  <w:cols w:space="720"/>
  <w:docGrid w:linePitch="360"/>
</w:sectPr>`;

function buildDocumentXml(title: string, content: string, database_name?: string, server?: string): string {
  const date = new Date().toISOString().slice(0, 10);

  const metaParts: string[] = [`Generated: ${date}`];
  if (server)        metaParts.push(`Server: ${server}`);
  if (database_name) metaParts.push(`Database: ${database_name}`);
  metaParts.push('Radek MySQL MCP v1.0.0');

  const titlePara    = para('Title',    `<w:r><w:t>${x(title)}</w:t></w:r>`);
  const subtitlePara = para('Subtitle', `<w:r><w:t xml:space="preserve">${x(metaParts.join('  ·  '))}</w:t></w:r>`);

  const body = mdToBody(content);

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${NS}>
<w:body>
${titlePara}
${subtitlePara}
${emptyPara()}
${body}
${SECT_PR}
</w:body>
</w:document>`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function generate_docx(
  title: string,
  content: string,
  output_path?: string,
  database_name?: string,
  server?: string
): Promise<Record<string, unknown>> {
  const zip = new AdmZip(TEMPLATE_PATH);

  const docXml = buildDocumentXml(title, content, database_name, server);
  zip.updateFile('word/document.xml', Buffer.from(docXml, 'utf8'));

  const buf = zip.toBuffer();

  if (output_path) {
    const p = resolvePath(output_path);
    try {
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, buf, { mode: 0o644 });
      return { format: 'docx', saved_to: p, size_bytes: buf.length };
    } catch (firstErr) {
      try {
        const tmp = join('/tmp', basename(p));
        writeFileSync(tmp, buf, { mode: 0o644 });
        return { format: 'docx', saved_to: tmp, size_bytes: buf.length, note: `Could not write to ${p} — saved to /tmp instead` };
      } catch {
        return { format: 'docx', docx_base64: buf.toString('base64'), size_bytes: buf.length, save_failed: (firstErr as Error).message, note: 'Could not write to path or /tmp — content returned as base64' };
      }
    }
  }

  return { format: 'docx', docx_base64: buf.toString('base64'), size_bytes: buf.length };
}

function resolvePath(p: string): string {
  return isAbsolute(p) ? p : resolve(process.cwd(), p);
}
