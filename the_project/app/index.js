const http = require("node:http");
const https = require("node:https");
const fs = require("node:fs");
const path = require("node:path");

const requireEnv = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

const requirePositiveInteger = (name) => {
  const value = Number(requireEnv(name));
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
};

const port = requirePositiveInteger("PORT");
const imagePath = path.resolve(requireEnv("IMAGE_PATH"));
const imageUrl = requireEnv("IMAGE_URL");
const todoBackendUrl = requireEnv("TODO_BACKEND_URL");
const cacheDurationMs = requirePositiveInteger("CACHE_DURATION_MS");
const maxImageRedirects = requirePositiveInteger("MAX_IMAGE_REDIRECTS");
const maxTodoLength = requirePositiveInteger("MAX_TODO_LENGTH");
let isHealthy = true;
let refreshPromise;

fs.mkdirSync(path.dirname(imagePath), { recursive: true });

const clientFor = (url) => {
  const protocol = new URL(url).protocol;
  if (protocol === "http:") return http;
  if (protocol === "https:") return https;
  throw new Error(`Unsupported URL protocol: ${protocol}`);
};

const downloadImage = (url, redirects = 0) => new Promise((resolve, reject) => {
  if (redirects > maxImageRedirects) {
    reject(new Error("Too many redirects while downloading image"));
    return;
  }

  clientFor(url).get(url, (response) => {
    if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
      response.resume();
      downloadImage(new URL(response.headers.location, url).toString(), redirects + 1)
        .then(resolve)
        .catch(reject);
      return;
    }

    if (response.statusCode !== 200) {
      response.resume();
      reject(new Error(`Image request returned HTTP ${response.statusCode}`));
      return;
    }

    const temporaryPath = `${imagePath}.tmp`;
    const file = fs.createWriteStream(temporaryPath);
    response.pipe(file);
    file.on("finish", () => {
      file.close(() => fs.rename(temporaryPath, imagePath, resolve));
    });
    file.on("error", reject);
    response.on("error", reject);
  }).on("error", reject);
});

const imageIsFresh = async () => {
  try {
    const stats = await fs.promises.stat(imagePath);
    return Date.now() - stats.mtimeMs < cacheDurationMs;
  } catch {
    return false;
  }
};

const ensureImage = async () => {
  if (await imageIsFresh()) return;

  if (!refreshPromise) {
    refreshPromise = downloadImage(imageUrl).finally(() => {
      refreshPromise = undefined;
    });
  }

  try {
    await refreshPromise;
  } catch (error) {
    try {
      await fs.promises.access(imagePath);
      console.warn("Using stale cached image:", error.message);
    } catch {
      throw error;
    }
  }
};

const requestTodos = (options = {}, body) => new Promise((resolve, reject) => {
  const request = clientFor(todoBackendUrl).request(todoBackendUrl, options, (response) => {
    let contents = "";
    response.setEncoding("utf8");
    response.on("data", (chunk) => { contents += chunk; });
    response.on("end", () => {
      if (response.statusCode < 200 || response.statusCode >= 300) {
        reject(new Error(`Todo backend returned HTTP ${response.statusCode}`));
        return;
      }
      try {
        resolve(JSON.parse(contents));
      } catch (error) {
        reject(error);
      }
    });
  });
  request.on("error", reject);
  if (body) request.write(body);
  request.end();
});

const readBody = (req) => new Promise((resolve, reject) => {
  let body = "";
  req.on("data", (chunk) => { body += chunk; });
  req.on("end", () => resolve(body));
  req.on("error", reject);
});

const sendText = (res, status, message) => {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(`${message}\n`);
};

const sendJson = (res, status, value) => {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(value));
};

const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const server = http.createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/break") {
    isHealthy = false;
    sendJson(res, 200, { status: "unhealthy" });
    return;
  }

  if (req.method === "GET" && req.url === "/healthz") {
    if (!isHealthy) {
      sendJson(res, 500, { status: "unhealthy" });
      return;
    }
    sendJson(res, 200, { status: "ok" });
    return;
  }

  if (req.method === "GET" && req.url === "/readyz") {
    if (!isHealthy) {
      sendJson(res, 503, { status: "unhealthy" });
      return;
    }
    try {
      await requestTodos();
      sendJson(res, 200, { status: "ok" });
    } catch (error) {
      console.error("Todo backend readiness check failed", error);
      sendJson(res, 503, { status: "Todo backend unavailable" });
    }
    return;
  }

  if (!isHealthy) {
    sendText(res, 503, "Application is intentionally broken");
    return;
  }

  if (req.method === "POST" && req.url === "/todos") {
    try {
      const body = await readBody(req);
      const content = new URLSearchParams(body).get("content")?.trim();
      if (!content || content.length > maxTodoLength) {
        res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
        res.end(`Todo must contain 1–${maxTodoLength} characters\n`);
        return;
      }
      await requestTodos({ method: "POST", headers: { "Content-Type": "application/json" } }, JSON.stringify({ content }));
      res.writeHead(303, { Location: "/" });
      res.end();
    } catch (error) {
      console.error("Could not create todo:", error);
      res.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Todo backend is not available\n");
    }
    return;
  }

  if (req.method !== "GET" || (req.url !== "/" && req.url !== "/image.jpg")) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found\n");
    return;
  }

  try {
    await ensureImage();

    if (req.url === "/image.jpg") {
      res.writeHead(200, { "Content-Type": "image/jpeg" });
      fs.createReadStream(imagePath).pipe(res);
      return;
    }

    const todos = await requestTodos();
    const todoItems = todos.map((todo) => {
      const done = todo.done === true;
      const action = done
        ? '<span class="done-label">Done</span>'
        : `<button class="done-button" data-todo-id="${todo.id}" type="button">Mark done</button>`;
      return `<li class="${done ? "done" : ""}"><span>${escapeHtml(todo.content)}</span>${action}</li>`;
    }).join("\n");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Todo App</title>
    <style>
      :root { font-family: Arial, sans-serif; color: #292929; }
      body { margin: 0 auto; max-width: 1000px; padding: 32px 20px 60px; }
      h1, h2 { text-align: center; }
      h1 { font-size: 3rem; margin: 8px 0 28px; }
      h2 { font-size: 2rem; margin: 34px 0 18px; }
      .image { display: block; width: min(100%, 400px); height: 400px; object-fit: cover; margin: 0 auto 80px; border-radius: 14px; }
      form { display: flex; gap: 18px; margin: 0 auto; max-width: 850px; }
      input { flex: 1; min-width: 0; border: 3px solid #4caf50; border-radius: 6px; font-size: 1.3rem; padding: 14px 18px; }
      button { border: 0; border-radius: 6px; background: #4caf50; color: white; cursor: pointer; font-size: 1.3rem; padding: 0 34px; }
      button:hover { background: #3d9641; }
      .break-button { display: block; margin: 38px auto 0; background: #e05252; padding: 14px 24px; }
      .break-button:hover { background: #c63f3f; }
      ul { list-style: none; margin: 0; padding: 0; }
      li { align-items: center; background: #fafafa; border-left: 6px solid #4caf50; border-radius: 6px; box-shadow: 0 2px 8px #00000012; display: flex; font-size: 1.35rem; gap: 18px; justify-content: space-between; margin: 16px 0; padding: 16px 28px; }
      li.done { border-left-color: #999; color: #666; }
      li.done > span:first-child { text-decoration: line-through; }
      .done-button { background: #1976d2; font-size: 1rem; padding: 12px 18px; }
      .done-button:hover { background: #125ca5; }
      .done-label { color: #2e7d32; font-weight: bold; white-space: nowrap; }
      @media (max-width: 600px) { form { flex-direction: column; } button { padding: 14px; } }
    </style>
  </head>
  <body>
    <h1>Todo App</h1>
    <img class="image" src="/image.jpg" alt="Random cached picture">
    <form method="post" action="/todos">
      <input type="text" name="content" maxlength="${maxTodoLength}" required placeholder="Enter a new todo (max ${maxTodoLength} characters)">
      <button type="submit">Send</button>
    </form>
    <h2>Todos</h2>
    <ul>${todoItems}</ul>
    <button id="break-button" class="break-button" type="button">break the app</button>
    <script>
      document.querySelectorAll(".done-button").forEach((button) => {
        button.addEventListener("click", async () => {
          const response = await fetch("/todos/" + button.dataset.todoId, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ done: true }),
          });
          if (response.ok) window.location.reload();
        });
      });
      document.getElementById("break-button").addEventListener("click", async () => {
        await fetch("/break", { method: "POST" });
      });
    </script>
  </body>
</html>
`);
  } catch (error) {
    console.error("Could not provide image:", error);
    res.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Image is not available\n");
  }
});

server.listen(port, () => {
  console.log(`Server started in port ${port}`);
});
