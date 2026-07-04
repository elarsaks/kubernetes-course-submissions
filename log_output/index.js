const crypto = require("crypto");

const id = crypto.randomUUID();
console.log("App started. Stored value:", id);

setInterval(() => {
  console.log(`${new Date().toISOString()}: ${id}`);
}, 5000);
