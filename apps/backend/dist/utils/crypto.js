"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptString = encryptString;
exports.decryptString = decryptString;
const node_crypto_1 = __importDefault(require("node:crypto"));
function encryptString(plaintext, keyBase64) {
    const key = Buffer.from(keyBase64, "base64");
    if (key.length !== 32) {
        throw new Error("ENCRYPTION_KEY_BASE64 must be 32 bytes (base64-encoded)");
    }
    const iv = node_crypto_1.default.randomBytes(12); // recommended length for GCM
    const cipher = node_crypto_1.default.createCipheriv("aes-256-gcm", key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
        ciphertextB64: ciphertext.toString("base64"),
        ivB64: iv.toString("base64"),
        tagB64: tag.toString("base64")
    };
}
function decryptString(enc, keyBase64) {
    const key = Buffer.from(keyBase64, "base64");
    if (key.length !== 32) {
        throw new Error("ENCRYPTION_KEY_BASE64 must be 32 bytes (base64-encoded)");
    }
    const iv = Buffer.from(enc.ivB64, "base64");
    const tag = Buffer.from(enc.tagB64, "base64");
    const ciphertext = Buffer.from(enc.ciphertextB64, "base64");
    const decipher = node_crypto_1.default.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString("utf8");
}
