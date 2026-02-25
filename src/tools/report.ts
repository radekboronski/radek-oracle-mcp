import { mkdirSync, writeFileSync } from 'fs';
import { existsSync } from 'fs';
import { basename, dirname, isAbsolute, join, resolve } from 'path';
import { BANNER_LINES } from '../banner';
import { generate_docx } from './docx';

// ─── Banner ───────────────────────────────────────────────────────────────────

const BANNER_TEXT = BANNER_LINES.join('\n');

// ─── HTML builder ─────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inlineFormat(s: string): string {
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/`(.+?)`/g, '<code>$1</code>');
  return s;
}

function mdToHtml(md: string): string {
  const lines = md.split('\n');
  const out: string[] = [];
  let inTable = false;
  let inCode = false;
  let inList = false;

  for (const line of lines) {
    if (line.startsWith('```')) {
      if (inCode) { out.push('</code></pre>'); inCode = false; }
      else {
        if (inList) { out.push('</ul>'); inList = false; }
        if (inTable) { out.push('</table>'); inTable = false; }
        out.push('<pre><code>'); inCode = true;
      }
      continue;
    }
    if (inCode) { out.push(escapeHtml(line)); continue; }
    if (inList && !line.startsWith('- ') && line.trim() !== '') { out.push('</ul>'); inList = false; }
    if (line.trim() === '') { if (inTable) { out.push('</table>'); inTable = false; } continue; }

    if (line.startsWith('|')) {
      if (/^\|[\s\-:|]+\|$/.test(line)) continue;
      const cells = line.split('|').filter(c => c.trim() !== '').map(c => c.trim());
      if (!inTable) {
        out.push('<table>');
        out.push('<tr>' + cells.map(c => `<th>${inlineFormat(escapeHtml(c))}</th>`).join('') + '</tr>');
        inTable = true;
      } else {
        out.push('<tr>' + cells.map(c => `<td>${inlineFormat(escapeHtml(c))}</td>`).join('') + '</tr>');
      }
      continue;
    }
    if (inTable) { out.push('</table>'); inTable = false; }

    if (line.startsWith('### ')) { out.push(`<h3>${inlineFormat(escapeHtml(line.slice(4)))}</h3>`); continue; }
    if (line.startsWith('## '))  { out.push(`<h2>${inlineFormat(escapeHtml(line.slice(3)))}</h2>`); continue; }
    if (line.startsWith('# '))   { out.push(`<h1>${inlineFormat(escapeHtml(line.slice(2)))}</h1>`); continue; }
    if (line.startsWith('- ')) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${inlineFormat(escapeHtml(line.slice(2)))}</li>`);
      continue;
    }
    out.push(`<p>${inlineFormat(escapeHtml(line))}</p>`);
  }
  if (inList) out.push('</ul>');
  if (inTable) out.push('</table>');
  if (inCode) out.push('</code></pre>');
  return out.join('\n');
}

function buildHtml(title: string, content: string, database_name?: string, server?: string): string {
  const body = mdToHtml(content);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Radek MySQL MCP — ${escapeHtml(title)}</title>
<style>
  @page { size: A4; margin: 15mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11px; color: #1a1a1a; margin: 0; padding: 20px; background: #ffffff; }
  h1 { font-size: 22px; margin-bottom: 4px; color: #111111; font-weight: 700; letter-spacing: -0.3px; }
  h2 { font-size: 14px; margin-top: 26px; margin-bottom: 6px; border-bottom: 2px solid #222222; padding-bottom: 4px; color: #111111; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; }
  h3 { font-size: 12px; margin-top: 16px; margin-bottom: 4px; color: #333333; font-weight: 600; border-left: 3px solid #888888; padding-left: 8px; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 12px; }
  th { background: #222222; color: #ffffff; text-align: left; padding: 6px 8px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 600; }
  td { padding: 5px 8px; border-bottom: 1px solid #dddddd; font-size: 10.5px; vertical-align: top; }
  tr:nth-child(even) td { background: #f0f0f0; }
  code { font-family: 'SF Mono','Menlo',monospace; font-size: 9.5px; background: #e8e8e8; color: #222222; padding: 1px 5px; border-radius: 3px; }
  pre { background: #222222; color: #e8e8e8; padding: 10px 14px; border-radius: 4px; font-size: 10px; margin: 8px 0; white-space: pre-wrap; border-left: 3px solid #888888; }
  pre code { background: none; padding: 0; color: inherit; }
  ul { margin: 4px 0; padding-left: 18px; }
  li { margin-bottom: 3px; }
  p { margin: 5px 0; }
  .meta { color: #666666; font-size: 10px; margin-bottom: 16px; border-bottom: 1px solid #eeeeee; padding-bottom: 8px; }

  /* ── Banner ── */
  .banner {
    background: #1a1a1a;
    border-radius: 6px;
    margin-bottom: 18px;
    overflow: hidden;
  }
  .banner-ascii {
    display: block;
    background: none;
    color: #cccccc;
    font-family: 'Menlo', 'Courier New', monospace;
    font-size: 7px;
    line-height: 1.45;
    white-space: pre;
    padding: 14px 14px 6px 14px;
    margin: 0;
    letter-spacing: 0;
  }
  .banner-sub {
    color: #888888;
    font-family: 'Helvetica Neue', Arial, sans-serif;
    font-size: 9px;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    padding: 0 16px 4px 16px;
  }
  .banner-copy {
    color: #666666;
    font-family: 'Helvetica Neue', Arial, sans-serif;
    font-size: 8px;
    letter-spacing: 0.5px;
    padding: 0 16px 12px 16px;
  }
</style>
</head>
<body>
<div class="banner">
  <code class="banner-ascii">${escapeHtml(BANNER_TEXT)}</code>
  <div class="banner-sub">Advanced MySQL Diagnostic MCP (Model Context Protocol) · MySQL 5.6 / 5.7 / 8.0</div>
  <div class="banner-copy">&copy; ${new Date().getFullYear()} Radek MySQL MCP. All rights reserved. &nbsp;&middot;&nbsp; ${new Date().toISOString().slice(0, 10)}</div>
</div>
<h1>${escapeHtml(title)}</h1>
<p class="meta">Generated: ${new Date().toISOString().slice(0, 10)} &nbsp;|&nbsp; Radek MySQL MCP v1.0.0${server ? ` &nbsp;|&nbsp; Server: <strong>${escapeHtml(server)}</strong>` : ''}${database_name ? ` &nbsp;|&nbsp; Database: <strong>${escapeHtml(database_name)}</strong>` : ''}</p>
${body}
<p class="meta" style="margin-top:20px;border-top:1px solid #e5e7eb;padding-top:8px;">
  Report generated by Radek MySQL MCP v1.0.0 — Advanced MySQL Diagnostic Server
</p>
</body>
</html>`;
}

// ─── PDF builder (Puppeteer → Chrome) ─────────────────────────────────────────

const CHROME_PATHS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/snap/bin/chromium',
];

async function buildPdf(title: string, content: string, database_name?: string, server?: string): Promise<Buffer> {
  const executablePath = CHROME_PATHS.find(p => existsSync(p));
  if (!executablePath) {
    throw new Error(
      'Chrome/Chromium not found. Install Google Chrome and try again.\n' +
      'Checked: ' + CHROME_PATHS.join(', ')
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const puppeteer = require('puppeteer-core');

  const html = buildHtml(title, content, database_name, server);
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf: Buffer = await page.pdf({
      format: 'A4',
      margin: { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' },
      printBackground: true,
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export function extractConnInfo(dbUrl: string): { database?: string; server?: string } {
  try {
    const url = new URL(dbUrl);
    const database = url.pathname.replace(/^\//, '') || undefined;
    const host = url.hostname || undefined;
    const port = url.port;
    const server = host ? (port && port !== '3306' ? `${host}:${port}` : host) : undefined;
    return { database, server };
  } catch {
    return {};
  }
}

export async function generate_report(
  format: string,
  title: string,
  content: string,
  output_path?: string,
  database_name?: string,
  server?: string
): Promise<Record<string, unknown>> {
  if (format === 'html') {
    const html = buildHtml(title, content, database_name, server);
    if (output_path) {
      const saved = trySave(output_path, Buffer.from(html, 'utf8'));
      if (saved.ok) return { format: 'html', saved_to: saved.path, size_bytes: Buffer.byteLength(html) };
      return { format: 'html', html, save_failed: saved.error, note: saved.note };
    }
    return { format: 'html', html };
  }
  if (format === 'pdf') {
    const buf = await buildPdf(title, content, database_name, server);
    if (output_path) {
      const saved = trySave(output_path, buf);
      if (saved.ok) return { format: 'pdf', saved_to: saved.path, size_bytes: buf.length };
      return { format: 'pdf', pdf_base64: buf.toString('base64'), save_failed: saved.error, note: saved.note };
    }
    return { format: 'pdf', pdf_base64: buf.toString('base64') };
  }
  if (format === 'docx') {
    return generate_docx(title, content, output_path, database_name, server);
  }
  throw new Error(`Unsupported format: ${format}. Use "html", "pdf", or "docx".`);
}

function resolvePath(p: string): string {
  return isAbsolute(p) ? p : resolve(process.cwd(), p);
}

function trySave(output_path: string, buf: Buffer): { ok: true; path: string } | { ok: false; error: string; note: string } {
  const p = resolvePath(output_path);
  try {
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, buf, { mode: 0o644 });
    return { ok: true, path: p };
  } catch (firstErr) {
    // Fallback: try /tmp/<filename>
    try {
      const tmp = join('/tmp', basename(p));
      writeFileSync(tmp, buf, { mode: 0o644 });
      return { ok: true, path: tmp };
    } catch {
      return {
        ok: false,
        error: (firstErr as Error).message,
        note: `Could not write to ${p} or /tmp — content returned inline. Run server as a user with write access to the target directory.`,
      };
    }
  }
}
