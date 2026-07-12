const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const port = Number.parseInt(process.env.PORT ?? "", 10) || 3000;
const file = path.join(process.env.SHARED_DIR ?? "/usr/src/app/files", "log.txt");

const server = http.createServer((req, res) => {
  if (req.method !== "GET" || (req.url !== "/" && req.url !== "/status")) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found\n");
    return;
  }

  fs.readFile(file, "utf8", (error, contents) => {
    if (error) {
      res.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Log is not available yet\n");
      return;
    }

    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(contents);
  });
});

server.listen(port, () => {
  console.log(`Server started in port ${port}`);
});
