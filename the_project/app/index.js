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

    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>The Project</title></head>
  <body><h1>The Project</h1><img src="/image.jpg" alt="Random cached picture"></body>
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
