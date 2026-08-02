const http = require("node:http");
const { connect, StringCodec } = require("nats");

const requireEnv = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

const port = Number(requireEnv("PORT"));
const natsUrl = requireEnv("NATS_URL");
const natsSubject = requireEnv("NATS_SUBJECT");
const broadcastMode = process.env.BROADCAST_MODE || "forward";
const broadcastUrl = broadcastMode === "forward" ? requireEnv("BROADCAST_URL") : null;
const stringCodec = StringCodec();

if (!Number.isInteger(port) || port <= 0) {
  throw new Error("PORT must be a positive integer");
}

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/healthz") {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("ok\n");
    return;
  }
  res.writeHead(404);
  res.end();
});

const sendToGenericService = async ({ action, todo }) => {
  const message = action === "created" ? "A todo was created" : "A todo was updated";
  if (broadcastMode === "log") {
    console.log(`Received ${action} Todo ${todo.id}: ${message}`);
    return;
  }

  if (broadcastMode !== "forward") {
    throw new Error(`Unsupported BROADCAST_MODE: ${broadcastMode}`);
  }

  const response = await fetch(broadcastUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user: "bot",
      message,
      todo,
    }),
  });

  if (!response.ok) {
    throw new Error(`Generic service returned HTTP ${response.status}`);
  }
  console.log(`Broadcasted ${action} Todo ${todo.id}`);
};

const run = async () => {
  const natsConnection = await connect({ servers: natsUrl });
  console.log(`Connected to NATS at ${natsUrl}`);
  const subscription = natsConnection.subscribe(natsSubject, {
    queue: "broadcasters",
  });

  for await (const message of subscription) {
    try {
      await sendToGenericService(JSON.parse(stringCodec.decode(message.data)));
    } catch (error) {
      console.error("Could not broadcast Todo status", error);
    }
  }
};

server.listen(port, () => {
  console.log(`Broadcaster started in port ${port}`);
});

run().catch((error) => {
  console.error("Broadcaster stopped", error);
  process.exitCode = 1;
});
