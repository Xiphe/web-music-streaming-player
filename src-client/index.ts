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
    getLoginUrl(redirect: string = window.location.href) {
      return `${baseUrl}/login?${new URLSearchParams({
        redirect,
        baseUrl: !config.serverUrl.startsWith('http')
          ? `${window.location.origin}/${baseUrl.replace(/^\//, '')}`
          : baseUrl,
      }).toString()}`;
    },
    getLogoutUrl(redirect: string = window.location.href) {
      return `${baseUrl}/logout?${new URLSearchParams({
        redirect,
      }).toString()}`;
    },
    login(redirect?: string) {
      window.location.assign(this.getLoginUrl(redirect));
    },
    logout(redirect: string = window.location.href) {
      window.location.assign(this.getLogoutUrl(redirect));
    },
  });
}

export function isUnauthorized(err: unknown) {
  return err instanceof Error && (err as any).code === 401;
}
