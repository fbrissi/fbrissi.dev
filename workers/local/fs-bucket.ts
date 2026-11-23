import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { BucketLike } from '../study-group/icons';

/**
 * Local stand-in for the R2 icon bucket: one file per key under `root`, with the content type in a `.type` file
 * next to it. Same interface as the Worker binding subset in workers/study-group/icons.ts.
 */
export function createFsBucket(root: string): BucketLike {
  const file = (key: string) => {
    const resolved = path.resolve(root, key);
    if (!resolved.startsWith(path.resolve(root) + path.sep)) throw new Error('Invalid key');
    return resolved;
  };

  return {
    async put(key, value, options) {
      await mkdir(path.dirname(file(key)), { recursive: true });
      await writeFile(file(key), value);
      await writeFile(`${file(key)}.type`, options?.httpMetadata?.contentType ?? '');
    },
    async get(key) {
      try {
        const [data, contentType] = await Promise.all([readFile(file(key)), readFile(`${file(key)}.type`, 'utf8')]);
        return { arrayBuffer: async () => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), httpMetadata: { contentType } };
      } catch {
        return null;
      }
    },
    async delete(keys) {
      for (const key of Array.isArray(keys) ? keys : [keys]) {
        await rm(file(key), { force: true });
        await rm(`${file(key)}.type`, { force: true });
      }
    },
    async list(options) {
      const objects: { key: string; uploaded: Date }[] = [];
      const entries = await readdir(root, { recursive: true }).catch(() => [] as string[]);
      for (const entry of entries) {
        const key = entry.split(path.sep).join('/');
        if (key.endsWith('.type') || !key.startsWith(options?.prefix ?? '')) continue;
        const info = await stat(path.join(root, entry));
        if (info.isFile()) objects.push({ key, uploaded: info.mtime });
      }
      return { objects, truncated: false };
    },
  };
}
