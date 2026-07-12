const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const id = crypto.randomUUID();
const file = path.join(process.env.SHARED_DIR ?? "/usr/src/app/files", "log.txt");

fs.mkdirSync(path.dirname(file), { recursive: true });

const writeLog = () => {
  const line = `${new Date().toISOString()}: ${id}\n`;
  fs.appendFileSync(file, line);
  console.log(line.trimEnd());
};

console.log("Writer started. Stored value:", id);
writeLog();
setInterval(writeLog, 5000);
