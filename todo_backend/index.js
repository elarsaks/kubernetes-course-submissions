const http = require("node:http");

const requirePositiveInteger = (name) => {
  const value = Number(process.env[name] ?? "");
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
};

const port = requirePositiveInteger("PORT");
const maxTodoLength = requirePositiveInteger("MAX_TODO_LENGTH");
const todos = [
  { content: "Learn Kubernetes basics" },
  { content: "Deploy application to cluster" },
  { content: "Configure persistent volumes" },
];

const readBody = (req) => new Promise((resolve, reject) => {
  let body = "";
  req.on("data", (chunk) => { body += chunk; });
  req.on("end", () => resolve(body));
  req.on("error", reject);
});

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/todos") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(todos));
    return;
  }

  if (req.method === "POST" && req.url === "/todos") {
    try {
      const body = JSON.parse(await readBody(req));
      if (typeof body.content !== "string" || !body.content.trim() || body.content.length > maxTodoLength) {
        res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
        res.end(`Todo must contain 1–${maxTodoLength} characters\n`);
        return;
      }
      todos.push({ content: body.content.trim() });
      res.writeHead(201, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(todos.at(-1)));
    } catch {
      res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Invalid JSON\n");
    }
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Not found\n");
});

server.listen(port, () => console.log(`Todo backend started in port ${port}`));
