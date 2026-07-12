# Exercise 1.10 - Even More Services

## Overview
The Log output application is split into two containers in one Pod. The writer generates one random UUID and appends a timestamp plus UUID to a shared file every five seconds. The HTTP server reads that file and serves it at `/`.

## For Course Graders

From the repository root, apply the declarative deployment and confirm the logs:
```bash
kubectl apply -f log_output/manifests/deployment.yaml
kubectl rollout restart deployment/log-output
kubectl logs -f deployment/log-output -c log-writer
kubectl logs -f deployment/log-output -c log-server
```

Then open the application through the cluster Ingress:
```bash
curl http://localhost:8081/
curl http://localhost:8081/status
```

This ensures the deployment is managed declaratively, the pod is emitting log lines, and the current status is reachable through the browser.

## Application Structure

### Files
- `writer.js` - Generates the UUID and writes timestamped lines to the shared file
- `server.js` - Serves the shared file over HTTP
- `index.js` - Keeps the default local package entry point compatible
- `package.json` - Node.js project configuration
- `Dockerfile` - Container image definition
- `manifests/deployment.yaml` - Declarative Kubernetes deployment, service, and ingress definition

### Kubernetes storage

The Deployment defines an `emptyDir` volume named `shared-log`. Both containers mount it at `/usr/src/app/files`. The volume lasts for the lifetime of the Pod; its contents are lost when the Pod is replaced.

### Build and deploy

```bash
docker build -t elarsaks/log-output:1.10.0 ./log_output
docker push elarsaks/log-output:1.10.0
kubectl apply -f log_output/manifests/deployment.yaml
kubectl get pods -l app=log-output
kubectl logs -f deployment/log-output -c log-writer
kubectl logs -f deployment/log-output -c log-server
```

Open `http://localhost:8081/` in a browser.

The writer generates one random UUID on startup and appends lines to the shared file. The server returns the file contents at `/` and `/status`.

## Deployment Steps (Full Workflow)

Follow this path when you want to build, push, and deploy the application yourself.

### 0. Start or Create the Local k3d Cluster
Use the course default cluster name:
```bash
k3d cluster start k3s-default
```

If the cluster does not exist yet, create it:
```bash
k3d cluster create k3s-default --port 8081:80@loadbalancer
kubectl config use-context k3d-k3s-default
```

If you already have the cluster, add the Ingress port mapping:
```bash
k3d cluster edit k3s-default --port-add 8081:80@loadbalancer
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
docker build -t elarsaks/log-output:1.10.0 ./log_output
```

### 3. Push to Docker Hub
Push the image to Docker Hub so Kubernetes can pull it:
```bash
docker push elarsaks/log-output:1.10.0
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
service/log-output configured
ingress.networking.k8s.io/log-output configured
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
kubectl logs -f deployment/log-output -c log-writer
kubectl logs -f deployment/log-output -c log-server
```

Example output:
```
> log_output@1.1.0 start
> node index.js

App started. Stored value: 2e72edec-87b9-4c14-bfe9-0348828edbe3
Server started in port 3000
2025-11-08T19:21:02.462Z: 2e72edec-87b9-4c14-bfe9-0348828edbe3
2025-11-08T19:21:07.468Z: 2e72edec-87b9-4c14-bfe9-0348828edbe3
2025-11-08T19:21:12.479Z: 2e72edec-87b9-4c14-bfe9-0348828edbe3
2025-11-08T19:21:17.486Z: 2e72edec-87b9-4c14-bfe9-0348828edbe3
2025-11-08T19:21:22.493Z: 2e72edec-87b9-4c14-bfe9-0348828edbe3
2025-11-08T19:21:27.498Z: 2e72edec-87b9-4c14-bfe9-0348828edbe3
2025-11-08T19:21:32.500Z: 2e72edec-87b9-4c14-bfe9-0348828edbe3
```

### 8. Access Through Ingress
Open either endpoint in a browser:
```bash
http://localhost:8081/
http://localhost:8081/status
```

Example response:
```text
2025-11-08T19:21:37.512Z: 2e72edec-87b9-4c14-bfe9-0348828edbe3
```

## Key Observations

✅ The application successfully:
- Starts and generates a UUID stored in memory
- Logs the **same UUID** every 5 seconds
- Includes ISO 8601 timestamps in each log entry
- Serves the current status through HTTP
- Exposes the service through Kubernetes Ingress
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
