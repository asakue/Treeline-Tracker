/**
 * Channel hash calculation.
 * Computes 1-byte XOR fold for channel matching.
 */

export function calculateChannelHash(channelName: string): number {
  if (!channelName || channelName.length === 0) return 0;
  let hash = 0;
  for (let i = 0; i < channelName.length; i++) {
    hash ^= channelName.charCodeAt(i);
  }
  return hash & 0xff;
}

export function matchesChannelHash(channelName: string, hash: number): boolean {
  return calculateChannelHash(channelName) === (hash & 0xff);
}
