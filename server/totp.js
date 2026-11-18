// Time-based one-time passwords (RFC 6238), the codes Google Authenticator, Authy, 1Password and
// Microsoft Authenticator show. HMAC-SHA1, 6 digits, 30-second steps.
import crypto from "node:crypto";
import { Buffer } from "node:buffer";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const STEP_SECONDS = 30;

export function base32Encode(buf) {
  let bits = 0,
    value = 0,
    out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text) {
  const clean = String(text).toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0,
    value = 0;
  const out = [];
  for (const ch of clean) {
    const idx = ALPHABET.indexOf(ch);
    if (idx < 0) throw new Error("Invalid base32 character.");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** A fresh 160-bit secret, base32 (what the authenticator app stores). */
export const generateTotpSecret = () => base32Encode(crypto.randomBytes(20));

export const stepAt = (ms = Date.now()) => Math.floor(ms / 1000 / STEP_SECONDS);

/** The 6-digit code for a given step. `secret` is base32. */
export function totpCode(secret, step) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = crypto.createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(binary % 1_000_000).padStart(6, "0");
}

/**
 * Checks a code against the current step and one step either side (clock drift).
 * Returns the matching step, or null. A step at or before `lastStep` is refused, so a code that
 * was already used (or one a bystander saw) can't be replayed.
 */
export function verifyTotp(secret, code, { now = Date.now(), lastStep = null, window = 1 } = {}) {
  if (!/^\d{6}$/.test(String(code || ""))) return null;
  const current = stepAt(now);
  let found = null;
  for (let s = current - window; s <= current + window; s++) {
    const expected = Buffer.from(totpCode(secret, s));
    const given = Buffer.from(String(code));
    // Check every step (no early exit) so timing doesn't reveal which one matched.
    if (crypto.timingSafeEqual(expected, given) && found === null) found = s;
  }
  if (found === null) return null;
  if (lastStep !== null && lastStep !== undefined && found <= Number(lastStep)) return null;
  return found;
}

export function otpauthUri({ secret, email, issuer = "StudyBg Admin" }) {
  const label = encodeURIComponent(`${issuer}:${email}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${STEP_SECONDS}`;
}

/** Ten-character one-time recovery codes like "k7m2-9qxd" for when the phone is lost. */
export function generateRecoveryCodes(count = 8) {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789"; // no look-alikes (i, l, o, 0, 1)
  return Array.from({ length: count }, () => {
    const pick = (n) => Array.from({ length: n }, () => chars[crypto.randomInt(chars.length)]).join("");
    return `${pick(4)}-${pick(4)}`;
  });
}
export const normalizeRecoveryCode = (code) => String(code || "").trim().toLowerCase();
