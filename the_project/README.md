# Exercises 1.2 & 1.4 - Todo App

## Overview
These exercises deliver the initial Todo App server and its declarative Kubernetes deployment. The app starts an HTTP server that logs `Server started in port NNNN` on boot and responds with `Todo app coming soon`. The listening port is configurable via the `PORT` environment variable.

## For Course Graders

From the repository root, apply the declarative deployment and confirm the pod starts:
```bash
kubectl apply -f the_project/manifests/deployment.yaml
kubectl rollout status deployment/todo-app
kubectl logs -f deployment/todo-app
```

## Application Structure

### Files Created
- `todo-app/server.js` – Node.js HTTP server implementation
- `package.json` – Project metadata and start script
- `Dockerfile` – Container build definition
- `manifests/deployment.yaml` – Declarative Kubernetes deployment definition

### Application Code (`todo-app/server.js`)
```javascript
const http = require("node:http");

const port = Number.parseInt(process.env.PORT ?? "", 10) || 3000;

const server = http.createServer((_req, res) => {
	res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
	res.end("Todo app coming soon\n");
});

server.listen(port, () => {
	console.log(`Server started in port ${port}`);
});
```

The application:
- Reads the listening port from `process.env.PORT` (defaults to `3000`)
- Logs the start-up message when the server begins listening
- Returns a placeholder body until later exercises add real functionality

## Image Steps (Full Workflow)

### 1. Login to Docker Hub
```bash
docker login -u elarsaks
```

### 2. Build the Docker Image
```bash
docker build -t elarsaks/todo-app:1.0.0 ./the_project
```

### 3. Push to Docker Hub
```bash
docker push elarsaks/todo-app:1.0.0
```

### 4. Run the Container
```bash
docker run --rm -p 3000:3000 -e PORT=3000 elarsaks/todo-app:1.0.0
```

Example output:
```
Server started in port 3000
```

## Kubernetes Deployment

Deploy the Todo app using the declarative manifest:
```bash
kubectl apply -f the_project/manifests/deployment.yaml
```

Confirm Kubernetes created the deployment:
```bash
kubectl get deployments
kubectl rollout status deployment/todo-app
```

Follow the logs:
```bash
kubectl logs -f deployment/todo-app
```

## Configuration
- `PORT` – HTTP port exposed by the app (defaults to `3000`). Set the environment variable when running the container or in the deployment manifest to change it.

## Why Use Docker Hub?
- **Registry access**: Kubernetes pulls the image directly from Docker Hub.
- **Reproducibility**: Matches real-world workflows for sharing container images.
- **Course requirement**: Aligns with the DevOps with Kubernetes MOOC expectations.

## Cleanup
Remove the deployment when finished:
```bash
kubectl delete -f the_project/manifests/deployment.yaml
```
