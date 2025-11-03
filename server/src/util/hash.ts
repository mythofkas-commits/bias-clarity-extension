import crypto from 'crypto';

/**
 * Generate a SHA-256 hash of the given text
 * @param text - Text to hash
 * @returns Hex-encoded hash string
 */
export function hashText(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}
