/** Minimal, hand-built image files for the icon checks: only the structure the parser reads is real. */
const bytes = (...parts: (number[] | Uint8Array | string)[]): Uint8Array<ArrayBuffer> => {
  const flat: number[] = [];
  for (const part of parts) {
    if (typeof part === 'string') for (const char of part) flat.push(char.charCodeAt(0));
    else for (const value of part) flat.push(value);
  }
  return new Uint8Array(flat);
};
const u32be = (value: number) => [(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255];
const u32le = (value: number) => [value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255];
const u16be = (value: number) => [(value >> 8) & 255, value & 255];
const u16le = (value: number) => [value & 255, (value >> 8) & 255];
const u24le = (value: number) => [value & 255, (value >> 8) & 255, (value >> 16) & 255];

export const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function pngChunk(type: string, data: number[] | string = []): Uint8Array<ArrayBuffer> {
  const payload = bytes(data);
  return bytes(u32be(payload.length), type, payload, [0, 0, 0, 0]);
}

export function png(width: number, height: number, extra: Uint8Array[] = [], trailing: number[] = []): Uint8Array<ArrayBuffer> {
  return bytes(PNG_SIGNATURE, pngChunk('IHDR', [...u32be(width), ...u32be(height), 8, 6, 0, 0, 0]), ...extra, pngChunk('IDAT', [1, 2, 3]), pngChunk('IEND'), trailing);
}

export function jpegSegment(marker: number, data: number[] | string = []): Uint8Array<ArrayBuffer> {
  const payload = bytes(data);
  return bytes([0xff, marker], u16be(payload.length + 2), payload);
}

export function sof(width: number, height: number): Uint8Array<ArrayBuffer> {
  return jpegSegment(0xc0, [8, ...u16be(height), ...u16be(width), 1, 1, 0x11, 0]);
}

export function jpeg(width: number, height: number, segments?: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const body = segments ?? [jpegSegment(0xe0, 'JFIF\0'), jpegSegment(0xe1, 'Exif\0\0GPS'), jpegSegment(0xed, 'Photoshop 3.0'), jpegSegment(0xfe, 'comment'), jpegSegment(0xc4, [0]), sof(width, height)];
  return bytes([0xff, 0xd8], ...body, jpegSegment(0xda, [1, 1, 0, 0, 0x3f, 0]), [0x12, 0x34, 0xff, 0xd9]);
}

export function webpChunk(type: string, data: number[] | string): Uint8Array<ArrayBuffer> {
  const payload = bytes(data);
  return bytes(type, u32le(payload.length), payload, payload.length % 2 ? [0] : []);
}

export function vp8(width: number, height: number, startCode = [0x9d, 0x01, 0x2a]): Uint8Array<ArrayBuffer> {
  return webpChunk('VP8 ', [0, 0, 0, ...startCode, ...u16le(width), ...u16le(height)]);
}

export function vp8l(width: number, height: number, signature = 0x2f): Uint8Array<ArrayBuffer> {
  return webpChunk('VP8L', [signature, ...u32le(((height - 1) << 14) | (width - 1))]);
}

export function vp8x(width: number, height: number, flags = 0x0c | 0x20): Uint8Array<ArrayBuffer> {
  return webpChunk('VP8X', [flags, 0, 0, 0, ...u24le(width - 1), ...u24le(height - 1)]);
}

export function webp(chunks: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const body = bytes(...chunks);
  return bytes('RIFF', u32le(body.length + 4), 'WEBP', body);
}

export function ascii(data: Uint8Array): string {
  return String.fromCharCode(...data);
}
