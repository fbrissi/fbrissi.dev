// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { IconError, readIcon } from '@/workers/study-group/icon-image';

import { ascii, jpeg, jpegSegment, png, pngChunk, PNG_SIGNATURE, sof, vp8, vp8l, vp8x, webp, webpChunk } from './fixtures/images';

const damaged = 'This image file is damaged. Use another PNG, JPEG or WebP file.';
const reject = (data: Uint8Array) => {
  try {
    readIcon(data);
  } catch (error) {
    expect(error).toBeInstanceOf(IconError);
    return (error as Error).message;
  }
  throw new Error('expected a rejection');
};

describe('icon image check', () => {
  it('reads a PNG and drops its text, EXIF and time chunks and anything after IEND', () => {
    const image = readIcon(png(256, 128, [pngChunk('tEXt', 'Author\0Ana'), pngChunk('eXIf', 'GPS'), pngChunk('iTXt', 'x'), pngChunk('zTXt', 'y'), pngChunk('tIME', [7, 1, 1, 1, 1, 1, 1]), pngChunk('gAMA', [0, 0, 0, 1])], [1, 2, 3]));
    expect(image).toMatchObject({ contentType: 'image/png', extension: 'png', width: 256, height: 128 });
    const text = ascii(image.bytes);
    expect(text).toContain('IHDR');
    expect(text).toContain('gAMA');
    expect(text).toContain('IEND');
    expect(text).not.toMatch(/tEXt|eXIf|iTXt|zTXt|tIME|Ana|GPS/);
    expect(image.bytes.at(-1)).not.toBe(3);
  });

  it('reads a JPEG and drops its EXIF/XMP, IPTC and comment segments', () => {
    const image = readIcon(jpeg(512, 300));
    expect(image).toMatchObject({ contentType: 'image/jpeg', extension: 'jpg', width: 512, height: 300 });
    const text = ascii(image.bytes);
    expect(text).toContain('JFIF');
    expect(text).not.toMatch(/Exif|GPS|Photoshop|comment/);
    expect(Array.from(image.bytes.slice(-4))).toEqual([0x12, 0x34, 0xff, 0xd9]);
  });

  it('walks every JPEG scan, dropping metadata between progressive scans and anything after EOI', () => {
    const scan = Array.from(jpegSegment(0xda, [1, 1, 0, 0, 0x3f, 0]));
    const firstScanData = [0x12, 0xff, 0x00, 0x34, 0xff, 0xd0, 0x56];
    const table = Array.from(jpegSegment(0xc4, [1]));
    const file = Uint8Array.from([
      ...[0xff, 0xd8],
      ...jpegSegment(0xe0, 'JFIF\0'),
      ...sof(64, 32),
      ...scan,
      ...firstScanData,
      ...jpegSegment(0xfe, 'between scans'),
      ...jpegSegment(0xe1, 'Exif\0\0GPS'),
      ...table,
      ...scan,
      ...[0x78, 0xff, 0xff, 0xd9],
      ...jpegSegment(0xe1, 'Exif\0\0trailer'),
      ...[0xff, 0xd8, 0xff, 0xd9],
    ]);
    const image = readIcon(file);
    expect(image).toMatchObject({ contentType: 'image/jpeg', width: 64, height: 32 });
    expect(ascii(image.bytes)).not.toMatch(/between scans|Exif|GPS|trailer/);
    const expectedTail = [...scan, ...firstScanData, ...table, ...scan, 0x78, 0xff, 0xd9];
    expect(Array.from(image.bytes.slice(-expectedTail.length))).toEqual(expectedTail);
  });

  it('keeps a JPEG whose last scan runs to the end of the file without EOI', () => {
    const file = Uint8Array.from([0xff, 0xd8, ...sof(8, 8), ...jpegSegment(0xda, [1, 1, 0, 0, 0x3f, 0]), 0x01, 0xff, 0x00, 0x02, 0xff]);
    expect(readIcon(file).bytes).toEqual(file);
  });

  it('reads extended, lossy and lossless WebP and drops EXIF and XMP, clearing their flags', () => {
    const extended = readIcon(webp([vp8x(300, 200), webpChunk('ICCP', 'profile'), vp8(10, 10), webpChunk('EXIF', 'GPS'), webpChunk('XMP ', '<x:xmpmeta/>')]));
    expect(extended).toMatchObject({ contentType: 'image/webp', extension: 'webp', width: 300, height: 200 });
    const text = ascii(extended.bytes);
    expect(text).not.toMatch(/EXIF|XMP|GPS|xmpmeta/);
    expect(text).toContain('ICCP');
    expect(extended.bytes[20]).toBe(0x20);
    expect(new DataView(extended.bytes.buffer).getUint32(4, true)).toBe(extended.bytes.length - 8);

    expect(readIcon(webp([vp8(64, 48)]))).toMatchObject({ width: 64, height: 48 });
    expect(readIcon(webp([vp8l(17, 9)]))).toMatchObject({ width: 17, height: 9 });
    expect(readIcon(webp([vp8x(20, 20), vp8l(17, 9)]))).toMatchObject({ width: 20, height: 20 });
  });

  it('rejects other formats, by content rather than name', () => {
    for (const data of [Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]), new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'), new Uint8Array(4)]) {
      expect(reject(data)).toBe('Use a PNG, JPEG or WebP image.');
    }
    const riffOther = webp([vp8(1, 1)]);
    riffOther.set([0x41, 0x56, 0x49, 0x20], 8);
    expect(reject(riffOther)).toBe('Use a PNG, JPEG or WebP image.');
  });

  it('rejects images over 256 KB or 512 × 512 pixels', () => {
    expect(reject(png(1, 1, [pngChunk('IDAT', new Array(256 * 1024).fill(0))]))).toBe('Use an image of at most 256 KB.');
    expect(reject(png(513, 10))).toBe('Use an image of at most 512 × 512 pixels.');
    expect(reject(jpeg(10, 600))).toBe('Use an image of at most 512 × 512 pixels.');
    expect(reject(webp([vp8x(1000, 10), vp8(1, 1)]))).toBe('Use an image of at most 512 × 512 pixels.');
  });

  it('rejects damaged files', () => {
    const broken = [
      Uint8Array.from([...PNG_SIGNATURE, 0, 0, 0, 13]),
      Uint8Array.from([...PNG_SIGNATURE, ...pngChunk('IDAT', new Array(30).fill(0))]),
      png(0, 10),
      png(10, 10).slice(0, 45),
      png(10, 10).slice(0, 40),
      jpeg(0, 10),
      jpeg(10, 10, []),
      Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x01, 0xff, 0xd9]),
      Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x40, 0, 0]),
      Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00]),
      Uint8Array.from([0xff, 0xd8, 0xff]),
      Uint8Array.from([0xff, 0xd8, ...sof(8, 8), 0xff, 0xd9]),
      Uint8Array.from([0xff, 0xd8, ...sof(8, 8), ...jpegSegment(0xda, [1]), 0x01, 0xff, 0xff]),
      Uint8Array.from([0xff, 0xd8, ...sof(8, 8), ...jpegSegment(0xda, [1]), 0x01, 0xff, 0xe0, 0x00]),
      jpeg(10, 10, [jpegSegment(0xc0, [8, 0])]),
      webp([vp8(10, 10, [0, 0, 0])]),
      webp([vp8l(10, 10, 0x00)]),
      webp([webpChunk('ICCP', 'profile')]),
      webp([vp8(10, 10)]).slice(0, 20),
      Uint8Array.from([...webp([vp8(10, 10)]), 1, 2, 3]),
    ];
    for (const data of broken) expect(reject(data)).toBe(damaged);
  });
});
