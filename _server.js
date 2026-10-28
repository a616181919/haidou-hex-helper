
const http = require("http");
const fs = require("fs");
const path = require("path");
const root = "D:\\DSH会话\\haidou-app";
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webp": "image/webp" };
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p === "/") p = "/index.html";
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end("not found"); return; }
  res.writeHead(200, { "Content-Type": mime[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
}).listen(18080, () => console.log("serving on 18080"));
