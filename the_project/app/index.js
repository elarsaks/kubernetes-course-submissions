const http = require("node:http");
const crypto = require("node:crypto");

const port = Number.parseInt(process.env.PORT ?? "", 10) || 3000;
const applicationHash = crypto.randomBytes(8).toString("hex");

const server = http.createServer((req, res) => {
  if (req.method !== "GET" || req.url !== "/") {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found\n");
    return;
  }

  const requestHash = crypto.randomBytes(8).toString("hex");

  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(`Application ${applicationHash}. Request ${requestHash}\n`);
});

server.listen(port, () => {
  console.log(`Server started in port ${port}`);
});
