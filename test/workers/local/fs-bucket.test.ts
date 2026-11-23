// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createFsBucket } from '@/workers/local/fs-bucket';

let root: string;

beforeEach(() => {
  root = mkdtempSync(path.join(os.tmpdir(), 'icons-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('local icon bucket', () => {
  it('puts, gets, lists and deletes objects with their content type', async () => {
    const bucket = createFsBucket(root);
    await bucket.put('groups/g1/a.png', Uint8Array.from([1, 2, 3]), { httpMetadata: { contentType: 'image/png' } });
    await bucket.put('groups/g2/b.webp', Uint8Array.from([4]));
    const object = await bucket.get('groups/g1/a.png');
    expect(new Uint8Array(await object!.arrayBuffer())).toEqual(Uint8Array.from([1, 2, 3]));
    expect(object!.httpMetadata).toEqual({ contentType: 'image/png' });
    expect((await bucket.get('groups/g2/b.webp'))!.httpMetadata).toEqual({ contentType: '' });
    expect(await bucket.get('groups/none.png')).toBeNull();

    const listed = await bucket.list({ prefix: 'groups/' });
    expect(listed.truncated).toBe(false);
    expect(listed.objects.map((item) => item.key).sort()).toEqual(['groups/g1/a.png', 'groups/g2/b.webp']);
    expect(listed.objects[0].uploaded).toBeInstanceOf(Date);
    expect((await bucket.list({ prefix: 'other/' })).objects).toEqual([]);
    expect((await bucket.list()).objects).toHaveLength(2);

    await bucket.delete('groups/g1/a.png');
    await bucket.delete(['groups/g2/b.webp', 'groups/missing.png']);
    expect((await bucket.list()).objects).toEqual([]);
  });

  it('lists nothing before the folder exists and refuses keys outside it', async () => {
    const bucket = createFsBucket(path.join(root, 'not-yet'));
    expect((await bucket.list()).objects).toEqual([]);
    await expect(bucket.put('../escape.png', new Uint8Array(1))).rejects.toThrow('Invalid key');
  });
});
