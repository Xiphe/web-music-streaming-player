import { createServer } from 'http';
import handler from 'serve-handler';
import path from 'path';
import { config } from 'dotenv';
import SpotifyWebAPI from 'spotify-web-api-node';
import createHandler from '../src-server';

config({ path: path.join(__dirname, '.env') });

const port = process.env.PORT || '8080';

const spotify = new SpotifyWebAPI({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
});

const apiHandler = createHandler({
  spotify,
  session: {
    path: '/api',
    secret: process.env.SESSION_SECRET!,
  },
  basePath: '/api',
  requiredScopes: [],
});
createServer((req, res) => {
  if (req.url?.startsWith('/api')) {
    apiHandler(req, res);
  } else {
    handler(req, res, { public: path.join(__dirname, 'public') });
  }
}).listen(port, undefined, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
