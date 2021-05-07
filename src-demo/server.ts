import { createServer } from 'http';
import handler from 'serve-handler';
import path from 'path';

const port = process.env.PORT || '8080';

createServer((req, res) => {
  if (req.url?.startsWith('/api')) {
    res.writeHead(200);
    res.end('Hello, World!');
  } else {
    handler(req, res, { public: path.join(__dirname, 'public') });
  }
}).listen(port, undefined, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
