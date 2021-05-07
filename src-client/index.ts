import { rpcClient } from 'typed-rpc';
import { Service } from '../src-server/Service';

interface Config {
  serverUrl: string;
}

const DEFAULTS: Config = { serverUrl: '/api' };

export function spotify(userConfig: Partial<Config> = {}) {
  const config = { ...DEFAULTS, ...userConfig };
  const baseUrl = `${config.serverUrl.replace(/\/$/, '')}/spotify`;
  const client = rpcClient<Service>(baseUrl);

  return Object.assign(client, {
    login(redirect: string = window.location.href) {
      window.location.assign(
        `${baseUrl}/login?${new URLSearchParams({
          redirect,
          baseUrl: !config.serverUrl.startsWith('http')
            ? `${window.location.origin}/${baseUrl.replace(/^\//, '')}`
            : baseUrl,
        }).toString()}`,
      );
    },
  });
}

export function isUnauthorized(err: unknown) {
  return err instanceof Error && (err as any).code === 401;
}
