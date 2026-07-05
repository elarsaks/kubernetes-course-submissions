# Exercise 1.8 - The Project

Minimal Node.js HTTP server for DevOps with Kubernetes exercises 1.5, 1.6, and 1.8.

## Behavior

The app reads `PORT` from the environment and defaults to `3000`.

`GET /` returns:

```text
Application <startup-random-hash>. Request <request-random-hash>
```

The application hash is created once when the process starts. The request hash is created for each request.

## Build

```bash
docker build -t elarsaks/the-project:1.8.0 .
```

If using k3d:

```bash
k3d image import elarsaks/the-project:1.8.0
```

## Deploy

```bash
kubectl apply -f manifests/deployment.yaml
kubectl get pods -l app=the-project
```

## Test

Exercise 1.8 exposes the app through Ingress.

```bash
kubectl get service the-project
kubectl get ingress the-project
```

If your k3d cluster does not expose the Ingress controller yet, add a local port mapping:

```bash
k3d cluster edit k3s-default --port-add 8081:80@loadbalancer
```

Open:

```text
http://localhost:8081/
```

## Cleanup

```bash
kubectl delete -f manifests/deployment.yaml
```
