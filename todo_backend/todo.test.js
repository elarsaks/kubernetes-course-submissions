const assert = require("node:assert/strict");
const test = require("node:test");
const { formatTodoSubmissionLog, validateTodo } = require("./todo");

test("accepts a Todo at the 140-character limit", () => {
  const result = validateTodo("x".repeat(140), 140);

  assert.deepEqual(result, {
    valid: true,
    content: "x".repeat(140),
    length: 140,
  });
});

test("rejects a Todo over the 140-character limit", () => {
  const result = validateTodo("x".repeat(141), 140);

  assert.deepEqual(result, {
    valid: false,
    reason: "too_long",
    content: "x".repeat(141),
    length: 141,
  });
});

test("trims a Todo before checking its length", () => {
  assert.deepEqual(validateTodo("  ship it  ", 140), {
    valid: true,
    content: "ship it",
    length: 7,
  });
});

test("rejects a missing or non-string Todo", () => {
  assert.deepEqual(validateTodo(undefined, 140), {
    valid: false,
    reason: "empty",
    content: "",
    length: 0,
  });
  assert.deepEqual(validateTodo({ text: "not a string" }, 140), {
    valid: false,
    reason: "empty",
    content: "",
    length: 0,
  });
});

test("counts Unicode code points as characters", () => {
  assert.deepEqual(validateTodo("🚀".repeat(140), 140), {
    valid: true,
    content: "🚀".repeat(140),
    length: 140,
  });
});

test("formats submission logs as parseable single-line JSON", () => {
  const message = formatTodoSubmissionLog("warn", {
    outcome: "rejected",
    reason: "too_long",
    content: "first line\nsecond line",
    length: 22,
    maxLength: 140,
    status: 400,
  });
  const parsed = JSON.parse(message);

  assert.equal(message.split("\n").length, 1);
  assert.equal(parsed.level, "warn");
  assert.equal(parsed.event, "todo_submission");
  assert.equal(parsed.outcome, "rejected");
  assert.equal(parsed.content, "first line\nsecond line");
  assert.match(parsed.timestamp, /^\d{4}-\d{2}-\d{2}T/);
});
