import { createHash } from 'node:crypto';

export function payloadDigest(deviceId, payload) {
  return createHash('sha256').update(deviceId).update('\n').update(payload).digest('hex');
}

export function sessionIdForPayload(deviceId, payload) {
  const digest = payloadDigest(deviceId, payload).split('');
  digest[12] = '5';
  digest[16] = ['8', '9', 'a', 'b'][Number.parseInt(digest[16], 16) % 4];
  const value = digest.join('').slice(0, 32);
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}
