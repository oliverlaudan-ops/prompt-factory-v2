import crypto from "node:crypto";

/**
 * AES-256-GCM helpers for encrypting user-supplied secrets (e.g. API keys)
 * at rest. The master key is loaded once from the ENCRYPTION_KEY env var.
 *
 * Key requirements:
 *   - 32 bytes, base64-encoded (44 chars including padding)
 *   - Generate with:  openssl rand -base64 32
 *
 * Output layout (all base64):
 *   ciphertext (variable)
 *   iv         (12 bytes → 16 chars)
 *   authTag    (16 bytes → 24 chars)
 *
 * Storing iv + authTag alongside the ciphertext is standard practice
 * for GCM mode — neither needs to be secret, but both are required
 * for decryption.
 */

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const KEY_LEN = 32;

function getMasterKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "ENCRYPTION_KEY is not set. Generate one with `openssl rand -base64 32` and add it to .env"
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_LEN) {
    throw new Error(
      `ENCRYPTION_KEY must decode to ${KEY_LEN} bytes (got ${key.length}). Re-generate with \`openssl rand -base64 32\`.`
    );
  }
  return key;
}

export function encryptSecret(plaintext: string): {
  ciphertext: string;
  iv: string;
  authTag: string;
} {
  const key = getMasterKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: ct.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

export function decryptSecret(parts: {
  ciphertext: string;
  iv: string;
  authTag: string;
}): string {
  const key = getMasterKey();
  const iv = Buffer.from(parts.iv, "base64");
  const authTag = Buffer.from(parts.authTag, "base64");
  const ct = Buffer.from(parts.ciphertext, "base64");
  if (iv.length !== IV_LEN) {
    throw new Error(`Invalid IV length: expected ${IV_LEN}, got ${iv.length}`);
  }
  if (authTag.length !== 16) {
    throw new Error(`Invalid authTag length: expected 16, got ${authTag.length}`);
  }
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}

/** Quick check used by /api/settings/ollama GET — never returns the key. */
export function isCryptoConfigured(): boolean {
  try {
    getMasterKey();
    return true;
  } catch {
    return false;
  }
}
