const http = require("node:http");

const port = Number.parseInt(process.env.PORT ?? "", 10) || 3000;
let counter = 0;

const server = http.createServer((req, res) => {
  if (req.method !== "GET" || req.url !== "/pingpong") {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found\n");
    return;
  }

  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(`pong ${counter}\n`);
  counter += 1;
});

server.listen(port, () => {
  console.log(`Server started in port ${port}`);
});
