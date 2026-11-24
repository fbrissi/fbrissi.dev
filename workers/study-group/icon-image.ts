import { ICON_LIMITS, type IconContentType } from './contract';

/** A rejected upload; the message is shown to the user. */
export class IconError extends Error {}

export interface IconImage {
  contentType: IconContentType;
  extension: 'png' | 'jpg' | 'webp';
  width: number;
  height: number;
  /** The image without metadata (EXIF, XMP, IPTC, comments and text chunks). */
  bytes: Uint8Array;
}

const damaged = () => new IconError('This image file is damaged. Use another PNG, JPEG or WebP file.');

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

// PNG: 8-byte signature, then chunks of length (4, big-endian), type (4), data, CRC (4). IHDR comes first.
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PNG_METADATA = new Set(['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME']);

function readPng(bytes: Uint8Array): Omit<IconImage, 'contentType' | 'extension'> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 33 || ascii(bytes, 12, 4) !== 'IHDR') throw damaged();
  const kept: Uint8Array[] = [bytes.subarray(0, 8)];
  let offset = 8;
  let ended = false;
  while (!ended) {
    if (offset + 12 > bytes.length) throw damaged();
    const length = view.getUint32(offset);
    const end = offset + 12 + length;
    if (end > bytes.length) throw damaged();
    const type = ascii(bytes, offset + 4, 4);
    if (!PNG_METADATA.has(type)) kept.push(bytes.subarray(offset, end));
    ended = type === 'IEND';
    offset = end;
  }
  return { width: view.getUint32(16), height: view.getUint32(20), bytes: concat(kept) };
}

// JPEG: SOI, then marker segments (0xFF, marker, 2-byte length including itself). Each SOS is followed by entropy-coded
// data, where 0xFF00 (a stuffed byte) and RST0–RST7 are data and any other 0xFF marks the next segment; progressive
// images have several scans with segments between them. Everything after EOI (thumbnails, MPF images, trailers) is
// dropped. SOF0–SOF15 (except DHT, JPG and DAC) carry the height and width.
const JPEG_METADATA = new Set([0xe1, 0xed, 0xfe]); // APP1 (EXIF, XMP), APP13 (IPTC), COM

function entropyEnd(bytes: Uint8Array, offset: number): number {
  for (let index = offset; index < bytes.length - 1; index++) {
    if (bytes[index] !== 0xff) continue;
    const next = bytes[index + 1];
    if (next === 0x00 || (next >= 0xd0 && next <= 0xd7)) index++;
    else return index;
  }
  return bytes.length;
}

function readJpeg(bytes: Uint8Array): Omit<IconImage, 'contentType' | 'extension'> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const kept: Uint8Array[] = [bytes.subarray(0, 2)];
  let offset = 2;
  let size: { width: number; height: number } | null = null;
  let scanned = false;
  for (;;) {
    if (scanned && offset >= bytes.length) return { ...size!, bytes: concat(kept) };
    if (offset + 2 > bytes.length || bytes[offset] !== 0xff) throw damaged();
    while (bytes[offset + 1] === 0xff) offset++;
    const marker = bytes[offset + 1];
    if (marker === 0xd9) {
      if (!scanned) throw damaged();
      kept.push(bytes.subarray(offset, offset + 2));
      return { ...size!, bytes: concat(kept) };
    }
    if (offset + 4 > bytes.length) throw damaged();
    const length = view.getUint16(offset + 2);
    const end = offset + 2 + length;
    if (length < 2 || end > bytes.length) throw damaged();
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      if (length < 7) throw damaged();
      size = { height: view.getUint16(offset + 5), width: view.getUint16(offset + 7) };
    }
    if (!JPEG_METADATA.has(marker)) kept.push(bytes.subarray(offset, end));
    offset = end;
    if (marker === 0xda) {
      if (!size) throw damaged();
      scanned = true;
      const dataEnd = entropyEnd(bytes, offset);
      kept.push(bytes.subarray(offset, dataEnd));
      offset = dataEnd;
    }
  }
}

// WebP: RIFF container with 'WEBP', then chunks of FourCC, length (4, little-endian), data padded to an even size.
// VP8X carries the canvas size and flags (0x08 EXIF, 0x04 XMP); VP8 and VP8L carry the size of a simple image.
function readWebp(bytes: Uint8Array): Omit<IconImage, 'contentType' | 'extension'> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const kept: Uint8Array[] = [];
  let size: { width: number; height: number } | null = null;
  let offset = 12;
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) throw damaged();
    const type = ascii(bytes, offset, 4);
    const length = view.getUint32(offset + 4, true);
    const end = offset + 8 + length + (length % 2);
    if (end > bytes.length) throw damaged();
    const data = offset + 8;
    if (type === 'VP8X' && length >= 10) {
      const chunk = bytes.slice(offset, end);
      chunk[8] &= ~0x0c;
      kept.push(chunk);
      size = { width: 1 + (bytes[data + 4] | (bytes[data + 5] << 8) | (bytes[data + 6] << 16)), height: 1 + (bytes[data + 7] | (bytes[data + 8] << 8) | (bytes[data + 9] << 16)) };
    } else if (type === 'VP8 ' && length >= 10) {
      if (!startsWith(bytes, [0x9d, 0x01, 0x2a], data + 3)) throw damaged();
      size ??= { width: view.getUint16(data + 6, true) & 0x3fff, height: view.getUint16(data + 8, true) & 0x3fff };
      kept.push(bytes.subarray(offset, end));
    } else if (type === 'VP8L' && length >= 5) {
      if (bytes[data] !== 0x2f) throw damaged();
      const bits = view.getUint32(data + 1, true);
      size ??= { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
      kept.push(bytes.subarray(offset, end));
    } else if (type !== 'EXIF' && type !== 'XMP ') {
      kept.push(bytes.subarray(offset, end));
    }
    offset = end;
  }
  if (!size) throw damaged();
  const body = concat(kept);
  const header = new Uint8Array(12);
  header.set(bytes.subarray(0, 12));
  new DataView(header.buffer).setUint32(4, body.length + 4, true);
  return { ...size, bytes: concat([header, body]) };
}

/**
 * Checks an uploaded icon by its content, not its name or declared type: a PNG, JPEG or WebP of at most 256 KB and
 * 512 × 512 pixels (read from the image headers), returned without metadata. SVG, GIF and anything else is rejected.
 */
export function readIcon(bytes: Uint8Array): IconImage {
  if (bytes.length > ICON_LIMITS.maxBytes) throw new IconError('Use an image of at most 256 KB.');
  let image: Omit<IconImage, 'contentType' | 'extension'>;
  let contentType: IconContentType;
  let extension: IconImage['extension'];
  if (startsWith(bytes, PNG_SIGNATURE)) {
    image = readPng(bytes);
    contentType = 'image/png';
    extension = 'png';
  } else if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    image = readJpeg(bytes);
    contentType = 'image/jpeg';
    extension = 'jpg';
  } else if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') {
    image = readWebp(bytes);
    contentType = 'image/webp';
    extension = 'webp';
  } else {
    throw new IconError('Use a PNG, JPEG or WebP image.');
  }
  if (image.width < 1 || image.height < 1) throw damaged();
  if (image.width > ICON_LIMITS.maxPixels || image.height > ICON_LIMITS.maxPixels) {
    throw new IconError(`Use an image of at most ${ICON_LIMITS.maxPixels} × ${ICON_LIMITS.maxPixels} pixels.`);
  }
  return { ...image, contentType, extension };
}
