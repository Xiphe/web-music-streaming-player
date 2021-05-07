import { encrypt, decrypt } from './encrypt';

export interface SessionOptions {
  defaultExpires?: number;
  name?: string;
  path?: string;
  secret: string;
}
export type JsonSession = Record<string, any>;
export default function createSessionHandler({
  secret,
  path = '/',
  name = 'wmsp-session',
  defaultExpires = 1000 * 60 * 60 * 24 * 2,
}: SessionOptions) {
  const key = Buffer.from(secret, 'hex');

  return {
    read<Session extends JsonSession>(header?: string): Session | null {
      const raw = new URLSearchParams(header).get(name);
      if (raw === null) {
        return null;
      }

      return JSON.parse(decrypt(raw, key, 'base64'));
    },
    commit<Session extends JsonSession>(
      session: Session | null,
      expires: number = new Date().getTime() + defaultExpires,
    ) {
      if (session === null) {
        return `${name}=; Expires=${new Date().toUTCString()}; Path=${path}; HttpOnly;`;
      }

      return `${name}=${encodeURIComponent(
        encrypt(JSON.stringify(session), key, 'base64'),
      )}; Expires=${new Date(expires).toUTCString()}; Path=${path}; HttpOnly;`;
    },
  };
}
