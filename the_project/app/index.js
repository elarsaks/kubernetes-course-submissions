const http = require("node:http");
const https = require("node:https");
const fs = require("node:fs");
const path = require("node:path");

const port = Number.parseInt(process.env.PORT ?? "", 10) || 3000;
const cacheDir = process.env.CACHE_DIR ?? "/usr/src/app/files";
const imagePath = path.join(cacheDir, "image.jpg");
const imageUrl = "https://picsum.photos/1200";
const cacheDurationMs = 10 * 60 * 1000;
let refreshPromise;
const todos = [
  "Learn Kubernetes basics",
  "Deploy application to cluster",
  "Configure persistent volumes",
];

fs.mkdirSync(cacheDir, { recursive: true });

const downloadImage = (url, redirects = 0) => new Promise((resolve, reject) => {
  if (redirects > 5) {
    reject(new Error("Too many redirects while downloading image"));
    return;
  }

  https.get(url, (response) => {
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

const server = http.createServer(async (req, res) => {
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

    const todoItems = todos.map((todo) => `<li>${todo}</li>`).join("\n");
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
      ul { list-style: none; margin: 0; padding: 0; }
      li { background: #fafafa; border-left: 6px solid #4caf50; border-radius: 6px; box-shadow: 0 2px 8px #00000012; font-size: 1.35rem; margin: 16px 0; padding: 22px 28px; }
      @media (max-width: 600px) { form { flex-direction: column; } button { padding: 14px; } }
    </style>
  </head>
  <body>
    <h1>Todo App</h1>
    <img class="image" src="/image.jpg" alt="Random cached picture">
    <form onsubmit="return false">
      <input type="text" maxlength="140" placeholder="Enter a new todo (max 140 characters)">
      <button type="submit">Send</button>
    </form>
    <h2>Todos</h2>
    <ul>${todoItems}</ul>
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
