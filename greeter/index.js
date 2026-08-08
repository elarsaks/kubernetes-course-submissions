const http = require("node:http");

const port = Number.parseInt(process.env.PORT ?? "", 10) || 3000;
const greeting = process.env.GREETING ?? "Hello from greeter";

const server = http.createServer((request, response) => {
  if (request.method !== "GET" || request.url !== "/") {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found\n");
    return;
  }

  response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  response.end(`${greeting}\n`);
});

server.listen(port, () => {
  console.log(`Greeter listening on port ${port}: ${greeting}`);
});
