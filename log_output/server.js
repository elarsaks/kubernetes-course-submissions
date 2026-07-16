const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const port = Number.parseInt(process.env.PORT ?? "", 10) || 3000;
const file = path.join(process.env.SHARED_DIR ?? "/usr/src/app/files", "log.txt");
const informationFile = process.env.INFORMATION_FILE ?? "/usr/src/app/config/information.txt";
const message = process.env.MESSAGE ?? "";
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

  Promise.all([
    fs.promises.readFile(file, "utf8"),
    fs.promises.readFile(informationFile, "utf8"),
  ]).then(([contents, information]) => {
    const latestLogLine = contents.trimEnd().split("\n").at(-1);

    getPingPongs((pingError, pingPongs) => {
      if (pingError) {
        res.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Ping-pong is not available yet\n");
        return;
      }
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(
        `file content: ${information.trimEnd()}\n` +
        `env variable: MESSAGE=${message}\n` +
        `${latestLogLine}\n` +
        `Ping / Pongs: ${pingPongs}\n`,
      );
    });
  }).catch(() => {
    res.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Configuration or log is not available yet\n");
  });
});

server.listen(port, () => {
  console.log(`Server started in port ${port}`);
});
