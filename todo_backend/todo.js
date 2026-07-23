const countCharacters = (value) => Array.from(value).length;

const validateTodo = (value, maxLength) => {
  const content = typeof value === "string" ? value.trim() : "";
  const length = countCharacters(content);

  if (length === 0) {
    return { valid: false, reason: "empty", content, length };
  }

  if (length > maxLength) {
    return { valid: false, reason: "too_long", content, length };
  }

  return { valid: true, content, length };
};

const formatTodoSubmissionLog = (level, details) => JSON.stringify({
  timestamp: new Date().toISOString(),
  level,
  event: "todo_submission",
  ...details,
});

module.exports = { formatTodoSubmissionLog, validateTodo };
