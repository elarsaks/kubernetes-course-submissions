const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const port = Number.parseInt(process.env.PORT ?? "", 10) || 3000;
const file = path.join(process.env.SHARED_DIR ?? "/usr/src/app/files", "log.txt");
const pingPongUrl = process.env.PING_PONG_URL ?? "http://ping-pong:3000/pingpong";

const getPingPongs = (callback) => {
  http.get(pingPongUrl, (response) => {
    let body = "";
    response.setEncoding("utf8");
    response.on("data", (chunk) => { body += chunk; });
    response.on("end", () => {
      if (response.statusCode !== 200) {
        callback(new Error(`Ping-pong returned HTTP ${response.statusCode}`));
        return;
      }
      const match = body.match(/pong\s+(\d+)/);
      callback(match ? null : new Error("Invalid ping-pong response"), match?.[1]);
    });
  }).on("error", callback);
};

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

    getPingPongs((pingError, pingPongs) => {
      if (pingError) {
        res.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Ping-pong is not available yet\n");
        return;
      }
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(`${contents}\nPing / Pongs: ${pingPongs}\n`);
    });
  });
});

server.listen(port, () => {
  console.log(`Server started in port ${port}`);
});
