# Exercise 1.1 & 1.3 - Log Output Application

## Overview
This exercise demonstrates creating a simple Node.js application that generates a random UUID on startup and logs it every 5 seconds, then deploying it to a local Kubernetes cluster using k3d.

## For Course Graders

From the repository root, apply the declarative deployment and confirm the logs:
```bash
kubectl apply -f log_output/manifests/deployment.yaml
kubectl rollout restart deployment/log-output
kubectl logs -f deployment/log-output
```

This ensures the deployment is managed declaratively and that the pod is emitting log lines.

## Application Structure

### Files Created
- `index.js` - Main application that generates and logs a UUID
- `package.json` - Node.js project configuration
- `Dockerfile` - Container image definition
- `manifests/deployment.yaml` - Declarative Kubernetes deployment definition

### Application Code (`index.js`)
```javascript
const crypto = require("crypto");

const id = crypto.randomUUID();
console.log("App started. Stored value:", id);

setInterval(() => {
  console.log(`${new Date().toISOString()}: ${id}`);
}, 5000);
```

The application:
- Generates ONE random UUID on startup using `crypto.randomUUID()`
- Stores the UUID in memory
- Prints the same UUID every 5 seconds with an ISO timestamp

## Deployment Steps (Full Workflow)

Follow this path when you want to build, push, and deploy the application yourself.

### 0. Start or Create the Local k3d Cluster
Use the course default cluster name:
```bash
k3d cluster start k3s-default
```

If the cluster does not exist yet, create it:
```bash
k3d cluster create k3s-default
kubectl config use-context k3d-k3s-default
```

Confirm Kubernetes is reachable before applying manifests:
```bash
kubectl get nodes
```

If `kubectl get nodes` fails with `write: broken pipe` and your kubeconfig shows `server: https://0.0.0.0:<port>`, update the same port to use `127.0.0.1` instead. For example:
```bash
kubectl config view --minify
kubectl config set-cluster k3d-k3s-default --server=https://127.0.0.1:51802
kubectl get nodes
```

The port can differ between machines, so keep the port from your own kubeconfig.

### 1. Login to Docker Hub
First, authenticate with Docker Hub:
```bash
docker login -u elarsaks
```

### 2. Build the Docker Image
Build the image with your Docker Hub username:
```bash
docker build -t elarsaks/log-output:1.1.0 ./log_output
```

### 3. Push to Docker Hub
Push the image to Docker Hub so Kubernetes can pull it:
```bash
docker push elarsaks/log-output:1.1.0
```

### 4. Apply Kubernetes Manifest
Deploy using the declarative manifest (from the repository root):
```bash
kubectl apply -f log_output/manifests/deployment.yaml
```

If you are already inside the `log_output/` directory you can drop the `log_output/` prefix.

Output:
```
deployment.apps/log-output configured
```

### 5. Restart Deployment to Confirm Fresh Pods
```bash
kubectl rollout restart deployment/log-output
```

This guarantees the pod is recreated from the latest manifest definition.

### 6. Verify Deployment
```bash
kubectl get deployments
```

Output:
```
NAME         READY   UP-TO-DATE   AVAILABLE   AGE
log-output   1/1     1            1           46s
```

### 7. View Application Logs
View the application logs:
```bash
kubectl logs -f deployment/log-output
```

Example output:
```
> log_output@1.1.0 start
> node index.js

App started. Stored value: 2e72edec-87b9-4c14-bfe9-0348828edbe3
2025-11-08T19:21:02.462Z: 2e72edec-87b9-4c14-bfe9-0348828edbe3
2025-11-08T19:21:07.468Z: 2e72edec-87b9-4c14-bfe9-0348828edbe3
2025-11-08T19:21:12.479Z: 2e72edec-87b9-4c14-bfe9-0348828edbe3
2025-11-08T19:21:17.486Z: 2e72edec-87b9-4c14-bfe9-0348828edbe3
2025-11-08T19:21:22.493Z: 2e72edec-87b9-4c14-bfe9-0348828edbe3
2025-11-08T19:21:27.498Z: 2e72edec-87b9-4c14-bfe9-0348828edbe3
2025-11-08T19:21:32.500Z: 2e72edec-87b9-4c14-bfe9-0348828edbe3
```

## Key Observations

✅ The application successfully:
- Starts and generates a UUID stored in memory
- Logs the **same UUID** every 5 seconds
- Includes ISO 8601 timestamps in each log entry
- Runs successfully in a Kubernetes pod
- Image is pulled from Docker Hub registry

## Why Use Docker Hub?
- **Registry requirement**: Kubernetes clusters pull images from registries
- **Portability**: Works across different Kubernetes environments (not just k3d)
- **Best practice**: Simulates real-world deployment workflows
- **Course expectation**: Required for the DevOps with Kubernetes MOOC

## Technologies Used
- **Node.js 22** (Alpine Linux base image)
- **Docker** for containerization
- **Docker Hub** for image registry
- **k3d** for local Kubernetes cluster
- **kubectl** for Kubernetes management

## Cleanup
To remove the deployment:
```bash
kubectl delete -f log_output/manifests/deployment.yaml
```

If your shell is already in `log_output/`, omit the leading directory name.
