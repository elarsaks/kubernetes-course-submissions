# Exercise 2.10 - The Project, Step 13

The Todo backend writes a structured JSON log for every Todo submission. Accepted, rejected, and database-failed submissions use the `todo_submission` event name and include the submitted content, character count, outcome, and HTTP status. Loki can therefore collect the container output and Grafana can show both successful Todos and messages rejected by backend validation.

The backend independently enforces the configured `MAX_TODO_LENGTH` of 140 characters. The HTML input limit remains a convenience for browser users, but API clients cannot bypass the backend limit. PostgreSQL also retains its `VARCHAR(140)` constraint.

## Build and deploy

Starting from a running exercise 2.9 deployment, build and publish the updated backend:

```bash
docker build -t elarsaks/todo-backend:2.10.0 ./todo_backend
docker push elarsaks/todo-backend:2.10.0

kubectl apply -f the_project/manifests/configmap.yaml
kubectl apply -f todo_backend/manifests/deployment.yaml
kubectl rollout status deployment/todo-backend -n project
```

For k3d development, import the image instead of pushing it:

```bash
k3d image import elarsaks/todo-backend:2.10.0 -c k3s-default
```

## Verify request logging and validation

Forward the backend service to a separate local port:

```bash
kubectl port-forward -n project svc/todo-backend 3001:3000
```

In another terminal, submit an allowed Todo and then a 141-character Todo:

```bash
curl -i http://localhost:3001/todos \
  -H 'Content-Type: application/json' \
  --data '{"content":"Observe this Todo"}'

node -e 'process.stdout.write(JSON.stringify({content: "x".repeat(141)}))' | \
  curl -i http://localhost:3001/todos \
    -H 'Content-Type: application/json' \
    --data-binary @-
```

The first request returns `201 Created`. The oversized request returns `400 Bad Request` with:

```text
Todo must contain 1–140 characters
```

The same events are visible directly in the Pod logs:

```bash
kubectl logs -n project deployment/todo-backend --tail=20
```

After installing the course monitoring stack and opening Grafana's Loki datasource, show every backend Todo submission with:

```logql
{namespace="project"} |= "todo_submission"
```

Show only rejected submissions with:

```logql
{namespace="project"} |= "todo_submission" |= "rejected"
```

The rejected JSON log includes `"reason":"too_long"`, the attempted `content`, `"length":141`, `"maxLength":140`, and `"status":400`.

## Run backend tests

```bash
cd todo_backend
npm test
```

The tests cover the 140/141-character boundary, trimming, Unicode character counting, and single-line JSON log formatting.
