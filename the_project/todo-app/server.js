const http = require("node:http");

const port = Number.parseInt(process.env.PORT ?? "", 10) || 3000;

const server = http.createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Todo app coming soon\n");
});

server.listen(port, () => {
  console.log(`Server started in port ${port}`);
});
