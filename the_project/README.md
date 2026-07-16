# Exercise 2.6 - The Project Configuration

The Todo application has no runtime ports, service URLs, image URLs, cache paths, cache timings, redirect limits, or Todo length limits hard-coded in its source code. Kubernetes injects all of them as environment variables from `project-config`.

The frontend and Todo backend deliberately fail at startup if a required value is missing or if a numeric value is invalid. This prevents an incomplete configuration from being hidden by source-code defaults.

## Configuration

`manifests/configmap.yaml` defines:

- `NODE_ENV`
- `PORT`
- `IMAGE_PATH`
- `IMAGE_URL`
- `TODO_BACKEND_URL`
- `CACHE_DURATION_MS`
- `MAX_IMAGE_REDIRECTS`
- `MAX_TODO_LENGTH`

Both Deployments load the ConfigMap with `envFrom`.

## Build and deploy

```bash
docker build -t elarsaks/the-project:2.6.0 ./the_project
docker build -t elarsaks/todo-backend:2.6.0 ./todo_backend
docker push elarsaks/the-project:2.6.0
docker push elarsaks/todo-backend:2.6.0

kubectl apply -f the_project/manifests/persistentvolume.yaml
kubectl apply -f the_project/manifests/namespace.yaml
kubectl apply -f the_project/manifests/configmap.yaml
kubectl apply -f the_project/manifests/persistentvolumeclaim.yaml
kubectl apply -f todo_backend/manifests/deployment.yaml
kubectl apply -f the_project/manifests/deployment.yaml
kubectl rollout status deployment/todo-backend -n project
kubectl rollout status deployment/the-project -n project
```

Open `http://localhost:8081/` to view the Todo application.

## Verify configuration

```bash
kubectl exec deployment/the-project -n project -- printenv | \
  grep -E '^(NODE_ENV|PORT|IMAGE_PATH|IMAGE_URL|TODO_BACKEND_URL|CACHE_DURATION_MS|MAX_IMAGE_REDIRECTS|MAX_TODO_LENGTH)='

kubectl exec deployment/todo-backend -n project -- printenv | \
  grep -E '^(NODE_ENV|PORT|MAX_TODO_LENGTH)='
```

## Cleanup

```bash
kubectl delete -f the_project/manifests/deployment.yaml
kubectl delete -f todo_backend/manifests/deployment.yaml
kubectl delete -f the_project/manifests/persistentvolumeclaim.yaml
kubectl delete -f the_project/manifests/configmap.yaml
kubectl delete -f the_project/manifests/namespace.yaml
kubectl delete -f the_project/manifests/persistentvolume.yaml
docker exec k3d-k3s-default-server-0 rm -rf /tmp/kube-project
```
