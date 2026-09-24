import crypto from 'node:crypto';

// Recorded with every document, so a future key rotation can tell which key encrypted what.
export const KEY_ID = 'v1';

/**
 * Derives the 256-bit AES key from FILE_ENCRYPTION_KEY. Any long random string works (e.g. the
 * value Render's "Generate" button produces). Losing or changing it makes every stored file
 * unreadable, so it must be kept safe and never rotated without a re-encryption step.
 * @returns {Buffer | null}
 */
export function fileKeyFromEnv(secret) {
  if (!secret || secret.length < 16) return null;
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * AES-256-GCM. The owner and document id are bound in as associated data, so an encrypted blob
 * copied onto another user's row (or another document) fails to decrypt instead of leaking.
 */
export function encryptFile(key, plaintext, { userId, documentId }) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(`${userId}:${documentId}`));
  const content = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { iv, authTag: cipher.getAuthTag(), content };
}

export function decryptFile(key, { iv, authTag, content }, { userId, documentId }) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAAD(Buffer.from(`${userId}:${documentId}`));
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(content), decipher.final()]);
}

/** Detects the real file type from its first bytes, ignoring whatever name/type the browser claimed. */
export function sniffFileType(buf) {
  if (buf.length >= 5 && buf.subarray(0, 5).toString('latin1') === '%PDF-') return { mime: 'application/pdf', ext: 'pdf' };
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mime: 'image/png', ext: 'png' };
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  return null;
}
