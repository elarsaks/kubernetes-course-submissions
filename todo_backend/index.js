const http = require("node:http");
const { Pool } = require("pg");
const { formatTodoSubmissionLog, validateTodo } = require("./todo");

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
const maxTodoLength = requirePositiveInteger("MAX_TODO_LENGTH");
const database = new Pool({
  host: requireEnv("POSTGRES_HOST"),
  port: requirePositiveInteger("POSTGRES_PORT"),
  database: requireEnv("POSTGRES_DB"),
  user: requireEnv("POSTGRES_USER"),
  password: requireEnv("POSTGRES_PASSWORD"),
});

database.on("error", (error) => {
  console.error("Unexpected PostgreSQL connection error", error);
});

const defaultTodos = [
  "Learn Kubernetes basics",
  "Deploy application to cluster",
  "Configure persistent volumes",
];

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

const logTodoSubmission = (level, details) => {
  const message = formatTodoSubmissionLog(level, details);
  if (level === "error") {
    console.error(message);
  } else if (level === "warn") {
    console.warn(message);
  } else {
    console.log(message);
  }
};

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/healthz") {
    sendText(res, 200, "ok");
    return;
  }

  if (req.method === "GET" && req.url === "/readyz") {
    try {
      await database.query("SELECT 1");
      sendText(res, 200, "ok");
    } catch (error) {
      console.error("Database readiness check failed", error);
      sendText(res, 503, "Database unavailable");
    }
    return;
  }

  if (req.method === "GET" && req.url === "/todos") {
    try {
      const result = await database.query(
        "SELECT id, content FROM todos ORDER BY id",
      );
      sendJson(res, 200, result.rows);
    } catch (error) {
      console.error("Could not read Todos", error);
      sendText(res, 503, "Database unavailable");
    }
    return;
  }

  if (req.method === "POST" && req.url === "/todos") {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      logTodoSubmission("warn", {
        outcome: "rejected",
        reason: "invalid_json",
        status: 400,
      });
      sendText(res, 400, "Invalid JSON");
      return;
    }

    const validation = validateTodo(body?.content, maxTodoLength);
    if (!validation.valid) {
      logTodoSubmission("warn", {
        outcome: "rejected",
        reason: validation.reason,
        content: validation.content,
        length: validation.length,
        maxLength: maxTodoLength,
        status: 400,
      });
      sendText(res, 400, `Todo must contain 1–${maxTodoLength} characters`);
      return;
    }

    const { content } = validation;
    try {
      const result = await database.query(
        "INSERT INTO todos (content) VALUES ($1) RETURNING id, content",
        [content],
      );
      logTodoSubmission("info", {
        outcome: "accepted",
        todoId: result.rows[0].id,
        content,
        length: validation.length,
        maxLength: maxTodoLength,
        status: 201,
      });
      sendJson(res, 201, result.rows[0]);
    } catch (error) {
      console.error("Could not save Todo", error);
      logTodoSubmission("error", {
        outcome: "failed",
        reason: "database_unavailable",
        content,
        length: validation.length,
        maxLength: maxTodoLength,
        status: 503,
      });
      sendText(res, 503, "Database unavailable");
    }
    return;
  }

  sendText(res, 404, "Not found");
});

const wait = (milliseconds) => new Promise((resolve) => {
  setTimeout(resolve, milliseconds);
});

const initializeDatabase = async () => {
  while (true) {
    try {
      await database.query(`
        CREATE TABLE IF NOT EXISTS todos (
          id BIGSERIAL PRIMARY KEY,
          content VARCHAR(${maxTodoLength}) NOT NULL CHECK (char_length(content) > 0),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await database.query(`
        INSERT INTO todos (content)
        SELECT content
        FROM (VALUES ($1), ($2), ($3)) AS defaults(content)
        WHERE NOT EXISTS (SELECT 1 FROM todos)
      `, defaultTodos);
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
    console.log(`Todo backend started in port ${port}`);
  });
});
