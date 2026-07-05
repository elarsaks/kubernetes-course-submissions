# Exercise 1.5 - The Project

Minimal Node.js HTTP server for DevOps with Kubernetes exercise 1.5.

## Behavior

The app reads `PORT` from the environment and defaults to `3000`.

`GET /` returns:

```text
Application <startup-random-hash>. Request <request-random-hash>
```

The application hash is created once when the process starts. The request hash is created for each request.

## Build

```bash
docker build -t elarsaks/the-project:1.5.0 .
```

If using k3d:

```bash
k3d image import elarsaks/the-project:1.5.0
```

## Deploy

```bash
kubectl apply -f manifests/deployment.yaml
kubectl get pods -l app=the-project
```

## Test

```bash
kubectl port-forward <pod-name> 3003:3000
```

Open:

```text
http://localhost:3003/
```

## Cleanup

```bash
kubectl delete -f manifests/deployment.yaml
```
