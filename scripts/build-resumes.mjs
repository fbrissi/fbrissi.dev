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

function plainText(value) {
  return value
    .replace(/\[([^\]]+)]\(([^)]+)\)/g, (_match, label, url) => {
      if (url.startsWith('mailto:') || url.startsWith('tel:') || label.replace(/\/$/, '') === url.replace(/^https?:\/\//, '').replace(/\/$/, '')) return label;
      return `${label} (${url})`;
    })
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1');
}

function parseMarkdown(source) {
  const blocks = [];
  let paragraph = [];
  let list = [];

  function flushParagraph() {
    if (paragraph.length > 0) {
      const value = paragraph.join(' ');
      blocks.push({ type: 'paragraph', text: plainText(value), emphasized: /^\*\*.+\*\*$/.test(value) });
    }
    paragraph = [];
  }

  function flushList() {
    if (list.length > 0) blocks.push({ type: 'list', items: list.map(plainText) });
    list = [];
  }

  for (const line of source.split(/\r?\n/)) {
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    const bullet = /^-\s+(.+)$/.exec(line);

    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ type: `h${heading[1].length}`, text: plainText(heading[2]) });
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

function renderResume({ locale, fileName, language }) {
  const sourcePath = path.join(root, 'src', 'content', 'resume', `${locale}.md`);
  const outputPath = path.join(outputDir, fileName);
  const source = fs.readFileSync(sourcePath, 'utf8');
  const blocks = parseMarkdown(source);
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 40, right: 44, bottom: 44, left: 44 },
    bufferPages: true,
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

  for (const block of blocks) {
    if (block.type === 'h1') {
      ensureSpace(doc, 40);
      doc.font('Helvetica-Bold').fontSize(22).fillColor('#111827').text(block.text, { align: 'center' }).moveDown(0.25);
    } else if (block.type === 'h2') {
      ensureSpace(doc, 34);
      doc.moveDown(0.35).font('Helvetica-Bold').fontSize(13).fillColor('#c2410c').text(block.text.toUpperCase()).moveDown(0.25);
    } else if (block.type === 'h3') {
      ensureSpace(doc, 30);
      doc.moveDown(0.25).font('Helvetica-Bold').fontSize(10.5).fillColor('#111827').text(block.text).moveDown(0.1);
    } else if (block.type === 'list') {
      const options = { bulletRadius: 1.6, bulletIndent: 5, textIndent: 14, lineGap: 1.2 };
      const height = doc.font('Helvetica').fontSize(8.3).heightOfString(block.items[0], options) + 8;
      ensureSpace(doc, height);
      doc.fillColor('#1f2937').list(block.items, options).moveDown(0.25);
    } else {
      const text = plainText(block.text);
      const font = block.emphasized || text.startsWith('Technologies & Skills:') || text.startsWith('Tecnologias & Competências:')
        ? 'Helvetica-Bold'
        : 'Helvetica';
      const size = block.emphasized ? 9 : 8.6;
      const options = { align: 'left', lineGap: 1.2 };
      const height = doc.font(font).fontSize(size).heightOfString(text, options) + 6;
      ensureSpace(doc, Math.min(height, 50));
      doc.fillColor('#1f2937').text(text, options).moveDown(0.35);
    }
  }

  const pages = doc.bufferedPageRange();
  for (let index = 0; index < pages.count; index += 1) {
    doc.switchToPage(index);
    const bottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.font('Helvetica').fontSize(7).fillColor('#6b7280').text(
      `${index + 1} / ${pages.count}`,
      doc.page.margins.left,
      doc.page.height - 28,
      { align: 'center', lineBreak: false, width: doc.page.width - doc.page.margins.left - doc.page.margins.right }
    );
    doc.page.margins.bottom = bottomMargin;
  }

  doc.end();
  return new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

await Promise.all(resumes.map(renderResume));
