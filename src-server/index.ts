import { IncomingMessage, ServerResponse } from 'http';
import type SpotifyWebAPI from 'spotify-web-api-node';
import { handleRpc } from 'typed-rpc/server';
import { v4 as uuid } from 'uuid';
import { Service } from './Service';
import createSessionHandler, { SessionOptions } from './session';

interface Options {
  basePath?: string;
  requiredScopes: string[];
  spotify: SpotifyWebAPI;
  session: SessionOptions;
}

class ServerError extends Error {
  statusCode: number;
  data?: unknown;

  constructor(message: string, statusCode: number, data?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.data = data;
    Object.setPrototypeOf(this, ServerError.prototype);
  }
}

function isRecord(data: unknown): data is Record<string, unknown> {
  return typeof data === 'object' && data !== null && !Array.isArray(data);
}

interface SpotifyAuth {
  accessToken: string;
  expires: number;
  refreshToken: string;
}
function isSpotifyAuth(data: unknown): data is SpotifyAuth {
  return (
    isRecord(data) &&
    typeof data.accessToken === 'string' &&
    typeof data.expires === 'number' &&
    typeof data.refreshToken === 'string'
  );
}

export default function createHandler({
  spotify,
  session: sessionOptions,
  requiredScopes,
  basePath: bp = '/api',
}: Options) {
  const basePath = bp.replace(/\/$/, '');
  const serviceImpl: Service = {
    async me() {
      return (await spotify.getMe()).body;
    },
  };
  const session = createSessionHandler(sessionOptions);

  async function checkAuth(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<boolean> {
    const data = session.read(request.headers.cookie);

    if (!data || !isSpotifyAuth(data.spotify)) {
      return false;
    }

    const { expires, accessToken, refreshToken } = data.spotify;
    if (expires > new Date().getTime() - 6000) {
      spotify.setRefreshToken(refreshToken);
      const {
        body: { expires_in, access_token },
      } = await spotify.refreshAccessToken();

      response.writeHead(200, {
        'Set-Cookie': session.commit({
          ...data,
          spotify: {
            refreshToken,
            accessToken: access_token,
            expires: new Date().getTime() + expires_in * 1000,
          },
        }),
      });

      spotify.setAccessToken(access_token);
      return true;
    } else {
      spotify.setAccessToken(accessToken);
      return true;
    }
  }

  return async (request: IncomingMessage, response: ServerResponse) => {
    try {
      if (
        request.url?.startsWith(`${basePath}/spotify/login?`) &&
        request.method === 'GET'
      ) {
        const params = new URLSearchParams(request.url.split('?')[1]);
        const redirect = params.get('redirect');
        const baseUrl = params.get('baseUrl');
        if (!baseUrl || !baseUrl.length) {
          throw new ServerError('Missing BaseUrl', 400);
        }

        const loginCallback = `${baseUrl.replace(/\/$/, '')}/login-callback`;
        spotify.setRedirectURI(loginCallback);
        const state = uuid();
        const url = spotify.createAuthorizeURL(requiredScopes, state);

        response.writeHead(302, {
          Location: url,
          'Set-Cookie': session.commit(
            { state, redirect, loginCallback },
            new Date().getTime() + 1000 * 60 * 30,
          ),
        });
        response.end();
      } else if (
        request.url?.startsWith(`${basePath}/spotify/login-callback?`) &&
        request.method === 'GET'
      ) {
        const params = new URLSearchParams(request.url.split('?')[1]);
        const code = params.get('code');
        const state = params.get('state');
        const error = params.get('error');

        if (error === 'access_denied') {
          throw new ServerError('Access Denied', 401);
        } else if (error || !code) {
          throw new ServerError(error || 'Missing Parameters', 500);
        }
        const data = session.read(request.headers.cookie);

        if (!data || data.state !== state) {
          throw new ServerError('Timed out', 400);
        }

        if (
          typeof data.loginCallback !== 'string' ||
          typeof data.redirect !== 'string'
        ) {
          throw new ServerError('Invalid session', 400);
        }

        spotify.setRedirectURI(data.loginCallback);
        const {
          body: { access_token, expires_in, refresh_token },
        } = await spotify.authorizationCodeGrant(code);

        response.writeHead(302, {
          Location: data.redirect,
          'Set-Cookie': session.commit({
            spotify: {
              accessToken: access_token,
              expires: new Date().getTime() + expires_in * 1000,
              refreshToken: refresh_token,
            },
          }),
        });
        response.end();
      } else if (
        request.url === `${basePath}/spotify` &&
        request.method === 'POST'
      ) {
        const body = await getJsonRpc(request);
        if (!(await checkAuth(request, response))) {
          response.write(
            JSON.stringify({
              jsonrpc: '2.0',
              id: body.id,
              error: { code: 401, message: 'Unauthorized' },
            }),
          );
        } else {
          response.write(JSON.stringify(await handleRpc(body, serviceImpl)));
        }

        response.end();
      }
    } catch (err) {
      if (err instanceof ServerError) {
        console.error(err.data || err.message);
        response.writeHead(err.statusCode);
        response.write(err.message);
      } else {
        console.error(err);
        response.writeHead(500);
        response.write('Server Error');
      }
      response.end();
    }
  };
}

function getJsonRpc(
  request: IncomingMessage,
): Promise<{ jsonrpc: '2.0'; id: number; method: string; params: unknown[] }> {
  return new Promise((resolve, reject) => {
    const body: Uint8Array[] = [];
    request
      .on('data', (chunk: Uint8Array) => body.push(chunk))
      .on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(body).toString()));
        } catch (err) {
          reject(new ServerError('Invalid input', 400, err));
        }
      })
      .on('error', (err) => reject(new ServerError('Invalid input', 400, err)));
  });
}
