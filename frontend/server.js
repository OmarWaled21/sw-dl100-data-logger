// server.js
const { createServer } = require("http");
const next = require("next");

const dev = false; // لازم يكون false في النسخة النهائية
const app = next({ dev, dir: __dirname });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => handle(req, res));
  const port = 3000;

  server.listen(port, () => {
    console.log(`✅ Next.js server running at http://localhost:${port}`);
  });
});
