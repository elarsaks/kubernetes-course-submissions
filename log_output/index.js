const http = require("node:http");
const crypto = require("node:crypto");

const id = crypto.randomUUID();
const port = Number.parseInt(process.env.PORT ?? "", 10) || 3000;

console.log("App started. Stored value:", id);

const getStatus = () => `${new Date().toISOString()}: ${id}\n`;

const server = http.createServer((req, res) => {
  if (req.method !== "GET" || (req.url !== "/" && req.url !== "/status")) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found\n");
    return;
  }

  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(getStatus());
});

server.listen(port, () => {
  console.log(`Server started in port ${port}`);
});

setInterval(() => {
  console.log(getStatus().trimEnd());
}, 5000);
