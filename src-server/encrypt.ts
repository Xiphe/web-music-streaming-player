import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
  createHash,
  BinaryToTextEncoding,
} from 'crypto';

const algorithm = 'aes-256-cbc';

export function encrypt(
  text: string,
  key: Buffer,
  encoding: BinaryToTextEncoding = 'hex',
) {
  const iv = randomBytes(16);
  const cipher = createCipheriv(algorithm, key, iv);
  const encrypted = cipher.update(text);
  const checksum = createHash('sha256', key).update(text).digest(encoding);
  return `${iv.toString(encoding)}:${checksum.substring(0, 4)}:${Buffer.concat([
    encrypted,
    cipher.final(),
  ]).toString(encoding)}`;
}

export function decrypt(
  text: string,
  key: Buffer,
  encoding: BinaryToTextEncoding = 'hex',
) {
  const [ivHex, check, encryptedData] = text.split(':');
  const iv = Buffer.from(ivHex, encoding);
  const encryptedText = Buffer.from(encryptedData, encoding);
  const decipher = createDecipheriv(algorithm, key, iv);
  const decrypted = decipher.update(encryptedText);
  const final = Buffer.concat([decrypted, decipher.final()]).toString();
  const checksum = createHash('sha256', key).update(final).digest(encoding);
  if (check !== checksum.substring(0, 4)) {
    throw new Error('Encryption checksum failed');
  }
  return final;
}
