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

const todoBackendUrl = requireEnv("TODO_BACKEND_URL");
const wikipediaRandomUrl = requireEnv("WIKIPEDIA_RANDOM_URL");
const maxTodoLength = requirePositiveInteger("MAX_TODO_LENGTH");
const maxRedirectAttempts = requirePositiveInteger("MAX_WIKIPEDIA_REDIRECT_ATTEMPTS");
const userAgent = "kubernetes-course-todo-generator/2.9 (github.com/elarsaks/kubernetes-course-submissions)";

const getRandomArticleTodo = async () => {
  for (let attempt = 1; attempt <= maxRedirectAttempts; attempt += 1) {
    const response = await fetch(wikipediaRandomUrl, {
      redirect: "manual",
      headers: { "User-Agent": userAgent },
    });
    await response.body?.cancel();

    const location = response.headers.get("location");
    if (!location || ![301, 302, 303, 307, 308].includes(response.status)) {
      throw new Error(`Wikipedia returned HTTP ${response.status} without a redirect`);
    }

    const articleUrl = new URL(location, wikipediaRandomUrl).toString();
    const content = `Read ${articleUrl}`;
    if (content.length <= maxTodoLength) return content;

    console.warn(`Random article URL from attempt ${attempt} exceeded the Todo length limit`);
  }

  throw new Error(`Could not find an article URL within ${maxTodoLength} characters`);
};

const main = async () => {
  const content = await getRandomArticleTodo();
  const response = await fetch(todoBackendUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  const responseBody = await response.text();

  if (!response.ok) {
    throw new Error(`Todo backend returned HTTP ${response.status}: ${responseBody.trim()}`);
  }

  console.log(`Created Todo: ${content}`);
};

main().catch((error) => {
  console.error("Could not create the random Wikipedia Todo", error);
  process.exitCode = 1;
});
