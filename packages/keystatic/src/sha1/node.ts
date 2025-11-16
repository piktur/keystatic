import { createHash } from 'node:crypto';

export async function sha1(content: Uint8Array) {
  return createHash('sha1').update(content).digest('hex');
}
