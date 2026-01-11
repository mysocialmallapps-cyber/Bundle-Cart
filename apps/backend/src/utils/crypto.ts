import crypto from "node:crypto";

type EncryptedString = {
  ciphertextB64: string;
  ivB64: string;
  tagB64: string;
};

export function encryptString(plaintext: string, keyBase64: string): EncryptedString {
  const key = Buffer.from(keyBase64, "base64");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY_BASE64 must be 32 bytes (base64-encoded)");
  }

  const iv = crypto.randomBytes(12); // recommended length for GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    ciphertextB64: ciphertext.toString("base64"),
    ivB64: iv.toString("base64"),
    tagB64: tag.toString("base64")
  };
}

export function decryptString(
  enc: EncryptedString,
  keyBase64: string
): string {
  const key = Buffer.from(keyBase64, "base64");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY_BASE64 must be 32 bytes (base64-encoded)");
  }

  const iv = Buffer.from(enc.ivB64, "base64");
  const tag = Buffer.from(enc.tagB64, "base64");
  const ciphertext = Buffer.from(enc.ciphertextB64, "base64");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}

