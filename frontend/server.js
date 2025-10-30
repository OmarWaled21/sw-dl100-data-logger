// server.js
const { createServer } = require("http");
const next = require("next");
const fs = require("fs");
const path = require("path");

const dev = false; // لازم يكون false في النسخة النهائية
const app = next({ dev, dir: __dirname });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    // ✅ endpoint لقراءة config.json خارجي
    if (req.url === "/external-config") {
      const configPath = path.join(process.cwd(), "config.json"); // ضع هنا المسار الخارجي للملف
      fs.readFile(configPath, "utf-8", (err, data) => {
        if (err) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Cannot read config.json" }));
        } else {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(data);
        }
      });
      return;
    }

    // التعامل مع باقي الطلبات Next.js
    handle(req, res);
  });

  const port = 3000;
  server.listen(port, "0.0.0.0", () => {
    console.log(`✅ Next.js server running at http://localhost:${port}`);
  });
});
