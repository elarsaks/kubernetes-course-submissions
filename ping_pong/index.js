const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const port = Number.parseInt(process.env.PORT ?? "", 10) || 3000;
const counterFile = path.join(
  process.env.SHARED_DIR ?? "/usr/src/app/files",
  "ping-pong.txt",
);

fs.mkdirSync(path.dirname(counterFile), { recursive: true });
let counter = 0;
try {
  counter = Number.parseInt(fs.readFileSync(counterFile, "utf8"), 10) || 0;
} catch {
  fs.writeFileSync(counterFile, "0");
}

const server = http.createServer((req, res) => {
  if (req.method !== "GET" || req.url !== "/pingpong") {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found\n");
    return;
  }

  const response = `pong ${counter}\n`;
  counter += 1;
  fs.writeFileSync(counterFile, String(counter));

  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(response);
});

server.listen(port, () => {
  console.log(`Server started in port ${port}`);
});
