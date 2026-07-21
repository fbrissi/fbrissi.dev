import fs from 'node:fs';
import path from 'node:path';

import PDFDocument from 'pdfkit';

const root = process.cwd();
const outputDir = path.join(root, 'public', 'resume');
const resumes = [
  { locale: 'en', fileName: 'filipe-bojikian-rissi-resume-en.pdf', language: 'en-US' },
  { locale: 'pt-BR', fileName: 'filipe-bojikian-rissi-curriculo-pt-br.pdf', language: 'pt-BR' }
];

fs.mkdirSync(outputDir, { recursive: true });

function displayLabel(label, url) {
  if (url.startsWith('mailto:') || url.startsWith('tel:')) return label;
  const strippedUrl = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const strippedLabel = label.replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (strippedLabel === strippedUrl) return label;
  if (label.includes(strippedUrl)) return label;
  return `${label} (${url})`;
}

function plainText(value) {
  return value
    .replace(/\[([^\]]+)]\(([^)]+)\)/g, (_match, label, url) => displayLabel(label, url))
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1');
}

function splitInline(mdText) {
  const segments = [];
  const re = /\[([^\]]+)]\(([^)]+)\)/g;
  let last = 0;
  let match;
  while ((match = re.exec(mdText)) !== null) {
    if (match.index > last) segments.push({ type: 'text', text: mdText.slice(last, match.index) });
    segments.push({ type: 'link', label: match[1], url: match[2] });
    last = re.lastIndex;
  }
  if (last < mdText.length) segments.push({ type: 'text', text: mdText.slice(last) });
  return segments;
}

function parseMarkdown(source) {
  const blocks = [];
  let paragraph = [];
  let list = [];

  function flushParagraph() {
    if (paragraph.length > 0) {
      const value = paragraph.join(' ');
      blocks.push({ type: 'paragraph', text: plainText(value), raw: value, emphasized: /^\*\*.+\*\*$/.test(value) });
    }
    paragraph = [];
  }

  function flushList() {
    if (list.length > 0) blocks.push({ type: 'list', items: list });
    list = [];
  }

  for (const line of source.split(/\r?\n/)) {
    const heading = /^(#{1,4})\s+(.+)$/.exec(line);
    const bullet = /^-\s+(.+)$/.exec(line);
    const pagebreak = /^<!--\s*pagebreak\s*-->\s*$/i.test(line.trim());

    if (pagebreak) {
      flushParagraph();
      flushList();
      blocks.push({ type: 'pagebreak' });
    } else if (heading) {
      flushParagraph();
      flushList();
      const flagMatch = /\s*\{pagebreak\}\s*$/.exec(heading[2]);
      const text = flagMatch ? heading[2].slice(0, flagMatch.index) : heading[2];
      blocks.push({ type: `h${heading[1].length}`, text: plainText(text), pageBreak: Boolean(flagMatch) });
    } else if (bullet) {
      flushParagraph();
      list.push(bullet[1]);
    } else if (line.trim() === '') {
      flushParagraph();
      flushList();
    } else {
      flushList();
      paragraph.push(line.trim());
    }
  }

  flushParagraph();
  flushList();
  return blocks;
}

function ensureSpace(doc, height) {
  if (doc.y + height > doc.page.height - doc.page.margins.bottom) doc.addPage();
}

function forcePageBreak(doc) {
  if (doc.y > doc.page.margins.top + 1) doc.addPage();
}

const colors = {
  accent: '#c2410c',
  body: '#1f2937',
  ink: '#111827',
  muted: '#6b7280',
  rule: '#fed7aa',
  link: '#1d4ed8'
};

const bodyOptions = { align: 'left', lineGap: 1.4 };
const paragraphSpacing = 0.62;
const listItemSpacing = 0.12;
const listSpacing = 0.55;

const headingStyles = {
  h1: { size: 22, font: 'Times-Bold', color: colors.accent, before: 0.4, after: 0.35, upper: false },
  h2: { size: 12.5, font: 'Times-Bold', color: colors.accent, before: 1.1, after: 0.3, upper: true, rule: true },
  h3: { size: 10.8, font: 'Times-Bold', color: colors.ink, before: 0.95, after: 0.22, upper: false },
  h4: { size: 9.8, font: 'Times-Bold', color: colors.ink, before: 0.72, after: 0.16, upper: false }
};

function textHeight(doc, text, font, size, options = bodyOptions) {
  return doc.font(font).fontSize(size).heightOfString(text, options);
}

function renderHeading(doc, level, text, { align = 'left', rule = false } = {}) {
  const style = headingStyles[level];
  if (!style) return;
  doc.x = doc.page.margins.left;
  doc.moveDown(style.before);
  ensureSpace(doc, style.size + 14);
  const label = style.upper ? text.toUpperCase() : text;
  doc.font(style.font).fontSize(style.size).fillColor(style.color).text(label, { ...bodyOptions, align });
  doc.moveDown(style.after);
  if (rule || style.rule) {
    doc.strokeColor(colors.rule).lineWidth(0.7).moveTo(doc.page.margins.left, doc.y).lineTo(
      doc.page.width - doc.page.margins.right,
      doc.y
    ).stroke();
    doc.moveDown(0.35);
  }
  doc.x = doc.page.margins.left;
}

function renderSectionHeading(doc, text) {
  renderHeading(doc, 'h2', text);
}

function renderParagraph(doc, text, { font = 'Times-Roman', size = 9.4, color = colors.body, spacing = paragraphSpacing, align = 'left' } = {}) {
  const options = { ...bodyOptions, align };
  ensureSpace(doc, textHeight(doc, text, font, size, options) + 5);
  doc.x = doc.page.margins.left;
  doc.font(font).fontSize(size).fillColor(color).text(text, options).moveDown(spacing);
  doc.x = doc.page.margins.left;
}

function renderTechParagraph(doc, text, locale) {
  const label = locale === 'en' ? 'Technologies & Skills:' : 'Tecnologias & Competências:';
  const content = text.slice(label.length).trim();
  const fullText = `${label} ${content}`;
  ensureSpace(doc, textHeight(doc, fullText, 'Times-Roman', 9.1, bodyOptions) + 6);
  doc.x = doc.page.margins.left;
  doc.font('Times-Bold').fontSize(9.1).fillColor(colors.ink).text(label, { ...bodyOptions, continued: true });
  doc.font('Times-Roman').fontSize(9.1).fillColor(colors.body).text(` ${content}`, bodyOptions).moveDown(paragraphSpacing);
  doc.x = doc.page.margins.left;
}

function drawStyledLink(doc, label, url, x, y, { font = 'Times-Roman', size = 9 } = {}) {
  doc.font(font).fontSize(size).fillColor(colors.link);
  const width = doc.widthOfString(label, { font, size });
  doc.text(label, x, y, { lineBreak: false });
  const baseline = y + size * 0.92;
  doc.moveTo(x, baseline).lineTo(x + width, baseline).lineWidth(0.5).strokeColor(colors.link).stroke();
  doc.link(x, y, width, size + 1, url);
  return width;
}

const iconPaths = {
  whatsapp: 'M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.9 7.9 0 0 0 13.6 2.326zM7.994 14.521a6.6 6.6 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592m3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.73.73 0 0 0-.529.247c-.182.198-.691.677-.691 1.654s.71 1.916.81 2.049c.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232',
  location: 'M8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10m0-7a3 3 0 1 1 0-6 3 3 0 0 1 0 6'
};

function drawSvgIcon(doc, pathData, x, y, size, color, viewBox = 16) {
  doc.save();
  doc.translate(x, y);
  doc.scale(size / viewBox, size / viewBox);
  doc.fillColor(color);
  doc.path(pathData).fill();
  doc.restore();
}

function drawIcon(doc, type, x, y, size, color) {
  if (type === 'phone' || type === 'whatsapp') {
    drawSvgIcon(doc, iconPaths.whatsapp, x, y, size, color);
    return;
  }
  if (type === 'location') {
    drawSvgIcon(doc, iconPaths.location, x, y, size, color);
    return;
  }

  doc.save();
  doc.lineWidth(0.85).strokeColor(color).fillColor(color);
  if (type === 'email') {
    doc.roundedRect(x, y, size, size * 0.72, 1).stroke();
    doc.moveTo(x, y).lineTo(x + size / 2, y + size * 0.4).lineTo(x + size, y).stroke();
  } else if (type === 'web') {
    doc.circle(x + size / 2, y + size / 2 - 0.2, size / 2 - 0.4).stroke();
    doc.moveTo(x, y + size / 2 - 0.2).lineTo(x + size, y + size / 2 - 0.2).stroke();
    doc.moveTo(x + size / 2, y - 0.2).lineTo(x + size / 2, y + size - 0.2).stroke();
    doc.ellipse(x + size / 2, y + size / 2 - 0.2, size * 0.27, size / 2 - 0.4).stroke();
  } else if (type === 'linkedin') {
    const r = 1.8;
    doc.roundedRect(x, y, size, size, r).fill();
    const fz = size * 0.7;
    const centerX = x + size / 2 - doc.font('Helvetica-Bold').fontSize(fz).widthOfString('in') / 2;
    const centerY = y + size / 2 - fz * 0.35;
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(fz).text('in', centerX, centerY, { lineBreak: false });
  }
  doc.restore();
}

function iconForUrl(url) {
  if (!url) return 'location';
  if (url.startsWith('mailto:')) return 'email';
  if (url.includes('wa.me')) return 'phone';
  if (url.includes('linkedin.com')) return 'linkedin';
  return 'web';
}

function parseContactRow(text) {
  return text.split(' | ').map((cell) => cell.trim()).filter(Boolean).map((cell) => {
    const segments = splitInline(cell);
    if (segments.length === 1 && segments[0].type === 'link') {
      return { icon: iconForUrl(segments[0].url), label: segments[0].label, url: segments[0].url };
    }
    const label = segments.map((segment) => (segment.type === 'link' ? segment.label : segment.text)).join('').trim();
    return { icon: 'location', label, url: null };
  });
}

function drawContactRow(doc, items, separator) {
  const iconSize = 9;
  const iconGap = 4;
  const fontSize = 8.8;
  const sepText = ` ${separator} `;
  doc.font('Times-Roman').fontSize(fontSize);
  const widths = items.map((item) => iconSize + iconGap + doc.widthOfString(item.label));
  const sepWidth = doc.widthOfString(sepText);
  const total = widths.reduce((acc, value) => acc + value, 0) + (items.length - 1) * sepWidth;
  const left = doc.page.margins.left;
  const right = doc.page.margins.right;
  const startX = left + ((doc.page.width - left - right) - total) / 2;

  ensureSpace(doc, fontSize + 6);
  const y = doc.y;
  let cursor = startX;
  items.forEach((item, index) => {
    drawIcon(doc, item.icon, cursor, y + 0.3, iconSize, colors.accent);
    const textX = cursor + iconSize + iconGap;
    if (item.url) {
      drawStyledLink(doc, item.label, item.url, textX, y, { size: fontSize });
    } else {
      doc.font('Times-Roman').fontSize(fontSize).fillColor(colors.muted).text(item.label, textX, y, { lineBreak: false });
    }
    cursor += widths[index];
    if (index < items.length - 1) {
      doc.font('Times-Roman').fontSize(fontSize).fillColor(colors.muted).text(sepText, cursor, y, { lineBreak: false });
      cursor += sepWidth;
    }
  });
  doc.x = left;
  doc.y = y + fontSize + 5;
  doc.moveDown(0.2);
}

function renderInlineLine(doc, raw, baseSize = 9.15) {
  const segments = splitInline(raw);
  const hasLinks = segments.some((segment) => segment.type === 'link');
  if (!hasLinks) return false;

  const display = segments.map((segment) => (segment.type === 'link' ? { ...segment, text: displayLabel(segment.label, segment.url) } : segment));
  const bulletX = doc.page.margins.left + 5;
  const startX = doc.page.margins.left + 17;
  const maxWidth = doc.page.width - doc.page.margins.right - startX;

  let size = baseSize;
  let total = Number.POSITIVE_INFINITY;
  while (size > 7.5 && total > maxWidth) {
    total = 0;
    for (const segment of display) {
      total += doc.font('Times-Roman').fontSize(size).widthOfString(segment.text, { lineBreak: false });
    }
    if (total > maxWidth) size -= 0.1;
  }

  ensureSpace(doc, size + 6);
  const y = doc.y;
  doc.font('Times-Roman').fontSize(size).fillColor(colors.body).text('\u2022', bulletX, y, { lineBreak: false });

  let cursorX = startX;
  for (const segment of display) {
    if (segment.type === 'text') {
      const w = doc.font('Times-Roman').fontSize(size).fillColor(colors.body).widthOfString(segment.text, { lineBreak: false });
      doc.text(segment.text, cursorX, y, { lineBreak: false });
      cursorX += w;
    } else {
      const w = doc.font('Times-Roman').fontSize(size).fillColor(colors.link).widthOfString(segment.text, { lineBreak: false });
      doc.text(segment.text, cursorX, y, { lineBreak: false });
      const baseline = y + size * 0.92;
      doc.moveTo(cursorX, baseline).lineTo(cursorX + w, baseline).lineWidth(0.5).strokeColor(colors.link).stroke();
      doc.link(cursorX, y, w, size + 1, segment.url);
      cursorX += w;
    }
  }

  doc.y = y + size + 4;
  doc.x = doc.page.margins.left;
  doc.moveDown(listItemSpacing);
  return true;
}

function renderBullet(doc, raw) {
  if (renderInlineLine(doc, raw)) return;

  const text = plainText(raw);
  const bulletX = doc.page.margins.left + 5;
  const textX = doc.page.margins.left + 17;
  const width = doc.page.width - doc.page.margins.right - textX;
  const options = { ...bodyOptions, width };
  const height = textHeight(doc, text, 'Times-Roman', 9.15, options) + 3;

  ensureSpace(doc, height);
  const y = doc.y;
  doc.font('Times-Roman').fontSize(9.15).fillColor(colors.body).text('\u2022', bulletX, y, { lineBreak: false });
  doc.text(text, textX, y, options).moveDown(listItemSpacing);
}

function renderJobHeading(doc, heading, date) {
  const [role, company] = heading.split(' | ');
  doc.x = doc.page.margins.left;
  doc.moveDown(headingStyles.h3.before);
  const titleHeight = textHeight(doc, `${company}\n${role}`, 'Times-Bold', 11, { lineGap: 0.5 });
  ensureSpace(doc, titleHeight + 22);
  doc.font('Times-Bold').fontSize(9.3).fillColor(colors.accent).text(date, { ...bodyOptions, align: 'left' }).moveDown(0.16);
  doc.font('Times-Bold').fontSize(11).fillColor(colors.ink).text(company, { lineGap: 0.4 });
  doc.font('Times-Bold').fontSize(11).fillColor(colors.ink).text(role, { lineGap: 0.4 }).moveDown(headingStyles.h3.after + 0.1);
  doc.x = doc.page.margins.left;
}

function renderResume({ locale, fileName, language }) {
  const sourcePath = path.join(root, 'src', 'content', 'resume', `${locale}.md`);
  const outputPath = path.join(outputDir, fileName);
  const source = fs.readFileSync(sourcePath, 'utf8');
  const blocks = parseMarkdown(source);
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 42, right: 54, bottom: 46, left: 54 },
    info: {
      Title: locale === 'en' ? 'Filipe Bojikian Rissi - Resume' : 'Filipe Bojikian Rissi - Currículo',
      Author: 'Filipe Bojikian Rissi',
      Subject: 'Software engineering professional experience and technical skills',
      Keywords: 'software engineering, distributed systems, cloud architecture, AWS, Kubernetes, microservices',
      Language: language
    }
  });
  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);

  const firstH1 = blocks.findIndex((block) => block.type === 'h1');
  const firstH2 = blocks.findIndex((block) => block.type === 'h2');
  const headerEnd = firstH2 === -1 ? blocks.length : firstH2;
  const headerSlice = blocks.slice(firstH1, headerEnd);
  const contentBlocks = blocks.slice(headerEnd);

  const title = headerSlice[0]?.text ?? '';
  const subtitle = headerSlice[1]?.text ?? '';
  const contactBlocks = headerSlice.slice(2).filter((block) => block.type === 'paragraph');

  renderHeading(doc, 'h1', title, { align: 'center' });
  ensureSpace(doc, 30);
  doc.font('Times-Bold').fontSize(10.8).fillColor(colors.ink).text(subtitle, { align: 'center', lineGap: 1.2 }).moveDown(0.35);
  for (const block of contactBlocks) {
    drawContactRow(doc, parseContactRow(block.raw ?? block.text), '|');
  }
  doc.moveDown(0.3);

  for (let index = 0; index < contentBlocks.length; index += 1) {
    const block = contentBlocks[index];

    if (block.type === 'pagebreak') {
      forcePageBreak(doc);
    } else if (block.type === 'h2') {
      if (block.pageBreak) forcePageBreak(doc);
      renderSectionHeading(doc, block.text);
    } else if (block.type === 'h3' && block.text.includes(' | ')) {
      const dateBlock = contentBlocks[index + 1];
      renderJobHeading(doc, block.text, dateBlock?.text ?? '');
      if (dateBlock?.type === 'paragraph') index += 1;
    } else if (block.type === 'h3') {
      renderParagraph(doc, `${block.text}:`, { font: 'Times-Bold', size: headingStyles.h3.size, color: colors.ink, spacing: headingStyles.h3.after });
    } else if (block.type === 'h4') {
      renderHeading(doc, 'h4', block.text);
    } else if (block.type === 'list') {
      for (const item of block.items) renderBullet(doc, item);
      doc.moveDown(listSpacing);
    } else {
      const text = block.text;
      const isTech = text.startsWith('Technologies & Skills:') || text.startsWith('Tecnologias & Competências:');
      if (isTech) renderTechParagraph(doc, text, locale);
      else renderParagraph(doc, text, { font: block.emphasized ? 'Times-Bold' : 'Times-Roman', size: block.emphasized ? 9.3 : 9.4 });
    }
  }

  doc.end();
  return new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

await Promise.all(resumes.map(renderResume));