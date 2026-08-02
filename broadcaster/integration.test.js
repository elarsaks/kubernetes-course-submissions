const assert = require("node:assert/strict");
const http = require("node:http");
const { execFileSync, spawn, spawnSync } = require("node:child_process");
const { once } = require("node:events");
const test = require("node:test");
const { connect, StringCodec } = require("nats");

const broadcasterDirectory = __dirname;
const codec = StringCodec();
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const getFreePort = async () => {
  const server = http.createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
};

const startNats = () => {
  const docker = spawnSync("docker", [
    "run", "--rm", "-d", "-p", "127.0.0.1::4222", "nats:2.10-alpine",
  ], { encoding: "utf8" });
  if (docker.error || docker.status !== 0) {
    throw new Error("Docker is required for the broadcaster integration test");
  }

  const containerId = docker.stdout.trim();
  const portOutput = execFileSync("docker", ["port", containerId, "4222/tcp"], {
    encoding: "utf8",
  });
  const port = Number(portOutput.trim().split(":").pop());
  return { containerId, url: `nats://127.0.0.1:${port}` };
};

const stopNats = (containerId) => {
  spawnSync("docker", ["rm", "-f", containerId], { stdio: "ignore" });
};

test("six broadcaster replicas deliver each NATS event at most once", async (t) => {
  const nats = startNats();
  t.after(() => stopNats(nats.containerId));

  const received = [];
  const receiver = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      received.push(JSON.parse(body));
      res.writeHead(200);
      res.end("ok");
    });
  });
  receiver.listen(0, "127.0.0.1");
  await once(receiver, "listening");
  t.after(() => new Promise((resolve) => receiver.close(resolve)));
  const receiverPort = receiver.address().port;

  const subject = `integration.todos.status.${process.pid}`;
  const broadcasterProcesses = [];
  const connected = [];
  for (let index = 0; index < 6; index += 1) {
    const broadcasterProcess = spawn(global.process.execPath, ["index.js"], {
      cwd: broadcasterDirectory,
      env: {
        ...process.env,
        PORT: String(await getFreePort()),
        NATS_URL: nats.url,
        NATS_SUBJECT: subject,
        BROADCAST_MODE: "forward",
        BROADCAST_URL: `http://127.0.0.1:${receiverPort}/broadcast`,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    broadcasterProcesses.push(broadcasterProcess);
    connected.push(new Promise((resolve, reject) => {
      broadcasterProcess.stdout.on("data", (chunk) => {
        if (chunk.toString().includes("Connected to NATS")) resolve();
      });
      broadcasterProcess.once("exit", (code) => reject(new Error(`Broadcaster exited with ${code}`)));
    }));
  }
  t.after(() => broadcasterProcesses.forEach((process) => process.kill("SIGTERM")));
  await Promise.all(connected);

  const publisher = await connect({ servers: nats.url });
  const events = Array.from({ length: 100 }, (_, index) => ({
    action: "created",
    todo: { id: index + 1, content: `integration test ${index + 1}`, done: false },
  }));
  for (const event of events) {
    publisher.publish(subject, codec.encode(JSON.stringify(event)));
  }
  await publisher.flush();

  const deadline = Date.now() + 10000;
  while (received.length < events.length && Date.now() < deadline) await wait(100);
  await publisher.drain();

  assert.equal(received.length, events.length);
  const receivedIds = received.map(({ todo }) => todo.id);
  assert.equal(new Set(receivedIds).size, receivedIds.length);
  assert.deepEqual([...receivedIds].sort((a, b) => a - b), events.map(({ todo }) => todo.id));
});
