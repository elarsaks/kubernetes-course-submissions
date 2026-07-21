const http = require("node:http");
const { Pool } = require("pg");

const port = Number.parseInt(process.env.PORT ?? "", 10) || 3000;
const database = new Pool({
  host: process.env.POSTGRES_HOST ?? "postgres",
  port: Number.parseInt(process.env.POSTGRES_PORT ?? "", 10) || 5432,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
});

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/healthz") {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("ok\n");
    return;
  }

  if (req.method === "GET" && req.url === "/readyz") {
    try {
      await database.query("SELECT 1");
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("ok\n");
    } catch (error) {
      console.error("Database health check failed", error);
      res.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Database unavailable\n");
    }
    return;
  }

  if (req.method !== "GET" || req.url !== "/pingpong") {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found\n");
    return;
  }

  try {
    const result = await database.query(`
      INSERT INTO ping_pong_counter (id, counter)
      VALUES (1, 1)
      ON CONFLICT (id)
      DO UPDATE SET counter = ping_pong_counter.counter + 1
      RETURNING counter - 1 AS counter
    `);

    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(`pong ${result.rows[0].counter}\n`);
  } catch (error) {
    console.error("Failed to update counter", error);
    res.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Database unavailable\n");
  }
});

const wait = (milliseconds) => new Promise((resolve) => {
  setTimeout(resolve, milliseconds);
});

const initializeDatabase = async () => {
  while (true) {
    try {
      await database.query(`
        CREATE TABLE IF NOT EXISTS ping_pong_counter (
          id SMALLINT PRIMARY KEY CHECK (id = 1),
          counter BIGINT NOT NULL CHECK (counter >= 0)
        )
      `);
      return;
    } catch (error) {
      console.error("Database is not ready; retrying in two seconds", error);
      await wait(2000);
    }
  }
};

const shutdown = () => {
  server.close(() => {
    database.end().finally(() => process.exit(0));
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

initializeDatabase().then(() => {
  server.listen(port, () => {
    console.log(`Server started in port ${port}`);
  });
});
